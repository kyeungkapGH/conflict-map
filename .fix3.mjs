import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'node:fs';

const APPLY = process.argv[2] === 'apply';
const OUT = process.argv[3];
const GEO = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')) : {};
const DBS = { lebanon: 'LEBANON_DATABASE_URL', yemen: 'YEMEN_DATABASE_URL' };

const km = (a, b, c, d) => {
  const R = 6371, t = x => x * Math.PI / 180;
  const u = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(u), Math.sqrt(1 - u));
};
const romOf = (n) => { const m = [...String(n).matchAll(/\(([A-Za-z][^)]*)\)/g)]; return m.length ? m[m.length - 1][1].trim() : (/[가-힣]/.test(n) ? '' : String(n).trim()); };
/** 가벼운 정규화만. 글자를 뭉개면 서로 다른 마을이 섞인다(하누이예 vs 한니예). */
const norm = (s) => String(s || '').toLowerCase().replace(/[''`]/g, '').replace(/^(al|el)[\s-]+/, '').replace(/[\s\-_]+/g, '');
const gov = (n) => (String(n).match(/([^\s]+)州/) || [, ''])[1];
/** 지명 유형. 마을·市·난민 캠프·키부츠·모샤브·계곡·정착촌은 서로 다른 대상이다. */
function placeType(n) {
  const s = String(n);
  if (/난민\s*캠프/.test(s)) return 'camp';
  if (/키부츠/.test(s)) return 'kibbutz';
  if (/모샤브/.test(s)) return 'moshav';
  if (/정착촌/.test(s)) return 'settlement';
  if (/계곡/.test(s)) return 'valley';
  if (/고지|언덕/.test(s)) return 'hill';
  if (/[市]\s*$/.test(s.trim())) return 'city';
  if (/마을\s*$/.test(s.trim())) return 'village';
  return 'other';
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c; }
  return p[n];
}

const nameFix = [], coordFix = [], flags = [];

for (const [region, key] of Object.entries(DBS)) {
  const sql = neon(process.env[key]);
  const q = await sql.query('SELECT id, name, lat, lon FROM locations', [], { fullResults: true });
  let rows = q.rows.map(x => ({ id: x.id, name: x.name, lat: +x.lat, lon: +x.lon }));

  // ── 1) 접미 오타: 같은 좌표의 대표 이름으로 시작하면서 한글 몇 자가 더 붙은 것
  const byCoord = new Map();
  rows.forEach(x => { const k = `${x.lat},${x.lon}`; if (!byCoord.has(k)) byCoord.set(k, []); byCoord.get(k).push(x); });
  for (const v of byCoord.values()) {
    const nc = new Map();
    v.forEach(x => nc.set(x.name, (nc.get(x.name) || 0) + 1));
    const [top, topN] = [...nc.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topN < 2) continue;
    for (const x of v) {
      if (x.name === top) continue;
      const extra = x.name.startsWith(top) ? x.name.slice(top.length) : null;
      if (extra && extra.length <= 5 && /^[가-힣]+$/.test(extra)) {
        nameFix.push({ region, id: x.id, from: x.name, to: top, why: `접미 오타 '${extra}' 제거` });
      }
    }
  }
  const fixedName = new Map(nameFix.filter(f => f.region === region).map(f => [f.id, f.to]));
  rows = rows.map(x => ({ ...x, name: fixedName.get(x.id) ?? x.name }));

  // ── 2) 얹힌 좌표: 이름은 같은데 자기 무리가 딴 데 있는 경우 그리로 옮긴다
  const byRom = new Map();
  rows.forEach(x => {
    const rk = `${gov(x.name)}|${norm(romOf(x.name))}`;
    if (!norm(romOf(x.name))) return;
    if (!byRom.has(rk)) byRom.set(rk, []); byRom.get(rk).push(x);
  });

  for (const [rk, v] of byRom) {
    // 계곡·고지는 넓게 퍼진 지형이라 기록이 멀리 떨어져 있는 게 정상이다.
    // (베카 계곡은 길이가 120km에 달한다) 한 점으로 모으면 안 된다.
    if (v.some(x => ['valley', 'hill'].includes(placeType(x.name)))) continue;
    // 좌표를 2km 연결로 군집화
    const used = new Set(), cls = [];
    for (const a of v) {
      if (used.has(a.id)) continue;
      const c = [a]; used.add(a.id);
      for (const b of v) { if (used.has(b.id)) continue;
        if (km(a.lat, a.lon, b.lat, b.lon) <= 2) { c.push(b); used.add(b.id); } }
      cls.push(c);
    }
    if (cls.length < 2) continue;
    cls.sort((p, q) => q.length - p.length);
    const main = cls[0], rival = cls[1];

    // 큰 무리가 둘이면 동명이촌일 수 있어 건드리지 않는다
    if (main.length < 2 || (rival.length >= 3 && main.length - rival.length <= 1)) {
      flags.push({ region, key: rk, why: `무리 ${cls.map(c => c.length).join('/')} — 판단 보류`, ids: v.map(x => x.id) });
      continue;
    }
    const cc = new Map();
    main.forEach(x => { const k = `${x.lat},${x.lon}`; if (!cc.has(k)) cc.set(k, { lat: x.lat, lon: x.lon, n: 0 }); cc.get(k).n++; });
    const canon = [...cc.values()].sort((p, q) => q.n - p.n)[0];

    for (const c of cls.slice(1)) for (const x of c) {
      coordFix.push({ region, id: x.id, label: x.name, from: { lat: x.lat, lon: x.lon },
        to: { lat: canon.lat, lon: canon.lon }, km: +km(x.lat, x.lon, canon.lat, canon.lon).toFixed(2),
        why: `같은 이름 ${main.length}건이 모인 좌표로 이동` });
    }
  }
  const fixedCoord = new Map(coordFix.filter(f => f.region === region).map(f => [f.id, f.to]));
  rows = rows.map(x => { const c = fixedCoord.get(x.id); return c ? { ...x, lat: c.lat, lon: c.lon } : x; });

  // ── 3) 표기 통일: 좌표가 2km 안이고 로마자가 1글자 차이면 같은 마을로 본다
  const used3 = new Set();
  for (const a of rows) {
    if (used3.has(a.id)) continue;
    const ra = norm(romOf(a.name)); if (!ra) continue;
    const g = [a]; used3.add(a.id);
    for (const b of rows) {
      if (used3.has(b.id)) continue;
      const rb = norm(romOf(b.name)); if (!rb) continue;
      if (gov(a.name) && gov(b.name) && gov(a.name) !== gov(b.name)) continue;
      // 지명 유형이 다르면 같은 자리라도 다른 대상이다(난민 캠프 ≠ 마을, 계곡 ≠ 마을).
      // 통일하면 정보가 사라지므로 건드리지 않는다.
      // 다만 'other'는 유형을 못 읽은 것(예: 'Haniyeh')이라 막지 않는다.
      const ta = placeType(a.name), tb = placeType(b.name);
      if (ta !== 'other' && tb !== 'other' && ta !== tb) continue;
      // 계곡·고지는 마을이 아니라 지형이다. 이름에 '마을'이 붙고 말고가 의미를 바꾸므로 두 손 뗀다.
      if (ta === 'valley' || tb === 'valley' || ta === 'hill' || tb === 'hill') continue;
      if (lev(ra, rb) > 1) continue;
      if (km(a.lat, a.lon, b.lat, b.lon) > 2) continue;
      g.push(b); used3.add(b.id);
    }
    if (g.length < 2) continue;
    const nc = new Map();
    g.forEach(x => nc.set(x.name, (nc.get(x.name) || 0) + 1));
    // 한글 설명 괄호가 붙은 이름('키부츠(집단 농업 마을)')은 대표로 삼지 않는다.
    // 더 장황한 쪽으로 통일되면 오히려 나빠진다.
    const gloss = (s) => /\([^)]*[가-힣][^)]*\)/.test(s);
    const cand = [...nc.entries()].sort((p, q) =>
      (gloss(p[0]) - gloss(q[0])) || (q[1] - p[1]) || (q[0].length - p[0].length));
    const canon = cand[0][0];
    for (const x of g) if (x.name !== canon)
      nameFix.push({ region, id: x.id, from: x.name, to: canon, why: '표기 통일' });
  }
}

const nDedup = new Map(); nameFix.forEach(f => nDedup.set(`${f.region}#${f.id}`, f));
const cDedup = new Map(); coordFix.forEach(f => cDedup.set(`${f.region}#${f.id}`, f));
const names = [...nDedup.values()], coords = [...cDedup.values()];

console.log(`  이름 수정 ${names.length}건 · 좌표 수정 ${coords.length}건 · 보류 ${flags.length}묶음`);
console.log('\n  이름 수정 사유별:');
const nw = {}; names.forEach(f => nw[f.why.replace(/'.*?'/, "'…'")] = (nw[f.why.replace(/'.*?'/, "'…'")] || 0) + 1);
Object.entries(nw).forEach(([k, v]) => console.log(`    ${v}건  ${k}`));
console.log('\n  좌표 수정 거리 분포:');
const b = { '2km 이내': 0, '2~10km': 0, '10km 초과': 0 };
coords.forEach(c => { b[c.km <= 2 ? '2km 이내' : c.km <= 10 ? '2~10km' : '10km 초과']++; });
Object.entries(b).forEach(([k, v]) => console.log(`    ${v}건  ${k}`));
console.log('\n  보류 묶음:');
flags.slice(0, 10).forEach(f => console.log(`    ${f.key}  ${f.why}`));

if (OUT) writeFileSync(OUT, JSON.stringify({ names, coords, flags }, null, 1));
if (!APPLY) { console.log('\n  (dry-run)'); process.exit(0); }

for (const f of names) {
  const sql = neon(process.env[DBS[f.region]]);
  await sql.query('UPDATE locations SET name = $1 WHERE id = $2', [f.to, f.id], { fullResults: true });
}
for (const f of coords) {
  const sql = neon(process.env[DBS[f.region]]);
  await sql.query('UPDATE locations SET lat = $1, lon = $2 WHERE id = $3', [f.to.lat, f.to.lon, f.id], { fullResults: true });
}
console.log(`\n  적용 완료 · 이름 ${names.length}건, 좌표 ${coords.length}건`);
