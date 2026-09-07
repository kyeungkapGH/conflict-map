import { Hono } from 'hono';
import { getDb } from '../../db.js';
import { requireDeletePassword } from '../../middleware/requireDeletePassword.js';

const routes = new Hono();

// 연결 정보는 모듈 로드 시점이 아니라 요청 컨텍스트에서 얻는다. 엣지에는 process.env가 없다.
const db = (c) => getDb(c.env.UKRAINE_DATABASE_URL);

// GET /api/markers : 전체 조회
routes.get('/', async (c) => {
  try {
    const result = await db(c).query('SELECT id, name, marker_type, lat, lon FROM map_markers ORDER BY id');
    return c.json(result.rows);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/markers : 신규 등록
routes.post('/', async (c) => {
  const { name, marker_type, lat, lon } = await c.req.json().catch(() => ({}));

  if (!name || !['circle', 'x'].includes(marker_type) || lat === undefined || lon === undefined) {
    return c.json({ error: "name, marker_type('circle'|'x'), lat, lon이 필요합니다." }, 400);
  }

  try {
    const result = await db(c).query(
      'INSERT INTO map_markers (name, marker_type, lat, lon) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, marker_type, lat, lon]
    );
    return c.json(result.rows[0], 201);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/markers/update?id=... : 수정
routes.post('/update', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.req.query('id') || body.id;
  if (!id) return c.json({ error: 'ID가 누락되었습니다.' }, 400);

  const { name, marker_type, lat, lon } = body;

  if (!name || !['circle', 'x'].includes(marker_type) || lat === undefined || lon === undefined) {
    return c.json({ error: "name, marker_type('circle'|'x'), lat, lon이 필요합니다." }, 400);
  }

  try {
    const result = await db(c).query(
      'UPDATE map_markers SET name=$1, marker_type=$2, lat=$3, lon=$4 WHERE id=$5 RETURNING *',
      [name, marker_type, lat, lon, id]
    );
    if (result.rows.length === 0) {
      return c.json({ error: '해당 ID를 찾을 수 없습니다.' }, 404);
    }
    return c.json(result.rows[0]);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/markers/delete?id=... : 삭제 (비밀번호 필요)
routes.post('/delete', requireDeletePassword, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.req.query('id') || body.id;
  if (!id) return c.json({ error: '삭제할 ID가 없습니다.' }, 400);

  try {
    const result = await db(c).query('DELETE FROM map_markers WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return c.json({ error: '해당 ID를 찾을 수 없습니다.' }, 404);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default routes;
