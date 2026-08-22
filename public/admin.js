/**
 * @file admin.js
 * @description 상황 데이터 관리(조회/수정/삭제) 페이지 로직
 */

const API_URL = './api/locations';
const PAGE_SIZE = 50;

let allData = [];
let filteredData = [];
let currentPage = 1;

// ─────────────────────────────────────────
// 1. 데이터 로드
// ─────────────────────────────────────────

async function loadData() {
    const res = await fetch(API_URL);
    allData = await res.json();
    applyFilter();
}

function applyFilter() {
    const keyword = document.getElementById('search-input').value.trim().toLowerCase();

    filteredData = keyword
        ? allData.filter((item) =>
            [item.name, item.attacker, item.detail_info].some((field) =>
                (field || '').toLowerCase().includes(keyword)
            ))
        : allData;

    currentPage = 1;
    renderTable();
}

// ─────────────────────────────────────────
// 2. 테이블 렌더링
// ─────────────────────────────────────────

function renderTable() {
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';

    const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredData.slice(start, start + PAGE_SIZE);

    pageItems.forEach((item) => tbody.appendChild(buildRow(item)));

    document.getElementById('result-count').textContent = `총 ${filteredData.length}건`;
    document.getElementById('page-info').textContent = `${currentPage} / ${totalPages} 페이지`;
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function buildRow(item) {
    const tr = document.createElement('tr');

    const cell = (text) => {
        const td = document.createElement('td');
        td.textContent = text ?? '';
        return td;
    };

    tr.appendChild(cell(item.id));
    tr.appendChild(cell(item.name));
    tr.appendChild(cell(item.dms_string || `${item.lat}, ${item.lon}`));
    tr.appendChild(cell(item.attacker));
    tr.appendChild(cell((item.occurred_at || '').substring(0, 16)));

    const detailCell = cell(item.detail_info);
    detailCell.className = 'col-detail';
    tr.appendChild(detailCell);

    const actionCell = document.createElement('td');
    actionCell.className = 'col-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', () => openEditModal(item));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', () => deleteItem(item.id));

    actionCell.appendChild(editBtn);
    actionCell.appendChild(deleteBtn);
    tr.appendChild(actionCell);

    return tr;
}

// ─────────────────────────────────────────
// 3. 수정 모달
// ─────────────────────────────────────────

