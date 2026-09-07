import { neon, types } from '@neondatabase/serverless';

// timestamp without time zone 컬럼을 JS Date로 바꾸지 않고 DB에 저장된 문자열 그대로 반환한다.
// (Date로 바꾸면 직렬화 시 실제로는 KST 벽시계 값인데 UTC로 오인되는 'Z' 접미사가 붙는다.)
const customTypes = {
  getTypeParser: (oid, format) =>
    (oid === types.builtins.TIMESTAMP ? (val) => val : types.getTypeParser(oid, format)),
};

// neon()은 types/fullResults를 무시하므로 쿼리 단위 옵션으로 넘긴다.
// fullResults를 켜야 { rows, rowCount } 형태가 나온다. (라우트가 rowCount를 쓴다)
const queryOptions = { types: customTypes, fullResults: true };

// 커넥션 풀을 쓰지 않는다. 엣지에는 요청 간 유지되는 프로세스가 없어서, 모듈 스코프에 둔
// 풀의 커넥션을 다음 요청이 건드리는 순간 응답이 멈춘다.
// HTTP 드라이버는 쿼리마다 fetch로 끝나고 클라이언트는 설정만 들고 있어 재사용해도 안전하다.
const clients = new Map();

/** 커넥션 문자열에 해당하는 DB 핸들을 돌려준다. 연결 정보는 요청 컨텍스트(c.env)에서 온다. */
export function getDb(connectionString) {
  let sql = clients.get(connectionString);
  if (!sql) {
    sql = neon(connectionString);
    clients.set(connectionString, sql);
  }
  return {
    query: (text, params = []) => sql.query(text, params, queryOptions),
  };
}
