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

/** 로마자 표기를 비교 가능한 형태로 정규화한다. Al-/El- 관사, 구분자, 흔한 철자 흔들림을 흡수. */
function normRom(s) {
  return String(s || '').toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/^(al|el)[\s-]+/, '')
    .replace(/[\s\-_]+/g, '')
    .replace(/ie/g, 'i').replace(/ye/g, 'y').replace(/yy/g, 'y')
    .replace(/ee/g, 'i').replace(/ou/g, 'u').replace(/oo/g, 'u')
    .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ph/g, 'f')
    .replace(/h$/, '').replace(/a$/, '');
}
const roman = (s) => { const m = [...String(s).matchAll(/\(([A-Za-z][^)]*)\)/g)]; return m.length ? m[m.length - 1][1].trim() : ''; };

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
  const d = lev(a, b), L = Math.max(a.length, b.length);
  return L >= 4 && d <= (L >= 8 ? 2 : 1);
};

const nameActions = [];   // 이름 통일
const coordActions = [];  // 좌표 교정
const flags = [];         // 사람이 봐야 하는 것

for (const [region, key] of Object.entries(DBS)) {
  const sql = neon(process.env[key]);
  const r = await sql.query('SELECT id, name, lat, lon FROM locations', [], { fullResults: true });
  const rows = r.rows.map(x => ({ id: x.id, name: x.name, lat: +x.lat, lon: +x.lon, rom: normRom(roman(x.name)) }));

  // ── 1단계: 표기가 달라도 같은 마을이면 하나로 묶는다 (로마자 유사 + 2km 이내)
  const used = new Set();
  const clusters = [];
  for (const a of rows) {
    if (used.has(a.id)) continue;
    const grp = [a]; used.add(a.id);
    for (const b of rows) {
      if (used.has(b.id)) continue;
      if (!similar(a.rom, b.rom)) continue;
      if (km(a.lat, a.lon, b.lat, b.lon) > 2) continue;
      grp.push(b); used.add(b.id);
    }
    clusters.push(grp);
  }

  for (const grp of clusters) {
    if (grp.length < 2) continue;

    // 대표 이름: 가장 많이 쓰인 전체 이름. 동률이면 행정구역이 붙은 긴 쪽.
    const nameCount = new Map();
    grp.forEach(x => nameCount.set(x.name, (nameCount.get(x.name) || 0) + 1));
    const canonName = [...nameCount.entries()]
      .sort((p, q) => q[1] - p[1] || q[0].length - p[0].length)[0][0];

    // 대표 좌표: 가장 많이 쓰인 좌표. 동률이면 무리의 중앙에 가까운 쪽.
    const cc = new Map();
    grp.forEach(x => { const k = `${x.lat},${x.lon}`; if (!cc.has(k)) cc.set(k, { lat: x.lat, lon: x.lon, n: 0 }); cc.get(k).n++; });
    const cands = [...cc.values()];
    const mLat = cands.reduce((s, c) => s + c.lat * c.n, 0) / grp.length;
    const mLon = cands.reduce((s, c) => s + c.lon * c.n, 0) / grp.length;
    const canon = cands.sort((p, q) => q.n - p.n || km(p.lat, p.lon, mLat, mLon) - km(q.lat, q.lon, mLat, mLon))[0];

    for (const x of grp) {
      if (x.name !== canonName) nameActions.push({ region, id: x.id, from: x.name, to: canonName });
      if (x.lat !== canon.lat || x.lon !== canon.lon)
        coordActions.push({ region, id: x.id, label: canonName, from: { lat: x.lat, lon: x.lon }, to: { lat: canon.lat, lon: canon.lon }, why: '표기 통일 묶음' });
    }
  }

  // ── 2단계: 자기 마을 무리에서 멀고, 다른 마을 좌표에 붙어 있는 레코드
  const after = rows.map(x => {
    const na = nameActions.find(a => a.region === region && a.id === x.id);
    const ca = coordActions.find(a => a.region === region && a.id === x.id);
    return { ...x, name: na ? na.to : x.name, lat: ca ? ca.to.lat : x.lat, lon: ca ? ca.to.lon : x.lon };
  });

  const byName = new Map();
  after.forEach(x => { if (!byName.has(x.name)) byName.set(x.name, []); byName.get(x.name).push(x); });

  // 각 지명의 대표 좌표.
  // 정확히 일치하는 좌표의 최다 건수로 잡으면, 흩어진 정답 무리가 뭉쳐 있는 오답에 질 수 있다.
  // (마이스 알자발: 정답 3건이 160m 안에 흩어져 있고, 잘못 물려받은 좌표에 2건이 정확히 겹침)
  // 그래서 2km 근접 군집으로 먼저 묶고, 가장 큰 군집 안에서 최다 좌표를 대표로 삼는다.
  const home = new Map();
  for (const [nm, v] of byName) {
    const used2 = new Set();
    const groups = [];
    for (const a of v) {
      if (used2.has(a.id)) continue;
      const g = [a]; used2.add(a.id);
      for (const b of v) {
        if (used2.has(b.id)) continue;
        if (km(a.lat, a.lon, b.lat, b.lon) <= 2) { g.push(b); used2.add(b.id); }
      }
      groups.push(g);
    }
    groups.sort((p, q) => q.length - p.length);
    const best = groups[0];
    const cc = new Map();
    best.forEach(x => { const k = `${x.lat},${x.lon}`; if (!cc.has(k)) cc.set(k, { lat: x.lat, lon: x.lon, n: 0 }); cc.get(k).n++; });
    const top = [...cc.values()].sort((p, q) => q.n - p.n)[0];
    home.set(nm, { lat: top.lat, lon: top.lon, n: best.length });
  }

  for (const [nm, v] of byName) {
    const h = home.get(nm);
    for (const x of v) {
      const dHome = km(x.lat, x.lon, h.lat, h.lon);
      if (dHome <= 2) continue;

      // 이 좌표가 '다른 지명'의 대표 좌표에 붙어 있으면 좌표를 잘못 물려받은 것으로 본다
      let borrowed = null;
      for (const [onm, oh] of home) {
        if (onm === nm) continue;
        if (km(x.lat, x.lon, oh.lat, oh.lon) <= 0.3) { borrowed = onm; break; }
      }
      if (borrowed) {
        if (v.length >= 2 && h.n >= 2) {
          coordActions.push({ region, id: x.id, label: nm, from: { lat: x.lat, lon: x.lon }, to: { lat: h.lat, lon: h.lon },
            why: `다른 마을(${borrowed.split(' ').pop()}) 좌표를 물려받음, 자기 무리에서 ${dHome.toFixed(1)}km` });
        } else {
          flags.push({ region, id: x.id, name: nm, why: `다른 마을 좌표로 보이나 자기 무리가 작아 판단 보류 (${v.length}건)` });
        }
      } else if (dHome > 10 && h.n >= 3) {
        coordActions.push({ region, id: x.id, label: nm, from: { lat: x.lat, lon: x.lon }, to: { lat: h.lat, lon: h.lon },
          why: `자기 무리에서 ${dHome.toFixed(1)}km 이탈 (무리 ${h.n}건)` });
      }
    }
  }
}

