const express = require('express');
const pool = require('../db');
const { getDistanceFromUnifil } = require('../utils/distance');

const router = express.Router();

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
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance_km,
             to_char(occurred_at, 'YYYY-MM-DD HH24:MI:SS') as occurred_at
      FROM locations
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/locations/today : 오늘 등록된 데이터만 조회
router.get('/today', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance_km,
             to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
      FROM locations
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/locations : 신규 등록
router.post('/', async (req, res) => {
  const { name, dms_string, lat, lon, category, detail_info, damage_info, attacker, occurred_at } = pickPayload(req.body);

  if (!name || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'name, lat, lon은 필수입니다.' });
  }

  const distance = getDistanceFromUnifil(parseFloat(lat), parseFloat(lon));

  try {
    const result = await pool.query(
      `INSERT INTO locations (name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance_km, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, dms_string, lat, lon, category, detail_info, damage_info, attacker, distance, occurred_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/locations/update?id=... : 수정
// 네트워크 보안 장비가 PUT/DELETE 등 비표준 메서드를 차단하는 환경이라 POST로 통일한다.
router.post('/update', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: 'ID가 누락되었습니다.' });

  const { name, dms_string, lat, lon, category, attacker, detail_info, damage_info, occurred_at } = pickPayload(req.body);
  const distance = getDistanceFromUnifil(parseFloat(lat), parseFloat(lon));

  try {
    const result = await pool.query(
      `UPDATE locations SET name=$1, dms_string=$2, lat=$3, lon=$4, category=$5, attacker=$6,
       detail_info=$7, damage_info=$8, distance_km=$9, occurred_at=$10
       WHERE id=$11 RETURNING *`,
      [name, dms_string, lat, lon, category, attacker, detail_info, damage_info, distance, occurred_at, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 ID를 찾을 수 없습니다.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/locations/delete?id=... : 삭제
router.post('/delete', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: '삭제할 ID가 없습니다.' });

  try {
    const result = await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 ID를 찾을 수 없습니다.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
