/**
 * @file map-markers.js
 * @description 지도 위에 Feature(마커, 라인, 반경원 등)를 추가하는 렌더링 함수 모음
 * @requires ol, map-styles.js
 */

// ─────────────────────────────────────────
// 1. 기본 마커 추가
// ─────────────────────────────────────────

/**
 * vectorSource에 포인트 마커를 추가한다.
 *
 * @param {[number, number]} lonLat - [경도, 위도] 순서
 * @param {ol.style.Style} style - 적용할 OL 스타일
 */
function addMarker(lonLat, style) {
    const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(lonLat)),
    });
    feature.setStyle(style);
    vectorSource.addFeature(feature);
}

// ─────────────────────────────────────────
// 2. 지형지물 라인 (DB: map_lines)
// ─────────────────────────────────────────

/**
 * DB에서 불러온 지형지물 라인들(강/휴전선/도로 등)을 라벨과 함께 지도에 추가한다.
 *
 * @param {{ name: string, color: string, coordinates: [number, number][] }[]} lines
 *   coordinates는 [위도, 경도] 순서
 */
function addLinesLayer(lines) {
    lines.forEach((line) => {
        if (!Array.isArray(line.coordinates) || line.coordinates.length < 2) return;

        const lineCoords = line.coordinates.map(([lat, lon]) => ol.proj.fromLonLat([lon, lat]));
        const lineFeature = new ol.Feature({ geometry: new ol.geom.LineString(lineCoords) });
        lineFeature.setStyle(lineStyle(line.color));
        vectorSource.addFeature(lineFeature);

        // 라벨: 라인 중간 지점에 배치
        const midPoint = line.coordinates[Math.floor(line.coordinates.length / 2)];
        const labelFeature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([midPoint[1], midPoint[0]])),
        });
        labelFeature.setStyle(new ol.style.Style({
            text: new ol.style.Text({
                text: line.name,
                font: 'bold 14px sans-serif',
                fill: new ol.style.Fill({ color: line.color }),
                stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
            }),
        }));
        vectorSource.addFeature(labelFeature);
    });
}

// ─────────────────────────────────────────
// 3. 점령지 마커 (DB: map_markers)
// ─────────────────────────────────────────

/**
 * DB에서 불러온 원형/X형 점령지 마커를 지도에 추가한다.
 *
 * @param {{ name: string, marker_type: 'circle'|'x', lat: number, lon: number }[]} markers
 * @param {{ name: string }[]} filteredData - 현재 필터된 상황 데이터 (공습 대상이면 라벨 생략)
 */
function addOccupiedLocationLayers(markers, filteredData) {
    const activeNames = new Set(
        filteredData.map(d => d.name.split('(')[0].trim())
    );

    markers.forEach((m) => {
        const label = activeNames.has(m.name) ? null : m.name;
        const style = m.marker_type === 'x' ? xStyle(label) : circleStyle(label);
        addMarker([m.lon, m.lat], style);
    });
}

// ─────────────────────────────────────────
// 4. 상황 데이터 마커
// ─────────────────────────────────────────

/**
 * 공격 주체에 따라 마커 색상을 결정하여 상황 데이터를 지도에 표시한다.
 *
 * @param {{ name: string, lat: string|number, lon: string|number, attacker: string }[]} data
 */
function addSituationMarkers(data) {
    data.forEach((item) => {
        const atk = item.attacker || '';
        let style;

        if (item.detail_info?.trim()) {
            // 기사 제목이 있는 경우: 폭발 이미지 마커
            const iconSrc = (atk.includes('우크라이나'))
                ? './images/red-explosion.png'
                : './images/blue-explosion.png';

            style = new ol.style.Style({
                image: new ol.style.Icon({
                    src: iconSrc,
                    scale: 0.75,
                    anchor: [0.5, 0.5],
                }),
                text: new ol.style.Text({
                    text: extractName(item.name),
                    font: 'bold 15px sans-serif',
                    textAlign: 'left',
                    textBaseline: 'middle',
                    offsetX: 30,
                    offsetY: 0,
                    fill: new ol.style.Fill({ color: '#000' }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
                }),
            });
        } else {
            // 기사 제목 없는 경우: 기존 원형 마커
            let color = '#333';
            if (atk.includes('러시아')) color = '#1a73e8';
            else if (atk.includes('우크라이나')) color = '#dc3545';
            style = defaultMarkerStyle(item.name, color);
        }

        addMarker([parseFloat(item.lon), parseFloat(item.lat)], style);
    });
}

// ─────────────────────────────────────────
// 6. 전체 지도 마커 갱신
// ─────────────────────────────────────────

/**
 * vectorSource를 초기화하고 모든 레이어와 상황 마커를 다시 렌더링한다.
 *
 * @param {{ name: string, lat: string|number, lon: string|number, attacker: string }[]} filteredData
 *   현재 필터 조건에 맞는 상황 데이터 목록
 */
function updateMapMarkers(filteredData) {
    if (!vectorSource) return;
    vectorSource.clear();

    addLinesLayer(mapLines);
    addOccupiedLocationLayers(mapMarkers, filteredData);
    addSituationMarkers(filteredData);
}
