import { neon } from '@neondatabase/serverless';

const KW = ['구 ', '주 ', '북부', '시 ', '수도 ', '州 ', '市 ', '區 ', '道 ', '省 ', '郡 '];
const UNITS = /[구주시州市區道省郡]$/;
function shortName(text) {
  if (!text) return '';
  let li = -1, f = null;
  KW.forEach(k => {
    const i = text.lastIndexOf(k);
    if (i !== -1 && i + k.length < text.length) {
      if (k === '수도 ' && /[상하]$/.test(text.slice(0, i))) return;
      if (i > li) { li = i; f = k; }
    }
  });
  let r = f ? text.slice(li + f.length).trim() : text;
  if (!f && UNITS.test(text.trim())) { const p = text.trim().split(/\s+/); r = p[p.length - 1]; }
  return r.replace(/[^가-힣\s]/g, '').replace(/\s+/g, ' ').trim() || text.trim();
}

const sql = neon(process.env.LEBANON_DATABASE_URL);
const r = await sql.query('SELECT id, name, lat, lon FROM locations', [], { fullResults: true });
const rows = r.rows.map(x => ({ id: x.id, name: x.name, lat: +x.lat, lon: +x.lon, s: shortName(x.name) }));

const byCoord = new Map();
rows.forEach(x => {
  const k = `${x.lat},${x.lon}`;
  if (!byCoord.has(k)) byCoord.set(k, { lat: x.lat, lon: x.lon, rows: [] });
  byCoord.get(k).rows.push(x);
});

const mag = [...byCoord.values()]
  .map(c => {
    const nc = new Map();
    c.rows.forEach(x => nc.set(x.s, (nc.get(x.s) || 0) + 1));
    const sorted = [...nc.entries()].sort((a, b) => b[1] - a[1]);
    return { ...c, names: sorted, total: c.rows.length };
  })
  .filter(c => c.names.length > 1)
  .sort((a, b) => b.total - a.total);

console.log(`서로 다른 지명이 한 좌표를 공유하는 지점: ${mag.length}곳\n`);
let victims = 0;
for (const c of mag.slice(0, 12)) {
  const [top, topN] = c.names[0];
  const rest = c.names.slice(1);
  victims += rest.reduce((s, [, n]) => s + n, 0);
  console.log(`  ${c.lat.toFixed(4)},${c.lon.toFixed(4)}  총 ${c.total}건`);
  console.log(`    주인(최다): ${top} ${topN}건`);
  console.log(`    얹힌 지명: ` + rest.map(([n, k]) => `${n}(${k})`).join(', '));
}
const allVictims = mag.reduce((s, c) => s + c.names.slice(1).reduce((t, [, n]) => t + n, 0), 0);
console.log(`\n  주인이 아닌 지명으로 얹혀 있는 레코드: 총 ${allVictims}건`);
