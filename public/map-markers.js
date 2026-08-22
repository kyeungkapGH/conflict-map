/**
 * @file map-markers.js
 * @description 지도 위에 Feature(마커, 라인, 반경원 등)를 추가하는 렌더링 함수 모음
 * @requires ol, constants.js, map-styles.js
 */

// ─────────────────────────────────────────
// 1. 기본 마커 추가
// ─────────────────────────────────────────

let analyzedLocations = new Set();

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
// 2. 지형지물 레이어
// ─────────────────────────────────────────

/** 리타니 강 라인 및 이름 라벨을 지도에 추가한다. */
function addRiverLayer() {
    // 강 경로 라인
    const lineCoords = LITANI_RIVER_COORDS.map(([lat, lon]) => ol.proj.fromLonLat([lon, lat]));
    const riverFeature = new ol.Feature({ geometry: new ol.geom.LineString(lineCoords) });
    riverFeature.setStyle(litaniStyle);
    vectorSource.addFeature(riverFeature);

    // 강 이름 라벨
    const labelFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([35.272, 33.313])),
    });
    labelFeature.setStyle(new ol.style.Style({
        text: new ol.style.Text({
            text: '리타니 강',
            font: 'bold 14px sans-serif',
            fill: new ol.style.Fill({ color: '#0056b3' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
        }),
    }));
    vectorSource.addFeature(labelFeature);
}

/** 휴전선 및 이름 라벨을 지도에 추가한다. */
function addLineLayer() {
    // YELLOW LINE
    const bufferCoords = YELLOW_LINE_COORDS.map(([lat, lon]) => ol.proj.fromLonLat([lon, lat]));
    const bufferFeature = new ol.Feature({ geometry: new ol.geom.LineString(bufferCoords) });
    bufferFeature.setStyle(yellowLineStyle);
    vectorSource.addFeature(bufferFeature);

    const labelFeature1 = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([35.29172317133812, 33.17681209979992])),
    });
    labelFeature1.setStyle(new ol.style.Style({
        text: new ol.style.Text({
            text: 'Yellow Line',
            font: 'bold 14px sans-serif',
            fill: new ol.style.Fill({ color: 'hsla(44, 100%, 48%, 0.99)' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
        }),
    }));
    vectorSource.addFeature(labelFeature1);

    // BLUE
    const blueCoords = BLUE_LINE_COORDS.map(([lat, lon]) => ol.proj.fromLonLat([lon, lat]));
    const blueFeature = new ol.Feature({ geometry: new ol.geom.LineString(blueCoords) });
    blueFeature.setStyle(blueLineStyle);
    vectorSource.addFeature(blueFeature);

    const labelFeature2 = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([35.19231954922473, 33.07802407940353])),
    });
    labelFeature2.setStyle(new ol.style.Style({
        text: new ol.style.Text({
            text: 'BLUE Line',
            font: 'bold 14px sans-serif',
            fill: new ol.style.Fill({ color: 'rgba(0, 0, 255, 0.6)' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
        }),
    }));
    vectorSource.addFeature(labelFeature2);
}

/** 51번 국도 라인 및 이름 라벨을 지도에 추가한다. */
function addRoute51Layer() {
    if (typeof ROUTE_51_COORDS === 'undefined') return;

    // 국도 경로 라인
    const routeCoords = ROUTE_51_COORDS.map(([lat, lon]) => ol.proj.fromLonLat([lon, lat]));
    const routeFeature = new ol.Feature({ geometry: new ol.geom.LineString(routeCoords) });
    routeFeature.setStyle(route51Style);
    vectorSource.addFeature(routeFeature);

    // 경로 중간 지점에 국도 이름 라벨 배치
    const midPoint = ROUTE_51_COORDS[Math.floor(ROUTE_51_COORDS.length / 2)];
    const routeLabelFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([midPoint[1], midPoint[0]])),
    });
    routeLabelFeature.setStyle(new ol.style.Style({
        text: new ol.style.Text({
            text: '51번 국도',
            font: 'bold 12px sans-serif',
            offsetY: -70, // 라인 위에 표시되도록 위로 오프셋
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
        }),
    }));
    vectorSource.addFeature(routeLabelFeature);
}

// ─────────────────────────────────────────
// 3. 기준점 및 반경 표시
// ─────────────────────────────────────────

/** 동명부대 마커 및 7km 경계 반경원을 지도에 추가한다. */
function addUnifilLayer() {
    // 동명부대 본부 마커
    addMarker(UNIFIL_COORDS, new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10,
            fill: new ol.style.Fill({ color: '#5B92E5' }),
            stroke: new ol.style.Stroke({ color: 'white', width: 2 }),
        }),
        text: createTextStyle('동명부대'),
    }));

    // 7km 반경 원 (경계 표시용)
    const circleGeom = ol.geom.Polygon.circular(UNIFIL_COORDS, 7000, 64)
        .transform('EPSG:4326', 'EPSG:3857');
    const radiusFeature = new ol.Feature({ geometry: circleGeom });
    radiusFeature.setStyle(new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(135, 206, 235, 0.2)' }),
        stroke: new ol.style.Stroke({ color: 'skyblue', width: 1.5 }),
    }));
    vectorSource.addFeature(radiusFeature);
}

// ─────────────────────────────────────────
// 4. 점령지 마커
// ─────────────────────────────────────────

/** 원형/X형 고정 점령지 마커를 지도에 추가한다. */
function addOccupiedLocationLayers(filteredData) {
    // 현재 필터된 데이터의 지명 목록
    const activeNames = new Set(
        filteredData.map(d => d.name.split('(')[0].trim())
    );

    if (typeof CIRCLE_LOCS !== 'undefined') {
        CIRCLE_LOCS.forEach(([lat, lon, name]) => {
            // 공습 대상이면 라벨 없이, 아니면 기존대로
            addMarker([lon, lat], circleStyle(activeNames.has(name) ? null : name));
        });
    }
    if (typeof X_LOCS !== 'undefined') {
        X_LOCS.forEach(([lat, lon, name]) => {
            addMarker([lon, lat], xStyle(activeNames.has(name) ? null : name));
        });
    }
}

// ─────────────────────────────────────────
// 5. 상황 데이터 마커
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
            // 기사 제목이 있는 경우: 폭발 e이미지 마커
            const iconSrc = (atk.includes('헤즈볼라') || atk.includes('레바논'))
                ? '/images/red-explosion.png'
                : '/images/blue-explosion.png';

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
            if (atk.includes('이스라엘') || atk.includes('미군')) color = '#1a73e8';
            else if (atk.includes('헤즈볼라') || atk.includes('레바논')) color = '#dc3545';
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

    addRiverLayer();
    addLineLayer();
    addRoute51Layer();
    addUnifilLayer();
    addOccupiedLocationLayers(filteredData);
    addSituationMarkers(filteredData);
}