function openEditModal(item) {
    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-name').value = item.name || '';
    document.getElementById('edit-coords').value = item.dms_string || `${item.lat}, ${item.lon}`;
    document.getElementById('edit-detail').value = item.detail_info || '';

    const matchingRadio = document.querySelector(
        `input[name="edit-attacker-radio"][value="${item.attacker}"]`
    );
    document.querySelectorAll('input[name="edit-attacker-radio"]').forEach((r) => (r.checked = false));
    if (matchingRadio) matchingRadio.checked = true;

    if (item.occurred_at) {
        const [datePart, timePart] = item.occurred_at.split(/[T ]/);
        document.getElementById('edit-date').value = datePart || '';
        document.getElementById('edit-time').value = (timePart || '').substring(0, 5);
    }

    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
    const id = document.getElementById('edit-id').value;
    const coords = document.getElementById('edit-coords').value.split(',').map((p) => parseFloat(p.trim()));
    const checkedRadio = document.querySelector('input[name="edit-attacker-radio"]:checked');
    const date = document.getElementById('edit-date').value;
    const time = document.getElementById('edit-time').value;

    const payload = {
        name: document.getElementById('edit-name').value,
        dms_string: document.getElementById('edit-coords').value,
        lat: coords[0],
        lon: coords[1],
        attacker: checkedRadio ? checkedRadio.value : '',
        detail_info: document.getElementById('edit-detail').value,
        occurred_at: date && time ? `${date} ${time}:00` : null,
    };

    try {
        const res = await fetch(`${API_URL}/update?id=${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            alert('수정 실패');
            return;
        }
        closeEditModal();
        await loadData();
    } catch (err) {
        console.error('수정 실패:', err);
        alert('수정 중 오류가 발생했습니다.');
    }
}

// ─────────────────────────────────────────
// 4. 삭제
// ─────────────────────────────────────────

async function deleteItem(id) {
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(`${API_URL}/delete?id=${id}`, { method: 'POST' });
        if (res.ok) await loadData();
    } catch (err) {
        console.error('삭제 실패:', err);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// ─────────────────────────────────────────
// 5. 초기화
// ─────────────────────────────────────────

window.onload = function () {
    loadData();

    document.getElementById('search-input').addEventListener('input', applyFilter);
    document.getElementById('prev-page').addEventListener('click', () => {
        currentPage -= 1;
        renderTable();
    });
    document.getElementById('next-page').addEventListener('click', () => {
        currentPage += 1;
        renderTable();
    });
    document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
    document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);

    initTabs();
    initLinesTab();
    initMarkersTab();
};

// ─────────────────────────────────────────
// 6. 탭 전환
// ─────────────────────────────────────────

function initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            buttons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.add('hidden'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
        });
    });
}

// ─────────────────────────────────────────
// 7. 지형지물 라인 관리 (map_lines)
// ─────────────────────────────────────────

const LINES_URL = './api/lines';
let allLines = [];

function initLinesTab() {
    loadLines();
    document.getElementById('add-line-btn').addEventListener('click', () => openLineModal(null));
    document.getElementById('line-save-btn').addEventListener('click', saveLine);
    document.getElementById('line-cancel-btn').addEventListener('click', closeLineModal);
}

async function loadLines() {
    const res = await fetch(LINES_URL);
    allLines = await res.json();
    renderLineTable();
}

function renderLineTable() {
    const tbody = document.getElementById('line-tbody');
    tbody.innerHTML = '';

    allLines.forEach((line) => {
        const tr = document.createElement('tr');

        const idCell = document.createElement('td');
        idCell.textContent = line.id;

        const nameCell = document.createElement('td');
        nameCell.textContent = line.name;

        const colorCell = document.createElement('td');
        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = line.color;
        colorCell.appendChild(swatch);
        colorCell.appendChild(document.createTextNode(line.color));

        const countCell = document.createElement('td');
        countCell.textContent = `${line.coordinates.length}개`;

        const actionCell = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '수정';
        editBtn.addEventListener('click', () => openLineModal(line));
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '삭제';
        deleteBtn.addEventListener('click', () => deleteLine(line.id));
        actionCell.appendChild(editBtn);
        actionCell.appendChild(deleteBtn);

        tr.appendChild(idCell);
        tr.appendChild(nameCell);
        tr.appendChild(colorCell);
        tr.appendChild(countCell);
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
    });

    document.getElementById('line-count').textContent = `총 ${allLines.length}개`;
}

function openLineModal(line) {
    document.getElementById('line-modal-title').textContent = line ? '📝 라인 수정' : '📝 라인 추가';
    document.getElementById('line-id').value = line ? line.id : '';
    document.getElementById('line-name').value = line ? line.name : '';
    document.getElementById('line-color').value = line ? line.color : 'rgba(0, 100, 255, 0.6)';
    document.getElementById('line-coords').value = line
        ? line.coordinates.map(([lat, lon]) => `${lat}, ${lon}`).join('\n')
        : '';
    document.getElementById('line-modal').classList.remove('hidden');
}

function closeLineModal() {
    document.getElementById('line-modal').classList.add('hidden');
}

function parseCoordsTextarea(text) {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(',').map((p) => parseFloat(p.trim())))
        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

async function saveLine() {
    const id = document.getElementById('line-id').value;
    const coordinates = parseCoordsTextarea(document.getElementById('line-coords').value);

    if (coordinates.length < 2) {
        alert('좌표를 2개 이상 "위도, 경도" 형식으로 한 줄에 하나씩 입력해주세요.');
        return;
    }

    const payload = {
        name: document.getElementById('line-name').value,
        color: document.getElementById('line-color').value || 'rgba(0, 100, 255, 0.6)',
        coordinates,
    };

    if (!payload.name) {
        alert('이름을 입력해주세요.');
        return;
    }

    const url = id ? `${LINES_URL}/update?id=${id}` : LINES_URL;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            alert('저장 실패');
            return;
        }
        closeLineModal();
        await loadLines();
    } catch (err) {
        console.error('라인 저장 실패:', err);
        alert('저장 중 오류가 발생했습니다.');
    }
}

async function deleteLine(id) {
    if (!confirm('이 라인을 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(`${LINES_URL}/delete?id=${id}`, { method: 'POST' });
        if (res.ok) await loadLines();
    } catch (err) {
        console.error('라인 삭제 실패:', err);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// ─────────────────────────────────────────
// 8. 점령지 마커 관리 (map_markers)
// ─────────────────────────────────────────

const MARKERS_URL = './api/markers';
let allMarkers = [];

function initMarkersTab() {
    loadMarkers();
    document.getElementById('add-marker-btn').addEventListener('click', () => openMarkerModal(null));
    document.getElementById('marker-save-btn').addEventListener('click', saveMarker);
    document.getElementById('marker-cancel-btn').addEventListener('click', closeMarkerModal);
}

async function loadMarkers() {
    const res = await fetch(MARKERS_URL);
    allMarkers = await res.json();
    renderMarkerTable();
}

function renderMarkerTable() {
    const tbody = document.getElementById('marker-tbody');
    tbody.innerHTML = '';

    allMarkers.forEach((marker) => {
        const tr = document.createElement('tr');

        const cell = (text) => {
            const td = document.createElement('td');
            td.textContent = text;
            return td;
        };

        tr.appendChild(cell(marker.id));
        tr.appendChild(cell(marker.name));
        tr.appendChild(cell(marker.marker_type === 'x' ? 'X형' : '원형'));
        tr.appendChild(cell(`${marker.lat}, ${marker.lon}`));

        const actionCell = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '수정';
        editBtn.addEventListener('click', () => openMarkerModal(marker));
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '삭제';
        deleteBtn.addEventListener('click', () => deleteMarker(marker.id));
        actionCell.appendChild(editBtn);
        actionCell.appendChild(deleteBtn);
        tr.appendChild(actionCell);

        tbody.appendChild(tr);
    });

    document.getElementById('marker-count').textContent = `총 ${allMarkers.length}개`;
}

function openMarkerModal(marker) {
    document.getElementById('marker-modal-title').textContent = marker ? '📝 마커 수정' : '📝 마커 추가';
    document.getElementById('marker-id').value = marker ? marker.id : '';
    document.getElementById('marker-name').value = marker ? marker.name : '';
    document.getElementById('marker-coords').value = marker ? `${marker.lat}, ${marker.lon}` : '';

    const type = marker ? marker.marker_type : 'circle';
    document.querySelector(`input[name="marker-type-radio"][value="${type}"]`).checked = true;

    document.getElementById('marker-modal').classList.remove('hidden');
}

function closeMarkerModal() {
    document.getElementById('marker-modal').classList.add('hidden');
}

async function saveMarker() {
    const id = document.getElementById('marker-id').value;
    const coords = document.getElementById('marker-coords').value.split(',').map((p) => parseFloat(p.trim()));
    const checkedType = document.querySelector('input[name="marker-type-radio"]:checked').value;

    if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
        alert('좌표를 "위도, 경도" 형식으로 입력해주세요.');
        return;
    }

    const payload = {
        name: document.getElementById('marker-name').value,
        marker_type: checkedType,
        lat: coords[0],
        lon: coords[1],
    };

    if (!payload.name) {
        alert('이름을 입력해주세요.');
        return;
    }

    const url = id ? `${MARKERS_URL}/update?id=${id}` : MARKERS_URL;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            alert('저장 실패');
            return;
        }
        closeMarkerModal();
        await loadMarkers();
    } catch (err) {
        console.error('마커 저장 실패:', err);
        alert('저장 중 오류가 발생했습니다.');
    }
}

async function deleteMarker(id) {
    if (!confirm('이 마커를 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(`${MARKERS_URL}/delete?id=${id}`, { method: 'POST' });
        if (res.ok) await loadMarkers();
    } catch (err) {
        console.error('마커 삭제 실패:', err);
        alert('삭제 중 오류가 발생했습니다.');
    }
}