// 같은 레코드에 좌표 조치가 겹치면 마지막 하나만 남긴다 (이중 이동 방지)
const seen = new Map();
for (const a of coordActions) seen.set(`${a.region}#${a.id}`, a);
const coords = [...seen.values()];

console.log(`  이름 통일: ${nameActions.length}건`);
console.log(`  좌표 교정: ${coords.length}건`);
console.log(`  판단 보류: ${flags.length}건`);
console.log('\n  이름 통일 예시:');
nameActions.slice(0, 6).forEach(a => console.log(`    id=${a.id}\n      ${a.from}\n      → ${a.to}`));
console.log('\n  좌표 교정 사유별:');
const byWhy = {};
coords.forEach(a => { const k = a.why.split(',')[0].replace(/\(.*?\)/, '()'); byWhy[k] = (byWhy[k] || 0) + 1; });
Object.entries(byWhy).forEach(([k, v]) => console.log(`    ${v}건  ${k}`));
console.log('\n  좌표 교정 예시:');
coords.slice(0, 6).forEach(a => console.log(`    id=${a.id} ${a.label.split(' ').pop()}  ${a.from.lat.toFixed(5)},${a.from.lon.toFixed(5)} → ${a.to.lat.toFixed(5)},${a.to.lon.toFixed(5)}  (${a.why})`));

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
writeFileSync(OUT, JSON.stringify({ nameActions, coordActions: coords, flags }, null, 1));
console.log(`\n  적용 완료 · 기록 ${OUT}`);
