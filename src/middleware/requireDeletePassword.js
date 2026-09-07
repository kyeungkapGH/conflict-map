/** 지형지물 라인/마커 삭제 시 비밀번호를 요구하는 미들웨어 */
export async function requireDeletePassword(c, next) {
  // Hono는 파싱한 본문을 캐시하므로 이후 핸들러에서 다시 읽어도 안전하다.
  const body = await c.req.json().catch(() => ({}));
  const password = body.password || c.req.query('password');

  if (!password || password !== c.env.DELETE_PASSWORD) {
    return c.json({ error: '비밀번호가 올바르지 않습니다.' }, 403);
  }

  await next();
}
