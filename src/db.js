const { Pool, types } = require('pg');

// timestamp without time zone 컬럼을 JS Date로 바꾸지 않고 DB에 저장된 문자열 그대로 반환한다.
// (Date로 바꾸면 직렬화 시 실제로는 KST 벽시계 값인데 UTC로 오인되는 'Z' 접미사가 붙는다.)
types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
