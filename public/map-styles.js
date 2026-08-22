/**
 * @file map-styles.js
 * @description OpenLayers 지도에서 사용하는 Feature 스타일 정의 모음
 * @requires ol (OpenLayers 8.x)
 */

// ─────────────────────────────────────────
// 1. 공통 텍스트 스타일
// ─────────────────────────────────────────

/**
 * 마커 라벨 텍스트 스타일을 생성한다.
 * 괄호가 포함된 이름은 괄호 앞 부분만 표시한다.
 *
 * @param {string} text - 표시할 라벨 문자열
 * @returns {ol.style.Text | null} OL Text 스타일, 텍스트가 없으면 null
 */
const createTextStyle = (text) => {
    if (!text) return null;

    const displayName = extractName(text);

    return new ol.style.Text({
        text: displayName,
        font: 'bold 13px sans-serif',
        textAlign: 'left',
        textBaseline: 'middle',
        offsetX: 15,
        offsetY: 0,
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
    });
};

const extractName = (text) => {
    if (!text) return text;

    let result;

    // 1. '구', '주' 기준
    const keywords = ['구 ', '주 ', '북부', '시 '];

    let lastIndex = -1;
    let found = null;

    keywords.forEach(k => {
        const idx = text.lastIndexOf(k);

        // 키워드가 존재하고, 문자열 끝이 아닐 때만 유효
        if (idx !== -1 && idx + k.length < text.length) {
            if (idx > lastIndex) {
                lastIndex = idx;
                found = k;
            }
        }
    });

    if (found) {
        result = text.slice(lastIndex + found.length).trim();
    } else {
        result = text;
    }

    // 3. 한글 + 공백만 남기기
    result = result
        .replace(/[^가-힣\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    /*
    if (result.endsWith(" 마을")) {
        // "농업 마을"로 끝나지 않을 때만 자르기
        if (!result.endsWith("농업 마을")) {
            result = result.slice(0, -3).trim();
        }
    } else if (result.endsWith("마을")) {
        // 공백 없는 "마을"로 끝날 경우 처리
        if (!result.endsWith("농업마을")) {
            result = result.slice(0, -2).trim();
        }
    }
    */

    return result;
};

// ─────────────────────────────────────────
// 2. 지형지물 라인 스타일
// ─────────────────────────────────────────

/**
 * DB(map_lines)에서 불러온 지형지물 라인의 스타일을 생성한다.
 *
 * @param {string} color - CSS color (예: 'rgba(0, 100, 255, 0.6)')
 * @returns {ol.style.Style}
 */
const lineStyle = (color) => new ol.style.Style({
    stroke: new ol.style.Stroke({
        color,
        width: 5,
        lineCap: 'round',
        lineJoin: 'round',
    }),
});

// ─────────────────────────────────────────
// 3. 마커 스타일 팩토리
// ─────────────────────────────────────────

/**
 * 원형(Circle) 마커 스타일을 생성한다. (지상군 점령지용)
 *
 * @param {string} label - 마커 라벨
 * @returns {ol.style.Style}
 */
const circleStyle = (label) => new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.1)' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 3 }),
    }),
    text: createTextStyle(label),
});

/**
 * X형 마커 스타일을 생성한다. (지상군 점령지용)
 *
 * @param {string} label - 마커 라벨
 * @returns {ol.style.Style}
 */
const xStyle = (label) => new ol.style.Style({
    image: new ol.style.RegularShape({
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 3 }),
        points: 4,
        radius: 12,
        radius2: 0,
        angle: Math.PI / 4,
    }),
    text: createTextStyle(label),
});

/**
 * 상황 데이터용 기본 원형 마커 스타일을 생성한다.
 *
 * @param {string} label - 마커 라벨
 * @param {string} color - 마커 채우기 색상 (CSS color)
 * @returns {ol.style.Style}
 */
const defaultMarkerStyle = (label, color) => new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color }),
        stroke: new ol.style.Stroke({ color: 'white', width: 2 }),
    }),
    text: createTextStyle(label),
});