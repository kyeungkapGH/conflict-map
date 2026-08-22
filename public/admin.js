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
};
