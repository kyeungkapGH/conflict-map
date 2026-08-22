const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/markers : 전체 조회
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, marker_type, lat, lon FROM map_markers ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/markers : 신규 등록
router.post('/', async (req, res) => {
  const { name, marker_type, lat, lon } = req.body;

  if (!name || !['circle', 'x'].includes(marker_type) || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: "name, marker_type('circle'|'x'), lat, lon이 필요합니다." });
  }

  try {
    const result = await pool.query(
      'INSERT INTO map_markers (name, marker_type, lat, lon) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, marker_type, lat, lon]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/markers/update?id=... : 수정
router.post('/update', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: 'ID가 누락되었습니다.' });

  const { name, marker_type, lat, lon } = req.body;

  if (!name || !['circle', 'x'].includes(marker_type) || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: "name, marker_type('circle'|'x'), lat, lon이 필요합니다." });
  }

  try {
    const result = await pool.query(
      'UPDATE map_markers SET name=$1, marker_type=$2, lat=$3, lon=$4 WHERE id=$5 RETURNING *',
      [name, marker_type, lat, lon, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 ID를 찾을 수 없습니다.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/markers/delete?id=... : 삭제
router.post('/delete', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: '삭제할 ID가 없습니다.' });

  try {
    const result = await pool.query('DELETE FROM map_markers WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 ID를 찾을 수 없습니다.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
