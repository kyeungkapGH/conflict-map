/**
 * 지형지물 라인(map_lines) / 점령지 마커(map_markers)를 등록하는 시딩 스크립트.
 * 아래 LINES / CIRCLE_LOCS / X_LOCS 배열에 실제 좌표를 채운 뒤 실행한다.
 * (좌표를 모르면 관리자 페이지 /admin.html 에서 직접 추가해도 된다.)
 * 실행: node --env-file=.env scripts/ukraine/seed-map-features.js
 */
import { getDb } from '../../src/db.js';

const pool = getDb(process.env.UKRAINE_DATABASE_URL);

// 라인 예시: { name: '드니프로 강', color: 'rgba(0, 100, 255, 0.6)', coordinates: [[lat, lon], ...] }
const LINES = [];

// 원형 마커: [lat, lon, 이름]
const CIRCLE_LOCS = [];

// X형 마커: [lat, lon, 이름]
const X_LOCS = [];

async function seed() {
    const { rows: existingLines } = await pool.query('SELECT COUNT(*) FROM map_lines');
    const { rows: existingMarkers } = await pool.query('SELECT COUNT(*) FROM map_markers');

    if (Number(existingLines[0].count) > 0 || Number(existingMarkers[0].count) > 0) {
        console.log('map_lines/map_markers에 이미 데이터가 있어 시딩을 건너뜁니다.');
        process.exit(0);
    }

    if (LINES.length === 0 && CIRCLE_LOCS.length === 0 && X_LOCS.length === 0) {
        console.log('시딩할 데이터가 비어 있습니다. scripts/ukraine/seed-map-features.js에 좌표를 채우거나 /admin.html에서 직접 추가하세요.');
        process.exit(0);
    }

    for (const line of LINES) {
        await pool.query(
            'INSERT INTO map_lines (name, color, coordinates) VALUES ($1, $2, $3)',
            [line.name, line.color, JSON.stringify(line.coordinates)]
        );
    }

    for (const [lat, lon, name] of CIRCLE_LOCS) {
        await pool.query(
            'INSERT INTO map_markers (name, marker_type, lat, lon) VALUES ($1, $2, $3, $4)',
            [name, 'circle', lat, lon]
        );
    }

    for (const [lat, lon, name] of X_LOCS) {
        await pool.query(
            'INSERT INTO map_markers (name, marker_type, lat, lon) VALUES ($1, $2, $3, $4)',
            [name, 'x', lat, lon]
        );
    }

    console.log(`시딩 완료: 라인 ${LINES.length}개, 마커 ${CIRCLE_LOCS.length + X_LOCS.length}개`);
    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
