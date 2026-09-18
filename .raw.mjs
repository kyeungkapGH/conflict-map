import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.LEBANON_DATABASE_URL);

const coords = [
  [33.173611, 35.21],
  [33.153951, 35.357594],
  [33.290499, 35.502593],
  [33.151900, 35.227500],
  [33.272892, 35.464110],
];
for (const [la, lo] of coords) {
  const r = await sql.query(
    `SELECT id, name FROM locations WHERE round(lat::numeric,6)=round($1::numeric,6)
       AND round(lon::numeric,6)=round($2::numeric,6) ORDER BY id`,
    [la, lo], { fullResults: true });
  // 같은 이름은 한 번만, 건수와 함께
  const c = new Map();
  r.rows.forEach(x => { if (!c.has(x.name)) c.set(x.name, []); c.get(x.name).push(x.id); });
  console.log(`\n=== ${la}, ${lo}  (${r.rows.length}건, 이름 ${c.size}종) ===`);
  [...c.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([n, ids]) =>
    console.log(`  ${String(ids.length).padStart(2)}건  ${n}${ids.length <= 3 ? '   ids=' + ids.join(',') : ''}`));
}
