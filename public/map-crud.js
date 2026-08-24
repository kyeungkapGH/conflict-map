/**
 * @file map-crud.js
 * @description 상황 데이터 CRUD, 리스트 렌더링, 유틸리티 함수 모음
 */

const API_URL = './api/locations';

// ─────────────────────────────────────────
// 1. 데이터 저장 / 수정
// ─────────────────────────────────────────

/**
 * 입력 폼의 값을 읽어 서버에 저장(POST) 또는 수정(PUT) 요청을 보낸다.
 * edit-id가 있으면 PUT, 없으면 POST로 처리한다.
 */
async function handleSave() {
    const editIdEl = document.getElementById('edit-id');
    if (!editIdEl) return;

    const name = document.getElementById('name-input').value;
    const dms = document.getElementById('coords-input').value;
    const date = document.getElementById('date-input').value;
    const time = document.getElementById('time-input').value;
    const parts = dms.split(',').map((p) => parseFloat(p.trim()));
    const articleTitle = document.getElementById('detail-input')?.value || '';

    if (!isValidArticleTitle(articleTitle)) {
        return alert('기사 제목 형식이 올바르지 않습니다.');
    }

    const payload = {
        name,
        dms_string: dms,
        lat: parts[0],
        lon: parts[1],
        attacker: document.getElementById('attacker-input')?.value || '',
        detail_info: document.getElementById('detail-input')?.value || '',
        damage_info: document.getElementById('damage-input')?.value || '',
        occurred_at: `${date} ${time}:00`,
    };

    const editId = editIdEl.value;
    // PUT/DELETE를 막는 보안 장비가 있는 네트워크라 모든 요청을 POST로 보낸다.
    const url = editId ? `${API_URL}/update?id=${editId}` : API_URL;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            resetForm();
            loadFromServer();
        }
    } catch (error) {
        console.error('통신 에러:', error);
    }
}

/**
 * 기사 제목 형식 유효성 검사
 * parseAnalysisTitle과 동일한 조건: [괄호], 출처, 월.일.시:분 모두 존재해야 함
 *
 * @param {string} text
 * @returns {boolean}
 */
function isValidArticleTitle(text) {
    if (!text) return true; // 빈 값 허용

    // 1. ". " 으로 시작
    if (!/^\.\s/.test(text)) return false;

    // 2. [...] 괄호 존재
    const bracketMatch = text.match(/\[([^\]]+)\]/);
    if (!bracketMatch) return false;

    const inside = bracketMatch[1];

    // 3. "국가. 출처. 월. 일. 시:분" 형식
    if (!/^[^.]+\.\s*[^.]+\.\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2}/.test(inside)) return false;

    // 4. "(월. 일. 시:분)" 가 있으면 형식 확인
    const innerBracket = inside.match(/\(([^)]+)\)/);
    if (innerBracket) {
        if (!/\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2}/.test(innerBracket[1])) return false;
    }

    return true;
}

// ─────────────────────────────────────────
// 2. 폼 초기화
// ─────────────────────────────────────────

/** 입력 폼을 초기 상태(등록 모드)로 되돌린다. */
function resetForm() {
    const formTitle = document.getElementById('form-title');
    if (!formTitle) return;

    formTitle.innerText = '📍 상황 정보 등록';
    document.getElementById('edit-id').value        = '';
    document.getElementById('name-input').value     = '';
    document.getElementById('coords-input').value   = '';
    document.getElementById('attacker-input').value = '';
    document.getElementById('detail-input').value   = '';
    document.getElementById('damage-input').value   = '';
    document.getElementById('submit-btn').innerText = '서버 DB에 저장';
    document.getElementById('cancel-btn').style.display = 'none';

    // 라디오 버튼을 기본값(러시아군)으로 복원
    const defaultRadio = document.querySelector('input[name="attacker-radio"][value="러시아군"]');
    if (defaultRadio) defaultRadio.checked = true;
}

// ─────────────────────────────────────────
// 3. 수정 모드 진입
// ─────────────────────────────────────────

/**
 * 특정 항목을 폼에 로드하여 수정 모드로 전환한다.
 *
 * @param {number} id - 수정할 항목의 DB ID
 */
