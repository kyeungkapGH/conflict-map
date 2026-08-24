/**
 * @file popup-table.js
 * @description "레바논 지도 만들기" 팝업의 복붙용 표 생성 및 지도 캡처 기능
 * @requires map (map-logic.js), ol (OpenLayers)
 */

// 라디오 버튼 선택값을 hidden attacker-input에 동기화
document.querySelectorAll('input[name="attacker-radio"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        document.getElementById('attacker-input').value = radio.value;
    });
});
// 페이지 로드 시 기본 선택값(이스라엘군) 동기화
document.getElementById('attacker-input').value =
    document.querySelector('input[name="attacker-radio"]:checked').value;

function showPopup() {
    document.getElementById('popup').classList.remove('hidden');
    loadPopupTable();
}
function closePopup() {
    document.getElementById('popup').classList.add('hidden');
}

// ==========================
// 1. 파싱 함수 (기사 제목 / 시간)
// ==========================
function parseTitle(fullText) {
    if (!fullText) return { title: '', source: '', time: '' };

    const cleaned = fullText.replace(/^\.\s*/, '');
    const parts = cleaned.split('[');

    const title = (parts[0] || '').trim();
    let source = '-';
    let time = '';

    if (parts[1]) {
        const bracket = parts[1];

        // 출처: [국가. 출처. ...] → 두 번째 토큰
        const srcMatch = bracket.match(/^[^.]+\.\s*([^.]+)/);
        if (srcMatch) source = srcMatch[1].trim();

        // 시간 추출
        const match = bracket.match(
            /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}:\d{2})\s*\(\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}:\d{2})/
        );

        if (match) {
            const [, localM, localD, localHM, , , kstHM] = match;
            time = `${localM}. ${localD}. ${localHM}<br>(${kstHM} KST)`;
        }
    }

    return { title, source, time };
}

// ==========================
// 2. attacker 정규화
// ==========================
function normalizeAttacker(attacker) {
    const a = (attacker || '').trim();
    return a === '' ? '이스라엘군' : a;
}

// ==========================
// 3. attacker 우선순위
// ==========================
function attackerPriority(attacker) {
    const a = normalizeAttacker(attacker);

    if (a.includes('이스라엘')) return 0;
    if (a.includes('헤즈볼라')) return 1;

    return 2;
}

// ==========================
// 4. time → 숫자 변환 (정렬용)
// ==========================
function timeToNumber(timeStr) {
    if (!timeStr) return 999999;

    const match = timeStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}):(\d{2})/);

    if (!match) return 999999;

    const [, m, d, h, min] = match;

    return (m * 1000000) + (d * 10000) + (h * 100) + (min * 1);
}

// ==========================
// 5. popup table loader
// ==========================
async function loadPopupTable() {
    const res = await fetch('./api/locations/today');
    const data = await res.json();

    const tbody = document.getElementById('popup-table-body');
    tbody.innerHTML = '';

    // 1) 필터 + 정규화
    const filtered = data
        .filter(item => item.detail_info?.trim())
        .map(item => ({
            ...item,
            attacker: normalizeAttacker(item.attacker)
        }))
        .sort((a, b) => {
            const atkDiff = attackerPriority(a.attacker) - attackerPriority(b.attacker);
            if (atkDiff !== 0) return atkDiff;

            const aTime = timeToNumber(parseTitle(a.detail_info).time);
            const bTime = timeToNumber(parseTitle(b.detail_info).time);

            return aTime - bTime;
        });

    // 2) 공격 주체별 순서 초기화
    const counter = { '이스라엘군': 0, '헤즈볼라': 0 };

    // 3) 렌더링
    filtered.forEach(item => {
        const parsed = parseTitle(item.detail_info);

        // 순서 증가
        counter[item.attacker] += 1;
        const order = counter[item.attacker];

        // 출처 추출
        let source = '-';
        const match = item.detail_info.match(/\[([^\]]+)\]/);
        if (match) {
            const tokens = match[1].split('.');
            if (tokens[1]) source = tokens[1].trim();
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-order ${item.attacker === '이스라엘군' ? 'israel' : 'hez'}">${order}</td>
            <td class="col-name">${(item.name || '').split('(')[0].trim()}</td>
            <td class="col-title">${parsed.title || ''}</td>
            <td class="col-source">${source}</td>
            <td class="col-time">${parsed.time || ''}</td>
        `;

        tbody.appendChild(tr);
    });
}

// ==========================
// 6. 복사용 버튼
// ==========================
function copyTable() {
    const table = document.getElementById('popup-table');
    let text = '';

    // 테이블 헤더
    const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.innerText.trim())
        .join('\t');
    text += headers + '\n';

    // 테이블 바디
    table.querySelectorAll('tbody tr').forEach(tr => {
        const row = Array.from(tr.querySelectorAll('td'))
            .map(td => td.innerText.trim())
            .join('\t');
        text += row + '\n';
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => alert('표가 복사되었습니다!'))
            .catch(err => alert('복사 실패: ' + err));
    } else {
        alert('클립보드 기능이 꺼져있습니다.\n직접 드래그 해 복사해주세요.');
    }
}
