import { Hono } from 'hono';
import { getDb } from '../../db.js';
import { requireDeletePassword } from '../../middleware/requireDeletePassword.js';

const routes = new Hono();

// 연결 정보는 모듈 로드 시점이 아니라 요청 컨텍스트에서 얻는다. 엣지에는 process.env가 없다.
const db = (c) => getDb(c.env.LEBANON_DATABASE_URL);

// GET /api/lines : 전체 조회
routes.get('/', async (c) => {
  try {
    const result = await db(c).query('SELECT id, name, color, coordinates FROM map_lines ORDER BY id');
    return c.json(result.rows);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/lines : 신규 등록
routes.post('/', async (c) => {
  const { name, color, coordinates } = await c.req.json().catch(() => ({}));

  if (!name || !Array.isArray(coordinates) || coordinates.length < 2) {
    return c.json({ error: 'name과 2개 이상의 좌표(coordinates)가 필요합니다.' }, 400);
  }

  try {
    const result = await db(c).query(
      'INSERT INTO map_lines (name, color, coordinates) VALUES ($1, $2, $3) RETURNING *',
      [name, color || 'rgba(0, 100, 255, 0.6)', JSON.stringify(coordinates)]
    );
    return c.json(result.rows[0], 201);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/lines/update?id=... : 수정
routes.post('/update', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.req.query('id') || body.id;
  if (!id) return c.json({ error: 'ID가 누락되었습니다.' }, 400);

  const { name, color, coordinates } = body;

  if (!name || !Array.isArray(coordinates) || coordinates.length < 2) {
    return c.json({ error: 'name과 2개 이상의 좌표(coordinates)가 필요합니다.' }, 400);
  }

  try {
    const result = await db(c).query(
      'UPDATE map_lines SET name=$1, color=$2, coordinates=$3 WHERE id=$4 RETURNING *',
      [name, color, JSON.stringify(coordinates), id]
    );
    if (result.rows.length === 0) {
      return c.json({ error: '해당 ID를 찾을 수 없습니다.' }, 404);
    }
    return c.json(result.rows[0]);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/lines/delete?id=... : 삭제 (비밀번호 필요)
routes.post('/delete', requireDeletePassword, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = c.req.query('id') || body.id;
  if (!id) return c.json({ error: '삭제할 ID가 없습니다.' }, 400);

  try {
    const result = await db(c).query('DELETE FROM map_lines WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return c.json({ error: '해당 ID를 찾을 수 없습니다.' }, 404);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default routes;