function startEdit(id) {
    const item = allData.find((d) => d.id === id);
    if (!item) return;

    const formTitle  = document.getElementById('form-title');
    const editIdInput = document.getElementById('edit-id');
    const nameInput  = document.getElementById('name-input');
    const coordsInput = document.getElementById('coords-input');
    if (!formTitle || !editIdInput || !nameInput || !coordsInput) return;

    formTitle.innerText   = '📝 정보 수정 중...';
    editIdInput.value     = item.id;
    nameInput.value       = item.name;
    coordsInput.value     = item.dms_string || `${item.lat}, ${item.lon}`;

    // 선택적 필드 로드
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };
    setVal('attacker-input', item.attacker);
    // 라디오 버튼을 DB의 attacker 값에 맞게 선택
    const matchingRadio = document.querySelector(`input[name="attacker-radio"][value="${item.attacker}"]`);
    if (matchingRadio) matchingRadio.checked = true;
    setVal('detail-input',   item.detail_info);
    setVal('damage-input',   item.damage_info);

    // 날짜/시간 분리 로드
    if (item.occurred_at) {
        const [datePart, timePart] = item.occurred_at.split(/[T ]/);
        setVal('date-input', datePart);
        setVal('time-input', timePart?.substring(0, 5));
    }

    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    if (submitBtn) submitBtn.innerText = '수정 완료';
    if (cancelBtn) cancelBtn.style.display = 'block';

    window.scrollTo(0, 0);
}

// ─────────────────────────────────────────
// 4. 삭제
// ─────────────────────────────────────────

/**
 * 특정 항목을 서버에서 삭제한다.
 *
 * @param {number} id - 삭제할 항목의 DB ID
 */
async function deleteItem(id) {
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(`${API_URL}/delete?id=${id}`, { method: 'POST' });
        if (res.ok) loadFromServer();
    } catch (e) {
        console.error('보안 차단:', e);
    }
}

// ─────────────────────────────────────────
// 5. 리스트 렌더링
// ─────────────────────────────────────────

/**
 * 데이터 목록을 사이드바 리스트에 렌더링한다.
 * 리스트 엘리먼트가 없으면 드롭다운만 업데이트한다.
 *
 * @param {{ id: number, name: string, lat: string|number, lon: string|number, occurred_at: string, dms_string: string }[]} data
 */
function renderList(data) {
    const list = document.getElementById('location-list');

    if (!list) {
        updateLocationDropdown(data);
        return;
    }

    if (data.length === 0) {
        list.innerHTML = `<li style="padding:20px; text-align:center; color:#888;">기록이 없습니다.</li>`;
        return;
    }

    // 가나다 정렬 (괄호 앞 이름 기준)
    const sorted = [...data].sort((a, b) =>
        getSortKey(a.name).localeCompare(getSortKey(b.name), 'ko', { numeric: true })
    );

    list.innerHTML = sorted.map((item) => {
        const safeName = item.name.replace(/'/g, "\\'");

        return `
            <li class="list-item">
                <div class="item-header">
                    <div>
                        <strong class="location-title"
                            onclick="copyAndMove('${safeName}', ${item.lat}, ${item.lon})">
                            ${item.name}
                        </strong>
                        <div style="font-size:0.8em; color:#666;">
                            📅 ${item.occurred_at.substring(0, 16)}
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="edit-btn"   onclick="startEdit(${item.id})">수정</button>
                        <button class="delete-btn" onclick="deleteItem(${item.id})">삭제</button>
                    </div>
                </div>
                <div class="item-details">
                    <div style="font-size:0.85em; color:#555;">
                        📍 ${item.dms_string || `${item.lat}, ${item.lon}`}
                    </div>
                </div>
            </li>`;
    }).join('');
}

/**
 * 드롭다운 선택박스를 필터링된 데이터의 지명으로 갱신한다.
 *
 * @param {{ name: string }[]} filteredData
 */
function updateLocationDropdown(filteredData) {
    const select = document.getElementById('target-location-select');
    if (!select) return;

    // 중복 제거 후 가나다 정렬
    const names = [...new Set(filteredData.map((d) => d.name).filter(Boolean))];
    names.sort((a, b) => getSortKey(a).localeCompare(getSortKey(b), 'ko', { numeric: true }));

    if (names.length > 0) {
        select.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join('');
        select.style.display = 'block';
    } else {
        select.innerHTML = '<option value="">해당 날짜 기록 없음</option>';
    }
}

// ─────────────────────────────────────────
// 6. 날짜 슬라이더 핸들러
// ─────────────────────────────────────────

/**
 * 날짜 슬라이더 값 변경 시 호출된다.
 * 슬라이더 값(0~7)을 기준으로 오늘로부터 N일 전 데이터를 필터링한다.
 *
 * @param {string|number} val - 슬라이더 현재 값 (0 = 오늘, 7 = 7일 전)
 */
function handleSliderChange(val) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - parseInt(val));

    // 'sv-SE' 로캘은 YYYY-MM-DD 형식을 반환하여 관리가 편합니다.
    const dateStr = targetDate.toLocaleDateString('sv-SE');

    const display = document.getElementById('selected-date-display');
    if (display) {
        display.innerText = (val == 0) ? `오늘 (${dateStr})` : `${val}일 전 (${dateStr})`;
    }

    const filtered = allData.filter((item) => {
        if (!item.occurred_at) return false;
        return item.occurred_at.split(/[T ]/)[0] === dateStr;
    });

    renderList(filtered);
    updateMapMarkers(filtered);
}

