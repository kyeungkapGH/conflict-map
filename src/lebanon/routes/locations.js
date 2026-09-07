import { Hono } from 'hono';
import { getDb } from '../../db.js';
import { getDistanceFromUnifil } from '../utils/distance.js';

const routes = new Hono();

// 연결 정보는 모듈 로드 시점이 아니라 요청 컨텍스트에서 얻는다. 엣지에는 process.env가 없다.
const db = (c) => getDb(c.env.LEBANON_DATABASE_URL);

const LOCATION_FIELDS = [
  'name', 'dms_string', 'lat', 'lon', 'category',
  'detail_info', 'damage_info', 'attacker', 'occurred_at',
];

function pickPayload(body) {
  const payload = {};
  for (const field of LOCATION_FIELDS) payload[field] = body[field];
  return payload;
}

// GET /api/locations : 전체 조회 (최신순)
routes.get('/', async (c) => {
  try {
    const result = await db(c).query(`
      SELECT id, name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance_km,
             to_char(occurred_at, 'YYYY-MM-DD HH24:MI:SS') as occurred_at
      FROM locations
      ORDER BY id DESC
    `);
    return c.json(result.rows);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/locations/today : 오늘 등록된 데이터만 조회
routes.get('/today', async (c) => {
  try {
    const result = await db(c).query(`
      SELECT id, name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance_km,
             to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
      FROM locations
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY id DESC
    `);
    return c.json(result.rows);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/locations : 신규 등록
routes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, dms_string, lat, lon, category, detail_info, damage_info, attacker, occurred_at } = pickPayload(body);

  if (!name || lat === undefined || lon === undefined) {
    return c.json({ error: 'name, lat, lon은 필수입니다.' }, 400);
  }

  const distance = getDistanceFromUnifil(parseFloat(lat), parseFloat(lon));

  try {
    const result = await db(c).query(
      `INSERT INTO locations (name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance_km, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance, occurred_at]
    );
    return c.json(result.rows[0], 201);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/locations/update?id=... : 수정
// 네트워크 보안 장비가 PUT/DELETE 등 비표준 메서드를 차단하는 환경이라 POST로 통일한다.
routes.post('/update', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.req.query('id') || body.id;
  if (!id) return c.json({ error: 'ID가 누락되었습니다.' }, 400);

  const { name, dms_string, lat, lon, category, attacker, detail_info, damage_info, occurred_at } = pickPayload(body);
  const distance = getDistanceFromUnifil(parseFloat(lat), parseFloat(lon));

  try {
    const result = await db(c).query(
      `UPDATE locations SET name=$1, dms_string=$2, lat=$3, lon=$4, category=$5, attacker=$6,
       detail_info=$7, damage_info=$8, distance_km=$9, occurred_at=$10
       WHERE id=$11 RETURNING *`,
      [name, dms_string, lat, lon, category, attacker, detail_info, damage_info, distance, occurred_at, id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: '해당 ID를 찾을 수 없습니다.' }, 404);
    }
    return c.json(result.rows[0]);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/locations/delete?id=... : 삭제
routes.post('/delete', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.req.query('id') || body.id;
  if (!id) return c.json({ error: '삭제할 ID가 없습니다.' }, 400);

  try {
    const result = await db(c).query('DELETE FROM locations WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return c.json({ error: '해당 ID를 찾을 수 없습니다.' }, 404);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default routes;
