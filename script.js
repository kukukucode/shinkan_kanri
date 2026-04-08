const CSV_URL_MAIN = "https://docs.google.com/spreadsheets/d/1rT7JJC8TRocZUpIgAXGPWsFHu5E3gSUG3BD12WoJG1Q/export?format=csv";
const CSV_URL_LIST = "https://docs.google.com/spreadsheets/d/1rT7JJC8TRocZUpIgAXGPWsFHu5E3gSUG3BD12WoJG1Q/gviz/tq?tqx=out:csv&sheet=list";

document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    fetchData();
});

function initMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    
    menuToggle.addEventListener('click', () => {
        toggleMenu();
    });

    // Close menu when clicking outside (on the main content)
    document.querySelector('.main-content').addEventListener('click', () => {
        if (sideMenu.classList.contains('active')) {
            toggleMenu();
        }
    });
}

function toggleMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    menuToggle.classList.toggle('active');
    sideMenu.classList.toggle('active');
    
    // Prevent scrolling when menu is open
    if (sideMenu.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

async function fetchData() {
    try {
        const [resMain, resList] = await Promise.all([
            fetch(CSV_URL_MAIN),
            fetch(CSV_URL_LIST)
        ]);
        const textMain = await resMain.text();
        const textList = await resList.text();

        Papa.parse(textList, {
            header: false,
            skipEmptyLines: true,
            complete: function(resultsList) {
                const capacityMap = buildCapacityMap(resultsList.data);
                
                Papa.parse(textMain, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function(resultsMain) {
                        processData(resultsMain.data, capacityMap);
                    }
                });
            }
        });
    } catch (e) {
        console.error("Fetch Error:", e);
        document.getElementById('dateList').innerHTML = '<div class="empty-state">データの取得に失敗しました。</div>';
    }
}

function buildCapacityMap(data) {
    const map = new Map();
    let currentBaseDate = null;
    let subRowIndex = 0;

    data.forEach(row => {
        const colB = row[1] ? row[1].trim() : "";
        const colE = row[4] ? row[4].trim() : "";
        
        if (colB !== "") {
            const match = colB.match(/\d{4}\/(\d{1,2})\/(\d{1,2})/);
            if (match) {
                const m = parseInt(match[1], 10);
                const d = parseInt(match[2], 10);
                const dateKey = `${m}/${d}`;
                
                if (colE !== "") {
                    map.set(dateKey, parseInt(colE, 10));
                    currentBaseDate = null;
                } else {
                    currentBaseDate = dateKey;
                    subRowIndex = 0;
                }
            }
        } else if (currentBaseDate) {
             if (colE !== "") {
                 subRowIndex++;
                 const suffix = subRowIndex === 1 ? '午前' : '午後';
                 map.set(`${currentBaseDate} ${suffix}`, parseInt(colE, 10));
             }
        }
    });
    return map;
}

function isEvent(dateStr) {
    const nonStandardRegex = /[^0-9\/\s午前午後・]/;
    return nonStandardRegex.test(dateStr);
}

function formatInsta(val) {
    if (!val || val === '-') return null;
    let s = val.trim();
    if (s.includes('instagram.com/')) {
        const m = s.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/);
        if (m) s = m[1];
    }
    s = s.replace(/[\s@]/g, '');
    if (!s) return null;
    return `@${s}`;
}

function summarizeText(text, maxLength = 25) {
    if (!text || text === 'なし') return text;
    
    // 共通フレーズの短縮化
    let s = text
        .replace(/ソフトテニス/g, 'ソフテニ')
        .replace(/テニス歴/g, '歴')
        .replace(/しています|しています。|していました|していました。/g, '')
        .replace(/参加します|参加させていただきます/g, '参加')
        .replace(/と考えています|と思っています/g, '希望')
        .replace(/の友達です|の友人です/g, 'の友')
        .replace(/よろしくお願いします|宜しくお願いします/g, '')
        .trim();

    if (s.length <= maxLength) return s;
    return s.substring(0, maxLength) + '...';
}

