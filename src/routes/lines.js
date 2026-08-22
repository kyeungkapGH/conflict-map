const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/lines : 전체 조회
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, color, coordinates FROM map_lines ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lines : 신규 등록
router.post('/', async (req, res) => {
  const { name, color, coordinates } = req.body;

  if (!name || !Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(400).json({ error: 'name과 2개 이상의 좌표(coordinates)가 필요합니다.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO map_lines (name, color, coordinates) VALUES ($1, $2, $3) RETURNING *',
      [name, color || 'rgba(0, 100, 255, 0.6)', JSON.stringify(coordinates)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lines/update?id=... : 수정
router.post('/update', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: 'ID가 누락되었습니다.' });

  const { name, color, coordinates } = req.body;

  if (!name || !Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(400).json({ error: 'name과 2개 이상의 좌표(coordinates)가 필요합니다.' });
  }

  try {
    const result = await pool.query(
      'UPDATE map_lines SET name=$1, color=$2, coordinates=$3 WHERE id=$4 RETURNING *',
      [name, color, JSON.stringify(coordinates), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 ID를 찾을 수 없습니다.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lines/delete?id=... : 삭제
router.post('/delete', async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: '삭제할 ID가 없습니다.' });

  try {
    const result = await pool.query('DELETE FROM map_lines WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 ID를 찾을 수 없습니다.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
