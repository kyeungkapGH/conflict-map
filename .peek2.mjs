import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.LEBANON_DATABASE_URL);
const groups = {
  hanuiy: [311, 312, 478, 682, 752, 868, 1382],
  srebbine: [343, 284, 905, 748, 924, 956, 1276, 1030],
  chukin: [290, 401, 831, 995, 1004, 1068, 1069, 1232],
  kafr: [387, 609, 562, 556],
  tul: [538, 573, 681],
};
for (const [k, ids] of Object.entries(groups)) {
  const r = await sql.query(
    `SELECT id, name, lat, lon FROM locations WHERE id = ANY($1::int[]) ORDER BY lat, lon`,
    [ids], { fullResults: true });
  console.log(`\n=== ${k} ===`);
  r.rows.forEach(x => console.log(`  id=${String(x.id).padStart(4)} ${(+x.lat).toFixed(4)},${(+x.lon).toFixed(4)}  ${x.name}`));
}