function processData(data, capacityMap) {
    const datesMap = new Map();

    data.forEach(row => {
        const dateValues = row['参加希望日'];
        if (!dateValues) return;
        
        const dates = dateValues.split(',').map(d => d.trim()).filter(d => d);
        
        dates.forEach(dateStr => {
            if (!datesMap.has(dateStr)) {
                datesMap.set(dateStr, {
                    dateStr: dateStr,
                    isEvent: isEvent(dateStr),
                    participants: [],
                    racketCount: 0
                });
            }
            
            const dateInfo = datesMap.get(dateStr);
            dateInfo.participants.push({
                name: row['名前'] || '',
                univ: row['大学学部'] || '',
                line: row['LINE名前'] || '',
                insta: row['インスタID'] || '',
                remarks: row['備考'] || '',
                experience: row['テニス経験(具体的な年数など)'] || '',
                racket: row['ラケット貸出希望(練習参加希望の場合)'] || ''
            });

            if (row['ラケット貸出希望(練習参加希望の場合)'] && row['ラケット貸出希望(練習参加希望の場合)'].includes('希望する')) {
                dateInfo.racketCount++;
            }
        });
    });

    const datesArray = Array.from(datesMap.values());

    datesArray.forEach(dateInfo => {
        let remaining = null;
        if (capacityMap.has(dateInfo.dateStr)) {
            remaining = capacityMap.get(dateInfo.dateStr);
        } else {
            const prefix = dateInfo.dateStr.split(' ')[0];
            if (capacityMap.has(prefix)) {
                remaining = capacityMap.get(prefix);
            }
        }
        dateInfo.remaining = remaining;
    });

    datesArray.sort((a, b) => {
        const getScore = (str) => {
            const match = str.match(/(\d{1,2})\/(\d{1,2})/);
            if (!match) return 99999;
            let score = parseInt(match[1]) * 100 + parseInt(match[2]);
            if (str.includes('午前')) score += 0.1;
            else if (str.includes('午後')) score += 0.2;
            return score;
        };
        return getScore(a.dateStr) - getScore(b.dateStr);
    });

    renderDateList(datesArray);
    
    // Auto-select first date
    if (datesArray.length > 0) {
        selectDate(datesArray[0], document.querySelector('.date-card'));
    }
}

function renderDateList(datesArray) {
    const listContainer = document.getElementById('dateList');
    const template = document.getElementById('dateCardTemplate').content;
    
    listContainer.innerHTML = '';

    datesArray.forEach(dateInfo => {
        const node = document.importNode(template, true);
        const button = node.querySelector('.date-card');
        
        button.querySelector('.date-card-title').textContent = dateInfo.dateStr;
        button.querySelector('.count-val').textContent = dateInfo.participants.length + '名';
        
        const racketBadge = button.querySelector('.racket-badge');
        if (dateInfo.isEvent) {
            racketBadge.style.display = 'none';
        } else {
            button.querySelector('.racket-val').textContent = '🎾 ' + dateInfo.racketCount;
        }

        const capacityVal = button.querySelector('.capacity-val');
        const capacityBadge = button.querySelector('.capacity-badge');
        
        const remaining = dateInfo.remaining;
        if (remaining !== null && remaining !== undefined && !isNaN(remaining)) {
            capacityVal.textContent = '残' + remaining;
            if (remaining <= 0) {
                capacityBadge.classList.add('low');
                capacityVal.textContent = '満員';
            }
        } else {
            capacityVal.textContent = '不明';
        }

        button.addEventListener('click', () => {
            selectDate(dateInfo, button);
            toggleMenu(); // Close menu after selection
        });

        listContainer.appendChild(node);
    });
}

function selectDate(dateInfo, buttonElement) {
    document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');
    
    document.getElementById('currentDateTitle').textContent = dateInfo.dateStr;
    renderParticipants(dateInfo);
}

function renderParticipants(dateInfo) {
    const grid = document.getElementById('participantGrid');
    const template = document.getElementById('participantCardTemplate').content;
    
    grid.innerHTML = ''; 

    if (dateInfo.participants.length === 0) {
        grid.innerHTML = '<div class="empty-state">参加者はいません。</div>';
        return;
    }

    dateInfo.participants.forEach((p) => {
        const node = document.importNode(template, true);
        
        node.querySelector('.participant-name').textContent = p.name || '未入力';
        node.querySelector('.participant-univ').textContent = p.univ || '大学学部不明';
        
        const lineVal = node.querySelector('.line-name');
        lineVal.textContent = p.line || '-';
        if(!p.line) lineVal.style.color = 'var(--apple-text-secondary)';

        const instaVal = node.querySelector('.insta-id');
        const formattedInsta = formatInsta(p.insta);
        if (formattedInsta) {
            instaVal.textContent = formattedInsta;
        } else {
            instaVal.textContent = '-';
            instaVal.style.color = 'var(--apple-text-secondary)';
        }

        const expContainer = node.querySelector('.experience-container');
        const expVal = node.querySelector('.experience-val');
        const remarksContainer = node.querySelector('.remarks-container');
        const remarksVal = node.querySelector('.remarks-text');
        
        if (dateInfo.isEvent) {
            expContainer.style.display = 'none';
            remarksContainer.style.display = 'flex';
            const rawRemarks = p.remarks || 'なし';
            remarksVal.textContent = summarizeText(rawRemarks);
            remarksVal.title = rawRemarks; // マウスホバーで全文表示
            if(!p.remarks) remarksVal.style.color = 'var(--apple-text-secondary)';
        } else {
            remarksContainer.style.display = 'none';
            expContainer.style.display = 'flex';
            expVal.textContent = p.experience || '未回答';
            if(!p.experience) expVal.style.color = 'var(--apple-text-secondary)';
        }

        grid.appendChild(node);
    });
}
