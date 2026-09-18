import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.LEBANON_DATABASE_URL);
const show = async (label, where, params = []) => {
  const r = await sql.query(
    `SELECT id, name, lat, lon FROM locations WHERE ${where} ORDER BY lat, lon, id`, params, { fullResults: true });
  console.log(`\n=== ${label} (${r.rows.length}건) ===`);
  r.rows.forEach(x => console.log(`  id=${String(x.id).padStart(4)} ${(+x.lat).toFixed(5)},${(+x.lon).toFixed(5)}  ${x.name}`));
};

await show('Haniyeh 계열', `name ILIKE '%haniyeh%' OR name ILIKE '%hanniye%'`);
await show('Kfar Reman / Rumman', `name ILIKE '%kfar re%man%' OR name ILIKE '%kfar ru%man%'`);
await show('마이스 알자발', `name LIKE '%마이스%'`);
