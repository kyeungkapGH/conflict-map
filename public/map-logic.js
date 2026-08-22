/**
 * @file map-logic.js
 * @description 전술 지도 애플리케이션 진입점
 *   - OpenLayers 지도 초기화
 *   - 서버에서 상황 데이터 로드 및 페이지 타입 분기
 * @requires ol, constants.js, map-styles.js, map-markers.js, map-crud.js
 */

/** @type {ol.Map} 전역 지도 인스턴스 */
let map;

/** @type {ol.source.Vector} 전역 벡터 소스 (마커/레이어 저장소) */
let vectorSource;

/** @type {Object[]} 서버에서 로드한 전체 상황 데이터 캐시 */
let allData = [];

/** @type {Object[]} 서버에서 로드한 지형지물 라인 캐시 (map_lines) */
let mapLines = [];

/** @type {Object[]} 서버에서 로드한 점령지 마커 캐시 (map_markers) */
let mapMarkers = [];

// ─────────────────────────────────────────
// 1. 초기화
// ─────────────────────────────────────────

window.onload = async function () {
    _initDateInput();
    _initMap();
    await _loadMapFeatures();
    await loadFromServer();
    _initNameAutocomplete();
};

/**
 * 지형지물 라인/마커(map_lines, map_markers)를 로드한다.
 * 날짜 필터와 무관하게 고정된 지형지물이라 최초 1회만 불러온다.
 * @private
 */
async function _loadMapFeatures() {
    try {
        const [linesRes, markersRes] = await Promise.all([
            fetch('./api/lines'),
            fetch('./api/markers'),
        ]);
        mapLines = await linesRes.json();
        mapMarkers = await markersRes.json();
    } catch (err) {
        console.error('지형지물 데이터 로드 실패:', err);
    }
}

/**
 * 날짜 입력창이 있는 경우 오늘 날짜로 초기화한다. (index.html 전용)
 * @private
 */
function _initDateInput() {
    const dateInput = document.getElementById('date-input');
    if (dateInput) {
        // toISOString() 대신 로컬 시간을 반영하는 sv-SE 로캘 사용
        const today = new Date().toLocaleDateString('sv-SE');
        dateInput.value = today;
    }
}

/**
 * OpenLayers 지도와 벡터 레이어를 초기화한다.
 * @private
 */
function _initMap() {
    vectorSource = new ol.source.Vector();

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM({ crossOrigin: 'anonymous' }),
            }),
            new ol.layer.Vector({ source: vectorSource }),
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([35.463, 33.22]),
            zoom: 11.5,
        }),
    });
}

/**
 * 이름 입력창에 자동완성 기능을 연결한다.
 * 기존 데이터와 일치하는 이름 입력 시 좌표를 자동으로 채워준다. (index.html 전용)
 * @private
 */
function _initNameAutocomplete() {
    const nameInput   = document.getElementById('name-input');
    const coordsInput = document.getElementById('coords-input');
    if (!nameInput || !coordsInput) return;

    nameInput.addEventListener('input', (e) => {
        const entry = allData.find((item) => item.name === e.target.value);
        if (entry?.dms_string) {
            coordsInput.value = entry.dms_string;
        }
    });
}

// ─────────────────────────────────────────
// 2. 데이터 로드
// ─────────────────────────────────────────

/**
 * 서버에서 전체 상황 데이터를 로드한 후 페이지 타입에 맞게 렌더링한다.
 *   - 슬라이더(#date-slider)가 있으면: 날짜 필터 모드 (index.html)
 *   - 없으면: 전체 데이터 표시 모드 (target.html 등)
 */
async function loadFromServer() {
    try {
        const response = await fetch(API_URL);
        allData = await response.json();

        updateAutocomplete(allData);

        const dateSlider = document.getElementById('date-slider');
        if (dateSlider) {
            // index.html: 슬라이더 현재 값으로 날짜 필터 적용
            handleSliderChange(dateSlider.value);
        } else {
            // target.html 등: 전체 데이터 렌더링
            updateMapMarkers(allData);
            renderList(allData);
        }
    } catch (err) {
        console.error('데이터 로드 실패:', err);
    }
}