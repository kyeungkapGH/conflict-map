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
 * @param {ol.style.Style|ol.style.Style[]} style - 적용할 OL 스타일.
 *   번호처럼 겹쳐 그릴 요소가 있으면 배열로 넘긴다.
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

/** 공격 주체별 번호 색상. 폭발 아이콘 색과 맞춘다. */
const SIDE_NUMBER_COLOR = { red: '#e01010', blue: '#0d0dc0' };

/**
 * 기사 제목이 있는 기록에 번호를 매긴다. 공격 주체별로 따로 세고 시간이 이른 쪽이 1번이다.
 *
 * 정렬 기준이 어긋나면 지도와 복붙용 표의 번호가 달라지므로, 표를 만들 때 쓰는
 * popup-table.js의 함수를 그대로 쓴다. 두 화면이 보는 데이터도 같은 날짜로
 * 걸러진 같은 목록이다.
 *
 * @param {object[]} data - 현재 날짜로 필터된 상황 데이터
 * @returns {Map<object, number>} 기록 → 번호
 */
function numberSituations(data) {
    const rows = data
        .filter((it) => it.detail_info?.trim())
        .map((it) => ({ item: it, attacker: normalizeAttacker(it.attacker) }))
        .sort((a, b) => {
            const byAttacker = attackerPriority(a.attacker) - attackerPriority(b.attacker);
            if (byAttacker !== 0) return byAttacker;

            return timeToNumber(parseTitle(a.item.detail_info).time)
                - timeToNumber(parseTitle(b.item.detail_info).time);
        });

    const counter = new Map();
    const numbers = new Map();
    for (const row of rows) {
        const next = (counter.get(row.attacker) || 0) + 1;
        counter.set(row.attacker, next);
        numbers.set(row.item, next);
    }

    return numbers;
}

/**
 * 공격 주체에 따라 마커 색상을 결정하여 상황 데이터를 지도에 표시한다.
 *
 * @param {{ name: string, lat: string|number, lon: string|number, attacker: string }[]} data
 */
function addSituationMarkers(data) {
    const numbers = numberSituations(data);

    // 같은 좌표의 기록을 한 지점으로 묶는다. 묶지 않으면 양측이 같은 곳을 쳤을 때
    // 빨강·파랑 마커가 같은 자리에 겹쳐 그려져, 나중에 그린 쪽만 보인다.
    const groups = new Map();
    for (const item of data) {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
        if (!groups.has(key)) groups.set(key, { lat, lon, items: [] });
        groups.get(key).items.push(item);
    }

    for (const g of groups.values()) {
        const withArticle = g.items.filter((it) => it.detail_info?.trim());

        // 기사 제목이 있는 경우: 폭발 이미지 마커.
        // 한 지점을 양측이 공격했으면 좌우를 반씩 합친 아이콘을 쓴다.
        if (withArticle.length) {
            // 같은 지점이라도 번호는 공격 주체별로 모은다.
            const sides = new Map();
            for (const it of withArticle) {
                const atk = normalizeAttacker(it.attacker);
                const side = atk.includes('러시아') ? 'red' : 'blue';

                if (!sides.has(side)) sides.set(side, { priority: attackerPriority(atk), nums: [] });
                const info = sides.get(side);
                info.priority = Math.min(info.priority, attackerPriority(atk));
                info.nums.push(numbers.get(it));
            }

            const iconSrc = (sides.has('red') && sides.has('blue'))
                ? './images/half-explosion.png'
                : sides.has('red')
                    ? './images/red-explosion.png'
                    : './images/blue-explosion.png';

            const styles = [new ol.style.Style({
                image: new ol.style.Icon({
                    src: iconSrc,
                    scale: 0.75,
                    anchor: [0.5, 0.5],
                }),
                text: new ol.style.Text({
                    text: extractName(withArticle[0].name),
                    font: 'bold 15px sans-serif',
                    textAlign: 'left',
                    textBaseline: 'middle',
                    offsetX: 30,
                    offsetY: 0,
                    fill: new ol.style.Fill({ color: '#000' }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
                }),
            })];

            // 번호는 지명 라벨과 겹치지 않게 아이콘 왼쪽에 둔다.
            // 양측이 쳤으면 표에 실리는 순서대로 위아래로 나눈다.
            const ordered = [...sides].sort((a, b) => a[1].priority - b[1].priority);
            ordered.forEach(([side, info], idx) => {
                const offsetY = ordered.length === 1 ? 0 : (idx === 0 ? -11 : 11);
                const label = info.nums.sort((x, y) => x - y).join(',');
                styles.push(situationNumberStyle(label, SIDE_NUMBER_COLOR[side], offsetY));
            });

            addMarker([g.lon, g.lat], styles);
        }

        // 기사 제목 없는 경우: 기존 원형 마커
        for (const it of g.items) {
            if (it.detail_info?.trim()) continue;
            const atk = it.attacker || '';
            let color = '#333';
            if (atk.includes('러시아')) color = '#dc3545';
            else if (atk.includes('우크라이나')) color = '#1a73e8';
            addMarker([g.lon, g.lat], defaultMarkerStyle(it.name, color));
        }
    }
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
