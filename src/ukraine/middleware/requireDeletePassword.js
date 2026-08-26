/** 지형지물 라인/마커 삭제 시 비밀번호를 요구하는 미들웨어 */
function requireDeletePassword(req, res, next) {
  const password = (req.body && req.body.password) || req.query.password;

  if (!password || password !== process.env.DELETE_PASSWORD) {
    return res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
  }

  next();
}

module.exports = requireDeletePassword;
