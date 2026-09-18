import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.LEBANON_DATABASE_URL);
const km = (a, b, c, d) => {
  const R = 6371, t = x => x * Math.PI / 180;
  const u = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(u), Math.sqrt(1 - u));
};

console.log('=== Haniyeh 계열 ===');
const h = await sql.query(
  `SELECT id, name, lat, lon, to_char(created_at,'MM-DD HH24:MI') c
   FROM locations WHERE name ILIKE '%haniyeh%' OR name LIKE '%하니야%' OR name LIKE '%한니예%'
   ORDER BY lat, lon, id`, [], { fullResults: true });
h.rows.forEach(x => console.log(`  id=${String(x.id).padStart(4)} ${(+x.lat).toFixed(5)},${(+x.lon).toFixed(5)}  등록 ${x.c}  ${x.name}`));

console.log('\n=== 마이스 알자발 / 바야다 ===');
const m = await sql.query(
  `SELECT id, name, lat, lon FROM locations
   WHERE name LIKE '%마이스%' OR name LIKE '%바야다%' ORDER BY name, lat, lon`, [], { fullResults: true });
const byPlace = new Map();
m.rows.forEach(x => {
  const k = `${(+x.lat).toFixed(5)},${(+x.lon).toFixed(5)}|${x.name}`;
  if (!byPlace.has(k)) byPlace.set(k, { lat: +x.lat, lon: +x.lon, name: x.name, ids: [] });
  byPlace.get(k).ids.push(x.id);
});
const arr = [...byPlace.values()];
arr.forEach(x => console.log(`  ${x.lat.toFixed(5)},${x.lon.toFixed(5)}  ${String(x.ids.length).padStart(2)}건  ${x.name}`));
console.log('\n  서로 다른 지명인데 1km 이내로 붙은 쌍:');
for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
  const d = km(arr[i].lat, arr[i].lon, arr[j].lat, arr[j].lon);
  const n1 = arr[i].name.split(' ').pop(), n2 = arr[j].name.split(' ').pop();
  if (d < 1 && arr[i].name !== arr[j].name) {
    console.log(`    ${(d * 1000).toFixed(0)}m  [${arr[i].ids.length}건] ${arr[i].name}`);
    console.log(`          [${arr[j].ids.length}건] ${arr[j].name}`);
  }
}