// ─────────────────────────────────────────
// 7. 유틸리티
// ─────────────────────────────────────────

/**
 * 이름에서 정렬 기준 키를 추출한다.
 * "이름(영문)" 형식일 경우 괄호 앞 부분만 사용한다.
 *
 * @param {string} name
 * @returns {string}
 */
function getSortKey(name) {
    if (!name) return '';
    return name.split('(')[0].trim();
}

/**
 * 자동완성 datalist를 서버 데이터의 고유 지명으로 갱신한다.
 *
 * @param {{ name: string }[]} data
 */
function updateAutocomplete(data) {
    const datalist = document.getElementById('location-names');
    if (!datalist) return;
    const uniqueNames = [...new Set(data.map((item) => item.name))];
    datalist.innerHTML = uniqueNames.map((name) => `<option value="${name}">`).join('');
}

// ─────────────────────────────────────────
// 8. 지도 이동 및 클립보드 복사
// ─────────────────────────────────────────

/**
 * 지명을 클립보드에 복사하고 지도 뷰를 해당 위치로 이동한다.
 *
 * @param {string} rawName - 원본 지명 문자열
 * @param {number} lat     - 이동할 위도
 * @param {number} lon     - 이동할 경도
 */
function copyAndMove(rawName, lat, lon) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(rawName);
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = rawName;
        textArea.style.cssText = 'position:fixed; left:-9999px;';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    if (map && lat && lon) {
        map.getView().animate({
            center: ol.proj.fromLonLat([parseFloat(lon), parseFloat(lat)]),
            duration: 500,
            zoom: 12,
        });
    }
}

// ─────────────────────────────────────────
// 9. 지도 캡처
// ─────────────────────────────────────────

/**
 * 현재 지도 뷰를 PNG 이미지로 캡처하여 다운로드한다.
 * rendercomplete 이벤트를 활용해 모든 레이어가 렌더링된 후 캡처한다.
 */
function captureMap() {
    map.once('rendercomplete', () => {
        const size = map.getSize();
        const mapCanvas = Object.assign(document.createElement('canvas'), {
            width: size[0],
            height: size[1],
        });
        const ctx = mapCanvas.getContext('2d');

        document.querySelectorAll('.ol-layer canvas').forEach((canvas) => {
            if (canvas.width === 0) return;

            const opacity = canvas.parentNode.style.opacity || 1;
            ctx.globalAlpha = Number(opacity);

            const transform = canvas.style.transform;
            const matrix = transform
                ? transform.match(/^matrix\(([^)]*)\)$/)[1].split(',').map(Number)
                : [1, 0, 0, 1, 0, 0];
            CanvasRenderingContext2D.prototype.setTransform.apply(ctx, matrix);
            ctx.drawImage(canvas, 0, 0);
        });

        const link = document.createElement('a');
        link.href     = mapCanvas.toDataURL('image/png');
        link.download = `tactical_map_${Date.now()}.png`;
        link.click();
    });

    map.renderSync();
}

/**
 * 지도 뷰를 지정 위치/줌으로 이동한 후 캡처한다.
 *
 * @param {number} lon       - 중심 경도
 * @param {number} lat       - 중심 위도
 * @param {number} [zoomLevel=10] - 줌 레벨
 */
function captureAtLocation(lon, lat, zoomLevel = 10) {
    map.getView().setCenter(ol.proj.fromLonLat([lon, lat]));
    map.getView().setZoom(zoomLevel);
    setTimeout(captureMap, 500);
}
