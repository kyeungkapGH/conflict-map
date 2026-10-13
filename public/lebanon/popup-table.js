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

/** 슬라이더가 가리키는 날짜를 YYYY-MM-DD로 돌려준다. 슬라이더가 없으면 오늘. */
function getSelectedDate() {
    const slider = document.getElementById('date-slider');
    const daysAgo = slider ? parseInt(slider.value, 10) || 0 : 0;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    // 'sv-SE' 로캘은 YYYY-MM-DD 형식을 반환한다.
    return d.toLocaleDateString('sv-SE');
}

async function loadPopupTable() {
    // 표는 슬라이더에서 고른 날짜를 따라간다. 등록 시각이 아니라 공습 발생
    // 일시 기준이라, 며칠 전 공습을 오늘 입력해도 그 날짜 표에 들어간다.
    const res = await fetch(`./api/locations/today?date=${getSelectedDate()}`);
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
/** 셀 안의 글자를 꺼낸다. <br>은 줄바꿈으로, 나머지 태그는 버린다. */
function cellLines(node) {
    let out = '';
    node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue;
        else if (child.nodeName === 'BR') out += '\n';
        else out += cellLines(child);
    });
    return out;
}

function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return str.replace(/[&<>"]/g, (ch) => map[ch]);
}

/** 한글·워드가 표로 받아들이는 HTML을 만든다. 클립보드에는 페이지 CSS가 따라가지
 *  않으므로 테두리·정렬 같은 꼭 필요한 서식은 인라인으로 박아 넣는다. */
function buildTableHtml(table) {
    const CELL = 'border:1px solid #000; padding:4px 6px; vertical-align:top;';
    const cols = Array.from(table.querySelectorAll('colgroup col'))
        .map((col) => `<col style="width:${col.style.width}">`)
        .join('');

    const rowHtml = (tr, tag, extra) => {
        const cells = Array.from(tr.children)
            .map((cell) => {
                const span = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
                const body = escapeHtml(cellLines(cell).trim()).replace(/\n/g, '<br>');
                return `<${tag}${span} style="${CELL}${extra}">${body}</${tag}>`;
            })
            .join('');
        return `<tr>${cells}</tr>`;
    };

    const head = Array.from(table.querySelectorAll('thead tr'))
        .map((tr) => rowHtml(tr, 'th', ' background:#f5f7fa; text-align:left;'))
        .join('');
    const body = Array.from(table.querySelectorAll('tbody tr'))
        .map((tr) => rowHtml(tr, 'td', ''))
        .join('');

    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'
        + `<table style="border-collapse:collapse; width:100%; font-size:10pt;">`
        + `${cols ? `<colgroup>${cols}</colgroup>` : ''}`
        + `<thead>${head}</thead><tbody>${body}</tbody></table>`
        + '</body></html>';
}

/** HTML을 못 쓰는 환경을 위한 탭 구분 평문. */
function buildTableText(table) {
    return Array.from(table.querySelectorAll('thead tr, tbody tr'))
        .map((tr) => Array.from(tr.children)
            .map((cell) => cellLines(cell).trim().replace(/\n/g, ' '))
            .join('\t'))
        .join('\n') + '\n';
}

/** 표를 직접 드래그해 Ctrl+C 한 것과 같은 효과. 구형 브라우저용 대비책. */
function copyTableBySelection(table) {
    const selection = window.getSelection();
    const saved = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const range = document.createRange();
    range.selectNode(table);
    selection.removeAllRanges();
    selection.addRange(range);

    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch (err) {
        ok = false;
    }

    selection.removeAllRanges();
    if (saved) selection.addRange(saved);
    return ok;
}

async function copyTable() {
    const table = document.getElementById('popup-table');

    // 한글은 클립보드에 HTML이 함께 올라와 있을 때만 표로 붙여넣는다. text/plain만
    // 올리면 탭이 섞인 글로 들어가므로, 두 형식을 같이 올린다.
    try {
        if (!navigator.clipboard || !window.ClipboardItem) throw new Error('unsupported');

        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([buildTableHtml(table)], { type: 'text/html' }),
            'text/plain': new Blob([buildTableText(table)], { type: 'text/plain' }),
        })]);
        alert('표가 복사되었습니다!\n한글에서 붙여넣기 옵션 중 "HTML 형식"을 고르면 표로 들어갑니다.');
        return;
    } catch (err) {
        if (copyTableBySelection(table)) {
            alert('표가 복사되었습니다!\n한글에서 붙여넣기 옵션 중 "HTML 형식"을 고르면 표로 들어갑니다.');
            return;
        }
        alert('복사 실패: ' + (err && err.message ? err.message : err)
            + '\n표를 직접 드래그해 복사해주세요.');
    }
}
