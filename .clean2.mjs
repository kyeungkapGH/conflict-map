import { neon } from '@neondatabase/serverless';
import { writeFileSync } from 'node:fs';

const APPLY = process.argv[2] === 'apply';
const OUT = process.argv[3];
const DBS = { lebanon: 'LEBANON_DATABASE_URL', yemen: 'YEMEN_DATABASE_URL' };

const km = (a, b, c, d) => {
  const R = 6371, t = x => x * Math.PI / 180;
  const u = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(u), Math.sqrt(1 - u));
};

/** 괄호 안 로마자. 없으면 이름 전체를 쓴다 ('Haniyeh'처럼 한글·행정구역이 빠진 기록을 위해). */
function romOf(name) {
  const m = [...String(name).matchAll(/\(([A-Za-z][^)]*)\)/g)];
  if (m.length) return m[m.length - 1][1].trim();
  return /[가-힣]/.test(name) ? '' : String(name).trim();
}
/** 표기 흔들림(관사, 구분자, ie/ye, kh/gh 등)을 흡수해 비교 가능한 형태로. */
const normRom = (s) => String(s || '').toLowerCase()
  .replace(/[''`]/g, '').replace(/^(al|el)[\s-]+/, '').replace(/[\s\-_]+/g, '')
  .replace(/ie/g, 'i').replace(/ye/g, 'y').replace(/yy/g, 'y')
  .replace(/ee/g, 'i').replace(/ou/g, 'u').replace(/oo/g, 'u')
  .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ph/g, 'f')
  .replace(/h$/, '').replace(/a$/, '');

/** 州(governorate). 같은 이름이 다른 주에 또 있으면(타이베 등) 섞지 않기 위한 열쇠. */
const govOf = (name) => (String(name).match(/([^\s]+)州/) || [, ''])[1];

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const similar = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const L = Math.max(a.length, b.length);
  return L >= 4 && lev(a, b) <= (L >= 8 ? 2 : 1);
};

const nameActions = [], coordActions = [], flags = [];

for (const [region, key] of Object.entries(DBS)) {
  const sql = neon(process.env[key]);
  const r = await sql.query('SELECT id, name, lat, lon FROM locations', [], { fullResults: true });
  const rows = r.rows.map(x => ({ id: x.id, name: x.name, lat: +x.lat, lon: +x.lon,
    rom: normRom(romOf(x.name)), gov: govOf(x.name) }));

  // ── 로마자 기준으로 지역 전체를 묶는다 (거리 제한 없음). 州가 다르면 섞지 않는다.
  const used = new Set(), buckets = [];
  for (const a of rows) {
    if (used.has(a.id) || !a.rom) continue;
    const g = [a]; used.add(a.id);
    for (const b of rows) {
      if (used.has(b.id) || !b.rom) continue;
      if (!similar(a.rom, b.rom)) continue;
      // 州 정보가 양쪽에 다 있고 서로 다르면 동명이촌으로 보고 묶지 않는다.
      if (a.gov && b.gov && a.gov !== b.gov) continue;
      g.push(b); used.add(b.id);
    }
    buckets.push(g);
  }

  for (const g of buckets) {
    if (g.length < 2) continue;

    // 좌표를 2km 연결로 군집화해 가장 큰 무리를 정답으로 본다.
    const seen2 = new Set(), cl = [];
    for (const a of g) {
      if (seen2.has(a.id)) continue;
      const c = [a]; seen2.add(a.id);
      for (const b of g) {
        if (seen2.has(b.id)) continue;
        if (km(a.lat, a.lon, b.lat, b.lon) <= 2) { c.push(b); seen2.add(b.id); }
      }
      cl.push(c);
    }
    cl.sort((p, q) => q.length - p.length);
    const main = cl[0];

    // 큰 무리가 둘 이상 멀리 떨어져 있으면 실제로 다른 마을일 수 있다 → 보류
    const rival = cl[1];
    if (rival && rival.length >= 3 &&
        km(main[0].lat, main[0].lon, rival[0].lat, rival[0].lon) > 5) {
      flags.push({ region, rom: g[0].rom, why: `큰 무리가 둘(${main.length}건 / ${rival.length}건) — 동명이촌 가능성`,
        ids: g.map(x => x.id) });
      continue;
    }
    if (main.length < 2) {
      flags.push({ region, rom: g[0].rom, why: `기준으로 삼을 무리가 없음 (전부 흩어짐)`, ids: g.map(x => x.id) });
      continue;
    }

    // 대표 이름: 가장 많이 쓰인 이름, 동률이면 행정구역이 붙은 긴 쪽
    const nc = new Map();
    g.forEach(x => nc.set(x.name, (nc.get(x.name) || 0) + 1));
    const canonName = [...nc.entries()].sort((p, q) => q[1] - p[1] || q[0].length - p[0].length)[0][0];

    // 대표 좌표: 정답 무리 안에서 가장 많이 쓰인 좌표
    const cc = new Map();
    main.forEach(x => { const k = `${x.lat},${x.lon}`; if (!cc.has(k)) cc.set(k, { lat: x.lat, lon: x.lon, n: 0 }); cc.get(k).n++; });
    const canon = [...cc.values()].sort((p, q) => q.n - p.n)[0];

    for (const x of g) {
      if (x.name !== canonName) nameActions.push({ region, id: x.id, from: x.name, to: canonName });
      if (x.lat !== canon.lat || x.lon !== canon.lon) {
        const d = km(x.lat, x.lon, canon.lat, canon.lon);
        coordActions.push({ region, id: x.id, label: canonName,
          from: { lat: x.lat, lon: x.lon }, to: { lat: canon.lat, lon: canon.lon },
          km: +d.toFixed(2) });
      }
    }
  }
}

const seen = new Map();
for (const a of coordActions) seen.set(`${a.region}#${a.id}`, a);
const coords = [...seen.values()];

const far = coords.filter(c => c.km > 2).length;
console.log(`  이름 통일: ${nameActions.length}건`);
console.log(`  좌표 교정: ${coords.length}건  (2km 초과 이동 ${far}건 / 이내 ${coords.length - far}건)`);
console.log(`  판단 보류: ${flags.length}묶음`);
flags.forEach(f => console.log(`    [${f.region}] ${f.rom}  ${f.why}  ids=${f.ids.slice(0, 8).join(',')}`));

if (OUT) writeFileSync(OUT, JSON.stringify({ nameActions, coordActions: coords, flags }, null, 1));
if (!APPLY) { console.log('\n  (dry-run — 계획만 기록)'); process.exit(0); }

for (const a of nameActions) {
  const sql = neon(process.env[DBS[a.region]]);
  await sql.query('UPDATE locations SET name = $1 WHERE id = $2', [a.to, a.id], { fullResults: true });
}
for (const a of coords) {
  const sql = neon(process.env[DBS[a.region]]);
  await sql.query('UPDATE locations SET lat = $1, lon = $2 WHERE id = $3', [a.to.lat, a.to.lon, a.id], { fullResults: true });
}
console.log(`\n  적용 완료 · 이름 ${nameActions.length}건, 좌표 ${coords.length}건 · 기록 ${OUT}`);
