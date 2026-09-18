/**
 * @file history.js
 * @description 누적 지도. 등록된 모든 상황을 좌표별로 묶어 한 화면에 표시하고,
 *              마커를 클릭하면 그 지점의 기록을 시간순 타임라인으로 보여준다.
 * @requires ol, map-styles.js (extractName)
 */

const API_URL = './api/locations';

/** 이 지역에서 '빨강' 진영으로 볼 공격 주체. map-markers.js의 색상 규칙과 같은 기준이다. */
const isRedSide = (attacker) => attacker.includes('헤즈볼라') || attacker.includes('레바논');

let map;
let vectorSource;

/** @type {Map<string, {lat:number, lon:number, name:string, items:Object[]}>} 좌표별 묶음 */
const groups = new Map();

window.onload = async function () {
    _initMap();
    await _load();
};

function _initMap() {
    vectorSource = new ol.source.Vector();

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({ source: new ol.source.OSM({ crossOrigin: 'anonymous' }) }),
            new ol.layer.Vector({ source: vectorSource }),
        ],
        view: new ol.View({ center: ol.proj.fromLonLat([0, 20]), zoom: 2 }),
    });

    map.on('click', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
        if (feature && feature.get('groupKey')) showTimeline(feature.get('groupKey'));
    });

    // 마커 위에서만 포인터 커서로 바꿔 클릭 가능함을 알린다.
    map.on('pointermove', (evt) => {
        if (evt.dragging) return;
        const hit = map.hasFeatureAtPixel(evt.pixel);
        map.getTargetElement().classList.toggle('clickable', hit);
    });
}

async function _load() {
    let data;
    try {
        const res = await fetch(API_URL);
        data = await res.json();
    } catch (err) {
        console.error('데이터 로드 실패:', err);
        document.getElementById('tl-body').innerHTML =
            '<p class="tl-empty">데이터를 불러오지 못했습니다.</p>';
        return;
    }

    // 좌표가 같으면 한 지점으로 본다. 부동소수 표기 차이를 없애려고 6자리로 맞춘다.
    for (const item of data) {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
        if (!groups.has(key)) groups.set(key, { lat, lon, name: item.name || '', items: [] });
        groups.get(key).items.push(item);
    }

    // 각 지점의 대표 이름은 가장 최근 기록의 것을 쓴다.
    for (const g of groups.values()) {
        g.items.sort((a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')));
        g.name = g.items[g.items.length - 1].name || g.name;
    }

    _renderMarkers();
    _renderSummary(data.length);
    _fitToData();
}

/** 지점에 섞인 진영에 따라 아이콘을 고른다. 두 진영이 공존하면 반반 이미지를 쓴다. */
function _iconFor(items) {
    let red = false;
    let blue = false;
    for (const it of items) {
        if (isRedSide(it.attacker || '')) red = true;
        else blue = true;
    }
    if (red && blue) return './images/half-explosion.png';
    return red ? './images/red-explosion.png' : './images/blue-explosion.png';
}

function _renderMarkers() {
    for (const [key, g] of groups) {
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([g.lon, g.lat])),
        });
        feature.set('groupKey', key);

        const label = (typeof extractName === 'function' ? extractName(g.name) : g.name) || g.name;
        const count = g.items.length;

        feature.setStyle(new ol.style.Style({
            image: new ol.style.Icon({ src: _iconFor(g.items), scale: 0.62, anchor: [0.5, 0.5] }),
            text: new ol.style.Text({
                text: count > 1 ? `${label} (${count})` : label,
                font: 'bold 13px sans-serif',
                textAlign: 'left',
                textBaseline: 'middle',
                offsetX: 22,
                offsetY: 0,
                fill: new ol.style.Fill({ color: '#000' }),
                stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
            }),
        }));

        vectorSource.addFeature(feature);
    }
}

function _renderSummary(total) {
    document.getElementById('tl-summary').innerHTML =
        `<strong>${groups.size}</strong>개 지점 · 총 <strong>${total}</strong>건` +
        `<div style="margin-top:8px">` +
        `<span class="legend"><img src="./images/red-explosion.png" alt="">헤즈볼라</span>` +
        `<span class="legend"><img src="./images/blue-explosion.png" alt="">이스라엘군</span>` +
        `<span class="legend"><img src="./images/half-explosion.png" alt="">양측</span>` +
        `</div>`;
}

/** 모든 마커가 한 화면에 들어오도록 시야를 맞춘다. */
function _fitToData() {
    if (!vectorSource.getFeatures().length) return;
    map.getView().fit(vectorSource.getExtent(), {
        size: map.getSize(),
        padding: [60, 60, 60, 60],
        maxZoom: 12,
    });
}

function showTimeline(key) {
    const g = groups.get(key);
    if (!g) return;

    const label = (typeof extractName === 'function' ? extractName(g.name) : g.name) || '(이름 없음)';
    const rows = g.items.map((it) => {
        const red = isRedSide(it.attacker || '');
        const when = (it.occurred_at || '').replace('T', ' ').slice(0, 16) || '일시 미상';
        const who = it.attacker || '주체 미상';
        const detail = (it.detail_info || '').trim();
        const body = detail
            ? `<p class="tl-detail clamped" onclick="this.classList.toggle('clamped')">${_esc(detail)}</p>`
              + `<div class="tl-more" onclick="this.previousElementSibling.classList.toggle('clamped')">펼치기 / 접기</div>`
            : `<p class="tl-none">기사 내용 없음</p>`;

        return `<li class="tl-item ${red ? 'red' : 'blue'}">`
            + `<span class="tl-when">${_esc(when)}</span>`
            + `<span class="tl-who">${_esc(who)}</span>`
            + body
            + `</li>`;
    }).join('');

    document.getElementById('tl-body').innerHTML =
        `<p class="tl-place">${_esc(label)}</p>`
        + `<p class="tl-place-sub">${_esc(g.name)}<br>${g.lat.toFixed(5)}, ${g.lon.toFixed(5)} · ${g.items.length}건</p>`
        + `<ul class="tl-list">${rows}</ul>`;
    document.getElementById('tl-body').scrollTop = 0;
}

function _esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
