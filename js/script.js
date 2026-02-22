// --- 核心資料 ---
var classesData = {};
// window.classesData will be assigned after declaration
window.classesData = classesData; // Explicit global exposure

var periodTimes = [
    { id: 1, start: "00:00", end: "00:00" },
    { id: 2, start: "00:00", end: "00:00" },
    { id: 3, start: "00:00", end: "00:00" },
    { id: 4, start: "00:00", end: "00:00" },
    { id: 5, start: "00:00", end: "00:00" },
    { id: 6, start: "00:00", end: "00:00" },
    { id: 7, start: "00:00", end: "00:00" },
    { id: 8, start: "00:00", end: "00:00" }
];
window.periodTimes = periodTimes;

var teacherTimetable = {
    1: ["", "", "", "", ""],
    2: ["", "", "", "", ""],
    3: ["", "", "", "", ""],
    4: ["", "", "", "", ""],
    5: ["", "", "", "", ""],
    6: ["", "", "", "", ""],
    7: ["", "", "", "", ""],
    8: ["", "", "", "", ""]
};
window.teacherTimetable = teacherTimetable;


var teachingResources = [];
window.teachingResources = teachingResources;

// New: Dynamic Modules List
var defaultModules = [
    { id: 'seating', title: '座位點名', desc: '管理學生位置與出缺席', icon: 'users', color: 'sky', action: "switchTab('seating')" },
    { id: 'textbook', title: '教材檔案', desc: '課程教科書與講義', icon: 'book-open', color: 'emerald', action: "switchTab('textbook')" },
    { id: 'timer', title: '課堂計時器', desc: '懸浮式倒數計時工具', icon: 'timer', color: 'orange', action: "toggleTimerModal()" },
    { id: 'leaderboard', title: '積分排行榜', desc: '查看學生學期積分排名', icon: 'trophy', color: 'pink', action: "switchTab('leaderboard')" },
    { id: 'keyboard', title: '互動鍵盤', desc: '示範常用快捷鍵操作', icon: 'keyboard', color: 'violet', action: "switchTab('keyboard')" },
    { id: 'relax', title: '輕鬆一下', desc: '隨機冷笑話與謎語', icon: 'coffee', color: 'pink', action: "openRelaxModal()" },
    { id: 'polygon', title: '模組化達人', desc: 'Scratch 幾何圖形模擬', icon: 'shapes', color: 'violet', action: "switchTab('polygon')" }
];
var modules = JSON.parse(JSON.stringify(defaultModules));
window.modules = modules;
let isModuleReordering = false;

let currentTab = 'dashboard';
let currentClass = "";
let lotteryHistory = [];
let selectedIndices = new Set();
let lastWinnerIndex = null;
let lastCheckedDateStr = new Date().toDateString();

// Textbook Files Logic
// Textbook Links Logic (Synced via localStorage/Google Sheets)
var textbookLinks = [];
window.textbookLinks = textbookLinks;

window.onload = () => {
    const saved = localStorage.getItem('it-class-master-v4');
    if (saved) {
        const parsed = JSON.parse(saved);
        classesData = parsed.classesData || classesData;
        teacherTimetable = parsed.teacherTimetable || teacherTimetable;
        periodTimes = parsed.periodTimes || periodTimes;
        periodTimes = parsed.periodTimes || periodTimes;
        scoreReasons = parsed.scoreReasons || scoreReasons;
        scoreReasons = parsed.scoreReasons || scoreReasons;
        teachingResources = parsed.teachingResources || teachingResources;
        teachingResources = parsed.teachingResources || teachingResources;
        // Load Modules
        if (parsed.modules && Array.isArray(parsed.modules) && parsed.modules.length > 0) {
            modules = parsed.modules;
            // Merge any new default modules that might be missing from saved data
            const savedIds = new Set(modules.map(m => m.id));
            defaultModules.forEach(dm => {
                if (!savedIds.has(dm.id)) {
                    modules.push(dm);
                }
            });
        } else {
            modules = JSON.parse(JSON.stringify(defaultModules));
        }

        if (parsed.textbookLinks) {
            textbookLinks = parsed.textbookLinks;
        }

        if (parsed.currentClass && classesData[parsed.currentClass]) {
            currentClass = parsed.currentClass;
        } else {
            const keys = Object.keys(classesData);
            if (keys.length > 0) currentClass = keys[0];
        }

        // New day detection
        const todayStr = new Date().toDateString();
        if (parsed.lastActiveDate !== todayStr) {
            console.log('New day detected, resetting attendance...');
            Object.values(classesData).forEach(cls => {
                if (cls.students) {
                    Object.values(cls.students).forEach(s => {
                        s.status = 'present';
                        s.note = '';
                    });
                }
            });
        }
    }



    // Check Login Status
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        const loginView = document.getElementById('view-login');
        if (loginView) loginView.remove();
        const mainNav = document.getElementById('mainNav');
        const mainContent = document.getElementById('mainContent');
        if (mainNav) mainNav.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
    } else {
        // Focus password
        setTimeout(() => {
            const pwd = document.getElementById('loginPassword');
            if (pwd) pwd.focus();
        }, 800);
    }

    initClassSelector();
    initTimetableEditor();

    renderModules(); // Initial Render
    switchTab('dashboard');
    lucide.createIcons();

    setInterval(updateTimeAndStatus, 1000);
    updateTimeAndStatus();

    // Ensure we are using the global GoogleSync
    if (typeof window.GoogleSync !== 'undefined') {
        window.GoogleSync.init();
        const urlInput = document.getElementById('gasUrlInput');
        if (urlInput) urlInput.value = window.GoogleSync.url;

        // Try to pull fresh data from cloud on startup
        if (window.GoogleSync.url) {
            window.GoogleSync.pull();
        }
    } else {
        console.error("GoogleSync module failed to load!");
    }

    // Hide Loader on finish
    setTimeout(() => {
        const loader = document.getElementById('globalLoader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none'; // Prevent clicks during fade out
            setTimeout(() => loader.remove(), 500);
        }
    }, 600);

    initDrawing();
};



// --- Login Logic ---
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function performLogin() {
    const pwdInput = document.getElementById('loginPassword');
    const errorMsg = document.getElementById('loginError');
    const pwd = pwdInput.value;

    const hash = await sha256(pwd);
    const validHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

    if (hash === validHash) {
        sessionStorage.setItem('isLoggedIn', 'true');

        const loginView = document.getElementById('view-login');

        // Transition
        loginView.style.transition = 'all 0.5s ease-in-out';
        loginView.style.opacity = '0';
        loginView.style.transform = 'scale(1.1)';
        loginView.style.filter = 'blur(10px)';

        setTimeout(() => {
            loginView.remove();

            const mainNav = document.getElementById('mainNav');
            const mainContent = document.getElementById('mainContent');

            mainNav.classList.remove('hidden');
            mainContent.classList.remove('hidden');

            // Add entry animations
            mainNav.classList.add('animate-in', 'slide-in-from-top-4', 'duration-700');
            mainContent.classList.add('animate-in', 'fade-in', 'zoom-in-95', 'duration-700');

            // Re-render current tab to ensure proper sizing if needed
            switchTab('dashboard');
        }, 500);
    } else {
        // Error handling
        errorMsg.style.opacity = '1';
        pwdInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/50');
        pwdInput.classList.add('animate-shake'); // Assuming we can add a shake animation or just generic visual cue

        // Play error sound if possible (optional)
        // SoundFX.playError(); 

        setTimeout(() => {
            errorMsg.style.opacity = '0';
            pwdInput.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/50', 'animate-shake');
        }, 2000);
    }
}

function logout() {
    if (confirm('確定要登出系統嗎？')) {
        sessionStorage.removeItem('isLoggedIn');
        location.reload();
    }
}

// Updated saveData with logging
function saveData(skipPush = false) {
    // CRITICAL: Ensure local variables match window globals (which might have been updated by Sync)
    // before we serialize.
    if (typeof window.classesData !== 'undefined') classesData = window.classesData;
    if (typeof window.teacherTimetable !== 'undefined') teacherTimetable = window.teacherTimetable;
    if (typeof window.periodTimes !== 'undefined') periodTimes = window.periodTimes;
    if (typeof window.scoreReasons !== 'undefined') scoreReasons = window.scoreReasons;
    if (typeof window.teachingResources !== 'undefined') teachingResources = window.teachingResources;
    if (typeof window.modules !== 'undefined') modules = window.modules;
    if (typeof window.textbookLinks !== 'undefined') textbookLinks = window.textbookLinks;

    const bundle = {
        classesData: classesData,
        teacherTimetable: teacherTimetable,
        periodTimes: periodTimes,
        periodTimes: periodTimes,
        scoreReasons: scoreReasons,
        teachingResources: teachingResources,
        textbookLinks: textbookLinks, // Save Textbook Links
        currentClass: currentClass,
        lastActiveDate: new Date().toDateString()
    };

    localStorage.setItem('it-class-master-v4', JSON.stringify(bundle));
    updateDashboardStats();

    if (!skipPush) {
        if (typeof window.GoogleSync !== 'undefined') {
            console.log("Triggering auto-upload...");
            window.GoogleSync.schedPush();
        } else {
            console.warn("GoogleSync not defined, skipping auto-upload.");
        }
    }
}

function switchTab(tabId) {
    currentTab = tabId;

    // Mobile: Auto-close menu on selection
    if (window.innerWidth < 768) {
        const navContent = document.getElementById('navContent');
        if (navContent && !navContent.classList.contains('hidden')) {
            navContent.classList.add('hidden');
        }
    }

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.id === `btn-${tabId}`) {
            btn.classList.add('bg-slate-700', 'text-white', 'shadow-lg');
            btn.classList.remove('text-slate-400', 'hover:bg-slate-800');
        } else {
            btn.classList.remove('bg-slate-700', 'text-white', 'shadow-lg');
            btn.classList.add('text-slate-400', 'hover:bg-slate-800');
        }
    });

    // Update sections
    const sections = ['dashboard', 'seating', 'records', 'lottery', 'textbook', 'settings', 'leaderboard', 'keyboard', 'resource-detail', 'polygon'];

    // 1. First hide ALL sections to ensure clean state
    sections.forEach(s => {
        const el = document.getElementById(`view-${s}`);
        if (el) el.classList.add('hidden');
    });

    // 2. Show the target section
    const targetEl = document.getElementById(`view-${tabId}`);
    if (targetEl) {
        targetEl.classList.remove('hidden');

        // 3. Initialize specific page logic safely
        try {
            if (tabId === 'dashboard') {
                updateTimeAndStatus();
                renderResources();
            }
            if (tabId === 'seating') renderSeating();
            if (tabId === 'records') renderRecordsPage();
            if (tabId === 'leaderboard') renderLeaderboard();
            if (tabId === 'settings') renderSettingsPage();
            if (tabId === 'polygon') initPolygon();
            if (tabId === 'textbook') renderTextbookGrid();
        } catch (e) {
            console.error(`Error initializing ${tabId}:`, e);
        }
    }

    lucide.createIcons();
}

function toggleMobileMenu() {
    const navContent = document.getElementById('navContent');
    if (navContent) {
        navContent.classList.toggle('hidden');
    }
}

function initTimetableEditor() {
    const tbody = document.getElementById('timetableEditor');
    const classList = Object.keys(classesData);

    tbody.innerHTML = periodTimes.map(p => {
        const dayCells = [0, 1, 2, 3, 4].map(dayIndex => {
            const selected = teacherTimetable[p.id][dayIndex];
            return `
                        <td class="p-2">
                            <select data-period="${p.id}" data-day="${dayIndex}" class="timetable-select w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center cursor-pointer hover:bg-slate-700 transition-colors">
                                <option value="">--</option>
                                ${classList.map(c => `<option value="${c}" ${selected === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </td>
                    `;
        }).join('');

        return `
                    <tr class="border-b border-slate-800/50">
                        <td class="p-3 pl-6">
                            <div class="font-bold text-sky-400">第 ${p.id} 節</div>
                            <div class="text-[10px] text-slate-500 font-mono">${p.start} ~ ${p.end}</div>
                        </td>
                        ${dayCells}
                    </tr>
                `;
    }).join('');
}

function saveTimetable() {
    document.querySelectorAll('.timetable-select').forEach(sel => {
        const pId = sel.dataset.period;
        const dIdx = sel.dataset.day;
        teacherTimetable[pId][dIdx] = sel.value;
    });
    saveData();
    alert('課表儲存成功！');
}

// --- 時間設定邏輯 ---
function openTimeSettings() {
    const list = document.getElementById('timeSettingsList');
    list.innerHTML = periodTimes.map((p, i) => `
                <div class="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-white/5">
                    <div class="w-24 font-bold text-sky-400"># 第 ${p.id} 節</div>
                    <div class="flex items-center gap-2 flex-1">
                        <input type="time" id="ts_start_${i}" value="${p.start}" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                        <span class="text-slate-500 font-bold">~</span>
                        <input type="time" id="ts_end_${i}" value="${p.end}" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                    </div>
                </div>
            `).join('');
    document.getElementById('timeSettingsModal').classList.remove('hidden');
}

function saveTimeSettings() {
    // Validate basic integrity
    for (let i = 0; i < periodTimes.length; i++) {
        const start = document.getElementById(`ts_start_${i}`).value;
        const end = document.getElementById(`ts_end_${i}`).value;
        if (!start || !end) {
            alert('請輸入完整時間！');
            return;
        }
        periodTimes[i].start = start;
        periodTimes[i].end = end;
    }

    saveData();
    initTimetableEditor(); // Refresh Timetable UI
    updateTimeAndStatus(); // Refresh Dashboard UI
    document.getElementById('timeSettingsModal').classList.add('hidden');
    alert('時間設定已更新！');
}

let lastPromptTime = "";

function updateTimeAndStatus() {
    const now = new Date();
    const nowStr = now.toDateString();

    if (nowStr !== lastCheckedDateStr) {
        lastCheckedDateStr = nowStr;
        console.log('New day detected (runtime), resetting attendance...');
        Object.values(classesData).forEach(cls => {
            if (cls.students) {
                Object.values(cls.students).forEach(s => {
                    s.status = 'present';
                    s.note = '';
                });
            }
        });
        saveData(); // Will update lastActiveDate and persist
        if (currentTab === 'seating') renderSeating();
        updateDashboardStats();
    }

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // 更新日期顯示
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${days[now.getDay()]}`;
    document.getElementById('currentDate').innerText = dateStr;
    document.getElementById('currentTime').innerText = `${hours}:${minutes}:${seconds}`;

    const currentTimeVal = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay();
    const dayIndex = day - 1; // 0-4 (Mon-Fri)

    const currentClassDisplay = document.getElementById('currentClassDisplay');
    const countdownText = document.getElementById('countdownText');
    const periodLabel = document.getElementById('currentPeriodLabel');
    const timeRange = document.getElementById('periodTimeRange');
    const statusMsg = document.getElementById('classStatusMsg');
    const autoBtn = document.getElementById('autoSwitchBtn');
    const timerContainer = document.getElementById('timerContainer');
    const timerLabel = document.getElementById('timerLabel');
    const classInfoHeading = document.getElementById('classInfoHeading');

    // 1. 檢查是否正在「上課中」
    let foundPeriod = null;
    if (day >= 1 && day <= 5) {
        foundPeriod = periodTimes.find(p => {
            const [sh, sm] = p.start.split(':').map(Number);
            const [eh, em] = p.end.split(':').map(Number);
            const sVal = sh * 60 + sm;
            const eVal = eh * 60 + em;
            return currentTimeVal >= sVal && currentTimeVal < eVal;
        });
    }

    if (foundPeriod) {
        const targetClass = teacherTimetable[foundPeriod.id][dayIndex];
        periodLabel.innerText = `第 ${foundPeriod.id} 節`;
        timeRange.innerText = `${foundPeriod.start} ~ ${foundPeriod.end}`;
        timerContainer.classList.remove('timer-badge-next');
        timerContainer.classList.add('timer-badge');
        timerLabel.innerText = "距離下課";

        // Find next period info
        const currentIdx = periodTimes.findIndex(p => p.id === foundPeriod.id);
        let nextInfoHtml = '';
        if (currentIdx < periodTimes.length - 1) {
            const nextP = periodTimes[currentIdx + 1];
            const nextClass = teacherTimetable[nextP.id][dayIndex];
            nextInfoHtml = `<span class="ml-4 pl-4 border-l border-slate-600 text-sm text-slate-400 font-normal">下一節：${nextClass || '無課程'}</span>`;
        }

        classInfoHeading.innerHTML = `目前課程：<span id="currentClassDisplay" class="text-sky-400">${targetClass || '無課程'}</span>${nextInfoHtml}`;

        // Calculate countdown for ANY active period (class or free)
        const [eh, em] = foundPeriod.end.split(':').map(Number);
        const endTime = new Date(now);
        endTime.setHours(eh, em, 0);
        updateCountdown(now, endTime, countdownText);

        if (targetClass) {
            statusMsg.innerText = `正在進行 ${targetClass} 的課程...`;

            // --- 檢查是否需要提示切換班級 ---
            const nowTimeStr = `${hours}:${minutes}`;
            if (nowTimeStr === foundPeriod.start && lastPromptTime !== nowTimeStr) {
                lastPromptTime = nowTimeStr;
                if (targetClass !== currentClass) {
                    // 使用 setTimeout 避免阻擋 UI 渲染
                    setTimeout(() => {
                        if (confirm(`上課時間到了！\n第 ${foundPeriod.id} 節是 ${targetClass} 的課。\n\n是否切換至 ${targetClass}？`)) {
                            currentClass = targetClass;
                            initClassSelector(); // 更新下拉選單狀態
                            switchTab('seating'); // 切換到座位表
                            // 強制更新一次狀態以反映變更
                            renderSeating();
                            updateDashboardStats();
                        }
                    }, 100);
                }
            }

            if (currentClass !== targetClass) {
                autoBtn.classList.remove('hidden');
                autoBtn.onclick = () => {
                    document.getElementById('classSelector').value = targetClass;
                    currentClass = targetClass;
                    updateDashboardStats();
                    autoBtn.classList.add('hidden');
                };
            } else {
                autoBtn.classList.add('hidden');
            }
        } else {
            statusMsg.innerText = "目前為空堂時間，可以進行教材準備。";
            autoBtn.classList.add('hidden');
        }
    } else {
        // 2. 檢查是否在「下課時間」，尋找「下一節課」
        let nextPeriod = null;
        if (day >= 1 && day <= 5) {
            nextPeriod = periodTimes.find(p => {
                const [sh, sm] = p.start.split(':').map(Number);
                const sVal = sh * 60 + sm;
                // 尋找之後的第一個節次 (無論是否有課)
                return currentTimeVal < sVal;
            });
        }

        if (nextPeriod) {
            const targetClass = teacherTimetable[nextPeriod.id][dayIndex] || '無課程'; // Fallback text
            periodLabel.innerText = `NEXT: 第 ${nextPeriod.id} 節`;
            timeRange.innerText = `${nextPeriod.start} ~ ${nextPeriod.end}`;
            timerContainer.classList.remove('timer-badge');
            timerContainer.classList.add('timer-badge-next');
            timerLabel.innerText = "距離上課";
            classInfoHeading.innerHTML = `下一節課：<span id="currentClassDisplay" class="text-amber-400">${targetClass}</span>`;
            statusMsg.innerText = targetClass !== '無課程' ? `下課休息中，準備迎接 ${targetClass} 的同學...` : "下課休息中，下一節為空堂。";

            const [sh, sm] = nextPeriod.start.split(':').map(Number);
            const startTime = new Date(now);
            startTime.setHours(sh, sm, 0);
            updateCountdown(now, startTime, countdownText);
            autoBtn.classList.add('hidden');
        } else {
            // 完全非上課時段 (放學或週末)
            periodLabel.innerText = "OFF TIME";
            timeRange.innerText = "--:-- ~ --:--";
            timerContainer.classList.remove('timer-badge-next');
            timerContainer.classList.add('timer-badge');
            timerLabel.innerText = "休息中";
            countdownText.innerText = "--:--";
            classInfoHeading.innerHTML = `目前課程：<span id="currentClassDisplay" class="text-slate-500">非上課時段</span>`;
            statusMsg.innerText = "辛苦了老師，目前非教學時段。";
            autoBtn.classList.add('hidden');
        }
    }
}

function updateCountdown(now, targetTime, element) {
    const diff = Math.floor((targetTime - now) / 1000);
    if (diff < 0) {
        element.innerText = "00:00";
        return;
    }
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    element.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- 其他原功能邏輯 ---
function initClassSelector() {
    const sel = document.getElementById('classSelector');
    const keys = Object.keys(classesData);
    sel.innerHTML = keys.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = currentClass;
    sel.onchange = (e) => {
        currentClass = e.target.value;
        selectedIndices.clear(); // 切換班級時清空選擇
        updateDashboardStats();
        if (currentTab === 'seating') renderSeating();
        if (currentTab === 'records') renderRecordsPage();
        if (currentTab === 'leaderboard') renderLeaderboard();

        // 切換班級時重置抽籤機
        resetLottery();
    };
}

function updateDashboardStats() {
    const data = classesData[currentClass];
    if (!data) return;
    const students = Object.values(data.students);
    const presentCount = students.filter(s => s.status === 'present').length;
    const lateCount = students.filter(s => s.status === 'late').length;
    const absentCount = students.filter(s => s.status === 'absent').length;

    document.getElementById('stat-total').innerText = students.length;

    // Present includes late
    let presentText = `${presentCount + lateCount}`;
    if (lateCount > 0) {
        presentText += ` <span class="text-sm text-amber-400 font-bold">(遲到 ${lateCount})</span>`;
    }
    document.getElementById('stat-present').innerHTML = presentText;

    document.getElementById('stat-absent').innerText = absentCount;
}

function updateLayout() {
    let cols = parseInt(document.getElementById('gridCols').value) || 6;
    let rows = parseInt(document.getElementById('gridRows').value) || 8;

    // 簡單驗證範圍 (1~12)
    if (cols < 1) cols = 1;
    if (cols > 12) cols = 12;
    if (rows < 1) rows = 1;
    if (rows > 12) rows = 12;

    // 寫回 Input (防止用戶輸入無效值)
    document.getElementById('gridCols').value = cols;
    document.getElementById('gridRows').value = rows;

    const data = classesData[currentClass];
    // 取出目前所有有效的學生資料
    const currentStudents = Object.values(data.students).filter(s => s);

    // 檢查容量警告
    if (currentStudents.length > cols * rows) {
        alert(`無法調整！\n目前班上有 ${currentStudents.length} 位學生，但新的設定 (${cols} x ${rows}) 只有 ${cols * rows} 個座位。\n請增加欄數或列數。`);
        // 回復原始設定值
        document.getElementById('gridCols').value = data.config.cols;
        document.getElementById('gridRows').value = data.config.rows;
        return;
    }

    // 套用更新 config
    data.config.cols = cols;
    data.config.rows = rows;

    // Reflow with new config
    reflowClassLayout(currentClass);

    // 修正佈局後，原本的選取位置已失效，必須清除
    selectedIndices.clear();
    renderSeating();
}

// --- 核心排位邏輯 (Reflow) ---
function reflowClassLayout(cls) {
    const data = classesData[cls];
    if (!data) return;

    const cols = data.config.cols;
    const rows = data.config.rows;

    // Get all students and sort by SeatNo
    const allStudents = Object.values(data.students).filter(s => s);
    allStudents.sort((a, b) => {
        const noA = parseInt(a.seatNo.replace(/[^\d]/g, '')) || 0;
        const noB = parseInt(b.seatNo.replace(/[^\d]/g, '')) || 0;
        return noA - noB;
    });

    const newMap = {};

    // 規則：依座號排序 -> 右下角開始為1號 -> 該欄由下往上排 -> 排滿換左邊一欄
    allStudents.forEach((student, k) => {
        // k=0 是 1號
        // 計算邏輯座標：右數第幾欄 (0-based), 下數第幾列 (0-based)
        const colFromRight = Math.floor(k / rows);
        const rowFromBottom = k % rows;

        // 轉換實際 Grid 座標：左數第幾欄, 上數第幾列
        const c = (cols - 1) - colFromRight;
        const r = (rows - 1) - rowFromBottom;

        // 轉為一維陣列 Index (Grid Key)
        const flatIndex = r * cols + c;

        // If grid is full (shouldn't happen if checked), we just append? 
        // But flatIndex might be weird if k >= cols*rows. 
        // For now assume capacity is checked or sufficient.
        if (c >= 0 && r >= 0) {
            newMap[flatIndex] = student;
        }
    });

    data.students = newMap;
    saveData();
}

let draggedSeatIndex = null;

function renderSeating() {
    const grid = document.getElementById('seatingGrid');
    const data = classesData[currentClass];
    const { config, students } = data;

    // 更新工具列狀態
    // Count active (non-absent) students
    const activeKeys = Object.keys(students).filter(k => students[k] && students[k].status !== 'absent');
    const totalActive = activeKeys.length;

    // Count selected active students
    const selectedActiveCount = activeKeys.filter(k => selectedIndices.has(parseInt(k))).length;
    const selectedCount = selectedIndices.size;

    document.getElementById('gridCols').value = config.cols;
    document.getElementById('gridRows').value = config.rows;

    // 更新全選按鈕與計數
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        // Checkbox state depends on ACTIVE students
        const isAllActiveSelected = totalActive > 0 && selectedActiveCount === totalActive;
        selectAllCheckbox.checked = isAllActiveSelected;
        selectAllCheckbox.indeterminate = selectedCount > 0 && !isAllActiveSelected;
    }
    const countLabel = document.getElementById('selectionCount');
    if (countLabel) countLabel.innerText = `(${selectedCount})`;

    // 更新按鈕啟用狀態
    ['btnBatchAdd', 'btnBatchSub'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = selectedCount === 0;
    });

    grid.style.gridTemplateColumns = `repeat(${config.cols}, minmax(0, 1fr))`;
    grid.innerHTML = '';

    for (let i = 0; i < config.cols * config.rows; i++) {
        const slot = document.createElement('div');
        const s = students[i];

        // 設定插槽為放置目標
        slot.className = `border rounded-xl min-h-[110px] flex flex-col items-center justify-center relative group transition-all duration-200`;
        slot.setAttribute('ondragover', 'handleDragOver(event)');
        slot.setAttribute('ondrop', `handleDrop(event, ${i})`);
        slot.setAttribute('ondragenter', 'handleDragEnter(event)');
        slot.setAttribute('ondragleave', 'handleDragLeave(event)');

        if (s) {
            if (s.score === undefined) s.score = 0;
            const isSelected = selectedIndices.has(i);

            slot.className += ` ${isSelected ? 'border-indigo-500 bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-800 bg-slate-900/30 hover:border-slate-600'}`;

            // 內容區塊設為可拖曳
            // --- 卡片設計優化 ---
            let statusColorClass = '';
            let statusIcon = '';
            let scoreClass = 'bg-slate-700 text-slate-300'; // Default zero/neutral

            // 根據分數給予不同熱度顏色
            if (s.score > 0) scoreClass = 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/20 shadow-lg';
            if (s.score < 0) scoreClass = 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-rose-500/20 shadow-lg';
            if (s.score === 0) scoreClass = 'bg-gradient-to-br from-slate-600 to-slate-700 text-slate-300';

            // 狀態樣式與圖示
            if (s.status === 'present') {
                statusColorClass = 'bg-slate-800/50 border-slate-700';
                statusIcon = `<div class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>`;
            } else if (s.status === 'absent') {
                statusColorClass = 'bg-rose-900/10 border-rose-500/30';
                statusIcon = `<i data-lucide="x-circle" class="w-3 h-3 text-rose-500"></i>`;
            } else if (s.status === 'late') {
                statusColorClass = 'bg-amber-900/10 border-amber-500/30';
                statusIcon = `<i data-lucide="clock" class="w-3 h-3 text-amber-500"></i>`;
            }

            slot.innerHTML = `
                    <div class="student-card w-full h-full relative group select-none transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                         draggable="true" 
                         ondragstart="handleDragStart(event, ${i})"
                         ondragend="handleDragEnd(event)">
                        
                        <!-- 卡片本體 -->
                        <div class="absolute inset-0 rounded-xl border backdrop-blur-sm shadow-sm transition-all duration-300 ${statusColorClass} ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-900/20 z-10' : 'hover:border-slate-500 hover:shadow-md hover:bg-slate-800/80'} flex flex-col overflow-hidden">
                            
                            <!-- 頂部資訊列: 座號 & 分數 -->
                            <div class="flex justify-between items-start p-2 z-20">
                                <div class="flex flex-col items-start" onclick="toggleSelection(${i}); event.stopPropagation();">
                                   <!-- 座號 Badge -->
                                   <div class="font-mono text-sm font-bold text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/50 flex items-center gap-1 cursor-pointer hover:bg-slate-800 hover:text-sky-400 transition-colors">
                                       ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-indigo-400"></i>' : '<span class="w-3.5 inline-block text-center">#</span>'}
                                       ${s.seatNo}
                                   </div>
                                </div>
                                
                                <!-- 分數 Badge -->
                                <div class="box-score font-mono font-black text-sm px-2 py-0.5 rounded-md flex items-center shadow-sm backdrop-blur-md cursor-default ${scoreClass}">
                                    ${s.score > 0 ? '+' : ''}${s.score}
                                </div>
                            </div>

                            <!-- 主要內容: 名字 -->
                            <div class="flex-1 flex flex-col items-center justify-center -mt-1 px-1 relative z-10 cursor-pointer" 
                                 onclick="openStatusModal(${i})" title="設定狀態">
                                <div class="font-bold text-base text-slate-200 tracking-wide text-center leading-tight drop-shadow-md group-hover:text-white transition-colors truncate w-full px-1">
                                    ${s.name}
                                </div>
                                
                                <!-- 詳細狀態標籤 (若有) -->
                                ${(s.status !== 'present') ? `
                                <div class="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border max-w-full truncate
                                    ${s.status === 'absent' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}">
                                    ${statusIcon}
                                    <span class="truncate">${s.note || (s.status === 'absent' ? '缺席' : '遲到')}</span>
                                </div>
                                ` : ''}
                            </div>

                            <!-- 底部懸浮動作列 (Hover顯示) -->
                            <div class="w-full h-[36px] mt-auto flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pb-2 z-30">
                                 <button onclick="updateScore(${i}, 1); event.stopPropagation();" 
                                    class="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center transition-transform active:scale-90 hover:scale-110 border border-emerald-400/30">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                </button>
                                <button onclick="updateScore(${i}, -1); event.stopPropagation();" 
                                    class="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 flex items-center justify-center transition-transform active:scale-90 hover:scale-110 border border-rose-400/30">
                                    <i data-lucide="minus" class="w-4 h-4"></i>
                                </button>
                            </div>
                            
                            <!-- 裝飾背景光暈 -->
                            <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl pointer-events-none group-hover:from-white/10 transition-all"></div>
                        </div>
                    </div>`;
        } else {
            slot.className += ` border-slate-800 bg-slate-900/30 opacity-50`;
            slot.innerHTML = `<div class="w-full h-full flex items-center justify-center text-slate-700/50 pointer-events-none"><i data-lucide="box-select" class="w-6 h-6"></i></div>`;
        }
        grid.appendChild(slot);
    }
    lucide.createIcons();
}

// --- 拖曳功能 ---
function handleDragStart(e, index) {
    draggedSeatIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index); // Firefox 需要
    setTimeout(() => e.target.classList.add('opacity-50', 'scale-95'), 0);
}

function handleDragEnd(e) {
    e.target.classList.remove('opacity-50', 'scale-95');
    document.querySelectorAll('.drag-target-active').forEach(el => {
        el.classList.remove('drag-target-active', 'bg-sky-500/20', 'border-sky-500');
    });
    draggedSeatIndex = null;
}

function handleDragOver(e) {
    e.preventDefault(); // 必要：允許放下
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const slot = e.currentTarget;
    if (draggedSeatIndex !== null) {
        slot.classList.add('drag-target-active', 'bg-sky-500/20', 'border-sky-500');
    }
}

function handleDragLeave(e) {
    const slot = e.currentTarget;
    slot.classList.remove('drag-target-active', 'bg-sky-500/20', 'border-sky-500');
}

function handleDrop(e, targetIndex) {
    e.preventDefault();
    e.stopPropagation();

    if (draggedSeatIndex === null || draggedSeatIndex === targetIndex) return;

    const data = classesData[currentClass];
    const sourceStudent = data.students[draggedSeatIndex];
    const targetStudent = data.students[targetIndex];

    // 交換資料
    if (sourceStudent) {
        // 移動來源到目標
        data.students[targetIndex] = sourceStudent;

        if (targetStudent) {
            // 如果目標有學生，交換到來源位置
            data.students[draggedSeatIndex] = targetStudent;
        } else {
            // 如果目標是空的，刪除來源位置的參照
            delete data.students[draggedSeatIndex];
        }

        // 若有選取狀態，也需要一併轉移 (這裡簡單起見先清空選取，避免混淆)
        selectedIndices.clear();

        saveData();
        renderSeating();
    }
}

function toggleSelection(index) {
    if (selectedIndices.has(index)) {
        selectedIndices.delete(index);
    } else {
        selectedIndices.add(index);
    }
    renderSeating();
}

function toggleSelectAll(isChecked) {
    const data = classesData[currentClass];
    selectedIndices.clear();
    if (isChecked) {
        Object.keys(data.students).forEach(key => {
            if (data.students[key].status !== 'absent') {
                selectedIndices.add(parseInt(key));
            }
        });
    }
    renderSeating();
}

// --- 分數理由與模態視窗邏輯 ---
let pendingScoreAction = null;

let scoreReasons = {
    positive: [],
    negative: []
};

function openScoreModal(targets, delta, isBatch = false) {
    pendingScoreAction = { targets, delta, isBatch };
    const modal = document.getElementById('scoreReasonModal');
    const title = document.getElementById('modalTitle');
    const container = document.getElementById('reasonButtons');
    const targetDisplay = document.getElementById('modalTargetDisplay'); // 新增：獲取顯示容器

    // 新增：顯示對象資訊
    const data = classesData[currentClass];
    if (targets.length === 1) {
        const s = data.students[targets[0]];
        targetDisplay.innerHTML = `<span class="text-3xl font-black text-white tracking-tight block">${s.seatNo} ${s.name}</span>`;
    } else {
        targetDisplay.innerHTML = `<span class="text-xl font-bold text-slate-300 block">已選取 ${targets.length} 位同學</span>`;
    }

    // 設定標題樣式
    if (delta > 0) {
        title.innerHTML = `<i data-lucide="thumbs-up" class="w-5 h-5"></i> 加分理由`;
        title.className = "text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400";
    } else {
        title.innerHTML = `<i data-lucide="thumbs-down" class="w-5 h-5"></i> 扣分理由`;
        title.className = "text-xl font-bold mb-4 flex items-center gap-2 text-red-400";
    }

    // 生成理由按鈕
    const reasons = delta > 0 ? scoreReasons.positive : scoreReasons.negative;
    container.innerHTML = reasons.map(r => `
                <button onclick="confirmScore('${r}')" 
                    class="p-3 rounded-xl border ${delta > 0 ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/30 text-red-300'} 
                    font-bold text-sm transition-all active:scale-95 shadow-lg">
                    ${r}
                </button>
            `).join('');

    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeScoreModal() {
    document.getElementById('scoreReasonModal').classList.add('hidden');
    pendingScoreAction = null;
}

// --- 音效控制 (使用 Web Audio API 生成，無需外部檔案) ---
const SoundFX = {
    ctx: null,
    init: function () {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playPositive: function () {
        this.init();
        const t = this.ctx.currentTime;

        // 播放單音的輔助函式
        const playNote = (freq, startTime, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle'; // 三角波聽起來比正弦波更明亮、更有電玩感
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        // C大調琶音 (C5, E5, G5, C6) - 勝利音效
        playNote(523.25, t, 0.3);       // Do
        playNote(659.25, t + 0.1, 0.3); // Mi
        playNote(783.99, t + 0.2, 0.3); // Sol
        playNote(1046.50, t + 0.3, 0.8); // High Do
    },
    playNegative: function () {
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.3);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    },
    playTick: function () {
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.03, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
    },
    playFanfare: function () {
        this.init();
        const t = this.ctx.currentTime;
        const playTone = (freq, start, dur, type = 'triangle') => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + dur);
        };

        // 勝利號角 melody
        playTone(523.25, t, 0.1); // C5
        playTone(523.25, t + 0.1, 0.1); // C5
        playTone(523.25, t + 0.2, 0.1); // C5
        playTone(659.25, t + 0.3, 0.4); // E5
        playTone(783.99, t + 0.4, 0.4); // G5
        playTone(1046.50, t + 0.6, 1.0, 'sine'); // C6 (High)
    }
};

function confirmScore(reason) {
    if (!pendingScoreAction) return;
    const { targets, delta, isBatch } = pendingScoreAction;
    const data = classesData[currentClass];

    // 播放音效
    if (delta > 0) SoundFX.playPositive();
    else SoundFX.playNegative();

    // 1. 執行加扣分並儲存紀錄
    const nowTime = new Date().toISOString();
    targets.forEach(index => {
        const s = data.students[index];
        if (s) {
            s.score = (s.score || 0) + delta;

            // 初始化歷史陣列
            if (!s.history) s.history = [];

            // 新增紀錄
            s.history.push({
                reason: reason,
                delta: delta,
                time: nowTime
            });
        }
    });

    // 2. 如果是批次操作，立即清除選取狀態
    if (isBatch) {
        selectedIndices.clear();
    }

    // 3. 儲存並重新渲染 (此時若為批次，選取狀態已消失)
    saveData();
    renderSeating();
    closeScoreModal();
    showResultModal(targets, delta, reason, isBatch);
    if (currentTab === 'records') renderScoreHistoryList('pageScoreList'); // Update records page if active

    // 4. 視覺回饋 (針對剛剛操作的目標進行動畫，即使已取消選取)
    const grid = document.getElementById('seatingGrid');
    targets.forEach(index => {
        const slot = grid.children[index];
        if (slot) {
            const el = slot.querySelector('.box-score');
            const colorClass = delta > 0 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]';
            if (el) el.classList.add('scale-150', 'text-white', colorClass, 'px-2', 'z-50');

            // 讓分數卡本身也跳動一下
            slot.firstElementChild.classList.add('scale-95');
            setTimeout(() => slot.firstElementChild.classList.remove('scale-95'), 150);
        }
    });
}

function showResultModal(targets, delta, reason, isBatch) {
    const modal = document.getElementById('scoreResultModal');
    const content = document.getElementById('resultContent');
    const data = classesData[currentClass];

    let html = '';
    const actionText = delta > 0 ? '加分成功' : '扣分成功';
    const colorClass = delta > 0 ? 'text-emerald-400' : 'text-rose-400';

    if (isBatch) {
        html = `
                    <div class="flex flex-col items-center">
                        <div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                            <i data-lucide="users" class="w-8 h-8 text-slate-400"></i>
                        </div>
                        <div class="text-4xl font-black ${colorClass} mb-2">${targets.length} <span class="text-lg text-slate-400">位同學</span></div>
                        <div class="text-xl font-bold text-white mb-2">${reason}</div>
                        <div class="mt-2 px-4 py-1 rounded-full bg-slate-700/50 text-slate-300 text-xs inline-block">批次${actionText}</div>
                    </div>
                `;
    } else {
        const s = data.students[targets[0]];
        html = `
                    <div class="flex flex-col items-center">
                        <div class="text-5xl font-black text-slate-700 mb-2 opacity-20 absolute -top-4 -right-4 select-none">${s.seatNo}</div>
                        <div class="text-3xl font-black text-white mb-4 relative z-10">${s.seatNo} ${s.name}</div>
                        <div class="text-xl font-bold ${colorClass} mb-4 flex items-center gap-2">
                            ${reason}
                        </div>
                        <div class="px-6 py-2 rounded-xl ${delta > 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'} text-sm font-bold inline-block">
                            ${actionText}
                        </div>
                    </div>
                `;
    }

    content.innerHTML = html;
    modal.classList.remove('hidden');
    lucide.createIcons();

    if (window.resultTimer) clearTimeout(window.resultTimer);
    window.resultTimer = setTimeout(() => {
        modal.classList.add('hidden');
    }, 2000);
}

// 修改後的按鈕觸發函式
function batchUpdateScore(delta) {
    if (selectedIndices.size === 0) return;
    openScoreModal(Array.from(selectedIndices), delta, true);
}

function updateScore(index, delta) {
    openScoreModal([index], delta, false);
}
// --- 狀態管理 (大幅修改支援詳細事由) ---
let currentStatusTarget = null;

function openStatusModal(index) {
    currentStatusTarget = index;
    const s = classesData[currentClass].students[index];
    if (!s) return;

    document.getElementById('statusModalTarget').innerHTML = `${s.seatNo} ${s.name}`;

    // 重置選項UI
    document.getElementById('absent-options').classList.add('hidden');
    document.getElementById('late-options').classList.add('hidden');
    document.getElementById('statusModal').classList.remove('hidden');
    lucide.createIcons();
}

function toggleSubOptions(id) {
    const el = document.getElementById(id);
    // 關閉其他
    ['absent-options', 'late-options'].forEach(eid => {
        if (eid !== id) document.getElementById(eid).classList.add('hidden');
    });
    el.classList.toggle('hidden');
}

function confirmStatus(status, note = '') {
    if (currentStatusTarget === null) return;
    const data = classesData[currentClass];
    const s = data.students[currentStatusTarget];

    if (s) {
        s.status = status;
        s.note = note; // 紀錄事由或時間

        saveData();
        renderSeating();
        updateDashboardStats();
        saveAttendance(true); // 自動更新儲存
    }
    closeStatusModal();
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.add('hidden');
    currentStatusTarget = null;
}

/* 舊功能已廢棄: toggleStatus */

function updateLotteryHistory() {
    const container = document.getElementById('historyTags');
    if (!container) return;
    // 顯示最近 5 筆抽籤結果 (最新的在最前)
    const recent = lotteryHistory.slice(-5).reverse();
    container.innerHTML = recent.map(item => {
        // 相容舊資料 (純數字) 與新資料 (物件)
        const seat = (typeof item === 'object') ? item.seatNo : item;
        const name = (typeof item === 'object') ? item.name : '';
        const label = name ? `${seat} ${name}` : seat;
        return `<span class="inline-flex items-center justify-center bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm font-bold border border-indigo-500/30 animate-in zoom-in h-8">${label}</span>`;
    }).join('');
}

function startLottery() {
    // 限制只在 Dashboard 運作 (或確保元素存在)
    const quickActions = document.getElementById('quickDrawActions');
    if (quickActions) quickActions.classList.add('hidden');

    // 移除對 mainLotteryActions 的引用，因為他在新版面已被移除或隱藏

    const data = classesData[currentClass];
    if (!data) return;
    const allStudents = data.students;
    const validIndices = Object.keys(allStudents).filter(k => allStudents[k].status === 'present' || allStudents[k].status === 'late');

    if (!validIndices.length) return;

    // 鎖定目標為 Dashboard 的顯示器
    const target = document.getElementById('quickWinner');
    if (!target) return;

    // 重置樣式
    target.className = "text-3xl font-black text-slate-500";
    target.innerText = "?";

    let c = 0;
    let speed = 50;

    const run = () => {
        const randIdx = validIndices[Math.floor(Math.random() * validIndices.length)];
        const r = allStudents[randIdx];

        // 顯示
        target.innerText = `${r.seatNo} ${r.name}`;
        target.style.color = '#94a3b8'; // slate-400
        SoundFX.playTick();

        if (++c > 20) {
            // 結束抽籤
            const finalIdx = validIndices[Math.floor(Math.random() * validIndices.length)];
            const finalR = allStudents[finalIdx];
            // Format text
            const text = `${finalR.seatNo} ${finalR.name}`;

            target.innerText = text;
            lastWinnerIndex = finalIdx;

            // 特效
            SoundFX.playFanfare();

            // 統一儲存格式
            lotteryHistory.push({ seatNo: finalR.seatNo, name: finalR.name });
            updateLotteryHistory();

            // 顯示 Dashboard 按鈕
            if (quickActions) quickActions.classList.remove('hidden');

            if (window.lucide) lucide.createIcons();

            // 動畫樣式
            target.className = "text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse transition-all duration-300 transform scale-110";

            fireConfetti(target);
        } else {
            if (c > 15) speed += 30;
            setTimeout(run, speed);
        }
    };
    run();
}

// 簡易 CSS 粒子特效
function fireConfetti(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        document.body.appendChild(p);
        const color = ['#f472b6', '#38bdf8', '#fbbf24', '#22c55e'][Math.floor(Math.random() * 4)];
        p.style.cssText = `
                    position: fixed;
                    z-index: 9999;
                    left: ${centerX}px;
                    top: ${centerY}px;
                    width: 8px;
                    height: 8px;
                    background: ${color};
                    border-radius: 50%;
                    pointer-events: none;
                `;

        const angle = Math.random() * Math.PI * 2;
        const velocity = 5 + Math.random() * 10;
        const tx = Math.cos(angle) * velocity * 20;
        const ty = Math.sin(angle) * velocity * 20;

        p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'cubic-bezier(0, .9, .57, 1)',
            fill: 'forwards'
        }).onfinish = () => p.remove();
    }
}

function resetLottery() {
    // 清空歷史紀錄
    lotteryHistory = [];
    updateLotteryHistory();
    lastWinnerIndex = null;

    // 重置顯示文字
    const quickWinner = document.getElementById('quickWinner');
    if (quickWinner) {
        quickWinner.innerText = "?";
        quickWinner.className = "text-3xl font-black text-slate-500";
    }

    const mainWinner = document.getElementById('winnerName');
    if (mainWinner) {
        mainWinner.innerText = "?";
        mainWinner.className = "text-8xl font-black tracking-tighter text-slate-700";
    }

    // Reset Slots
    const slot1 = document.getElementById('slot1');
    const slot2 = document.getElementById('slot2');
    const nameDisp = document.getElementById('lotteryNameDisplay');
    if (slot1) slot1.innerText = "?";
    if (slot2) slot2.innerText = "?";
    if (nameDisp) {
        nameDisp.innerText = "WAITING...";
        nameDisp.className = "text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 opacity-50 scale-90 transition-all duration-500 filter blur-sm";
    }

    // 隱藏操作按鈕
    const quickActions = document.getElementById('quickDrawActions');
    const mainActions = document.getElementById('mainLotteryActions');
    if (quickActions) quickActions.classList.add('hidden');
    if (mainActions) mainActions.classList.add('hidden');

    const leftBtn = document.getElementById('btnLeftAction');
    const rightBtn = document.getElementById('btnRightAction');
    if (leftBtn) leftBtn.classList.add('hidden');
    if (rightBtn) rightBtn.classList.add('hidden');
}

// --- 老虎機抽籤邏輯 ---
function startSlotMachine() {
    const data = classesData[currentClass];
    if (!data) return;
    const allStudents = data.students;

    // 選取在席學生 (包含遲到)
    const validIndices = Object.keys(allStudents).filter(k => allStudents[k].status === 'present' || allStudents[k].status === 'late');
    if (!validIndices.length) {
        alert("目前沒有在席學生可供抽籤！");
        return;
    }

    const randomIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
    const winner = allStudents[randomIndex];
    lastWinnerIndex = randomIndex;

    // UI Elements
    const slot1 = document.getElementById('slot1');
    const slot2 = document.getElementById('slot2');
    const nameDisp = document.getElementById('lotteryNameDisplay');
    const btnSpin = document.getElementById('btnSpin');
    const leverRod = document.getElementById('leverRod');

    // Hide buttons
    const leftBtn = document.getElementById('btnLeftAction');
    const rightBtn = document.getElementById('btnRightAction');
    if (leftBtn) leftBtn.classList.add('hidden');
    if (rightBtn) rightBtn.classList.add('hidden');

    // Disable Spin
    btnSpin.disabled = true;
    btnSpin.style.pointerEvents = 'none';

    // Lever Animation (Pull Down)
    // 1. Reset to initial state without transition
    btnSpin.style.transition = "none";
    btnSpin.style.transform = "translate(-50%, 0px)";
    if (leverRod) {
        leverRod.style.transition = "none";
        leverRod.style.height = "40px"; // Default height from CSS/HTML usually 40px
    }

    // 2. Force reflow
    void btnSpin.offsetWidth;

    // 3. Apply animation
    btnSpin.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
    btnSpin.style.transform = "translate(-50%, 120px)";
    if (leverRod) {
        leverRod.style.transition = "height 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
        leverRod.style.height = "140px";
    }

    // Lever Return after delay
    setTimeout(() => {
        btnSpin.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
        btnSpin.style.transform = "";
        if (leverRod) {
            leverRod.style.transition = "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
            leverRod.style.height = "";
        }
    }, 250);

    // Initial Display
    nameDisp.innerText = "ROLLING...";
    nameDisp.className = "text-5xl font-black text-slate-500 opacity-50 blur-sm scale-95 transition-all custom-font-mono";

    // --- Sequential Scroll Logic ---
    const targetSeatKey = parseInt(winner.seatNo) || 0;
    // Start from a random number ensures fairness visually
    let currentVal = Math.floor(Math.random() * 100);

    // Calculations for the loop
    const range = 100; // 00-99
    const minLoops = 1; // At least 1 full rotation

    // Total steps to reach target from current
    // Distance formula: (Target - Current + Range) % Range
    // Add Loops * Range
    let stepsRemaining = (minLoops * range) + ((targetSeatKey - currentVal + range) % range);

    // Ensure we have enough "runway" for the slowdown effect (at least 50 steps total)
    if (stepsRemaining < 50) stepsRemaining += range;

    const run = () => {
        // Increment Logic (Standard Order 00->01->02...)
        currentVal = (currentVal + 1) % range;

        // Update UI
        const valStr = String(currentVal).padStart(2, '0');
        slot1.innerText = valStr[0];
        slot2.innerText = valStr[1];

        // Sound
        SoundFX.playTick();

        stepsRemaining--;

        if (stepsRemaining <= 0) {
            finish();
            return;
        }

        // Speed Curve
        // Base speed: 30ms (Fast)
        // Slow down in last 25 steps
        let delay = 30;
        const slowDownThreshold = 25;

        if (stepsRemaining < slowDownThreshold) {
            // Quadratic easing for slowdown
            // From 30ms to ~300ms
            const factor = (slowDownThreshold - stepsRemaining) / slowDownThreshold;
            delay = 30 + (factor * factor * 300);
        }

        setTimeout(run, delay);
    };

    const finish = () => {
        // Final Display of Seat Number
        const seatStr = String(winner.seatNo).padStart(2, '0');
        slot1.innerText = seatStr[0];
        slot2.innerText = seatStr[1];

        // Random Gradient
        const gradients = [
            "from-pink-500 via-rose-500 to-yellow-500",
            "from-sky-400 via-blue-500 to-indigo-500",
            "from-green-400 via-emerald-500 to-teal-500",
            "from-purple-500 via-violet-500 to-fuchsia-500",
            "from-orange-400 via-amber-500 to-red-500"
        ];
        const randGrad = gradients[Math.floor(Math.random() * gradients.length)];

        // Display Winner Name (Seat + Name)
        nameDisp.innerText = `${winner.seatNo} ${winner.name}`;
        nameDisp.className = `text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r ${randGrad} opacity-100 scale-110 blur-0 drop-shadow-[0_0_30px_rgba(255,255,250,0.4)] transition-all duration-500 animate-in zoom-in spin-in-3`;

        // Effects
        fireConfetti(slot1);
        fireConfetti(slot2);

        // Update History
        lotteryHistory.push({ seatNo: winner.seatNo, name: winner.name });
        updateLotteryHistory();

        // Show Action Buttons
        if (leftBtn) leftBtn.classList.remove('hidden');
        if (rightBtn) rightBtn.classList.remove('hidden');

        // Unlock Spin
        btnSpin.disabled = false;
        btnSpin.style.pointerEvents = 'auto';

        setTimeout(() => {
            slot1.classList.remove('animate-bounce');
            slot2.classList.remove('animate-bounce');
        }, 1000);
    };

    run();
}

// --- Textbook Links Logic ---

function openAddTextbookModal() {
    const name = prompt("請輸入教材名稱：");
    if (!name) return;
    const url = prompt("請輸入 PDF 連結 (Google Drive 或其他 URL)：");
    if (!url) return;

    textbookLinks.push({
        id: Date.now(),
        name: name,
        url: url,
        order: textbookLinks.length
    });

    saveData(); // Syncs to cloud
    renderTextbookGrid();
}

function renderTextbookGrid() {
    const grid = document.getElementById('textbookGrid');
    if (!grid) return;

    let html = '';

    if (textbookLayoutMode === 'list') {
        grid.className = "flex flex-col gap-4";
        textbookLinks.forEach((item, index) => {
            html += `
                <div class="glass-panel p-4 flex items-center gap-4 group hover:bg-slate-800/80 transition-all draggable-file" draggable="true" ondragstart="dragStart(event, ${index})" ondragover="dragOver(event)" ondrop="filesDrop(event, ${index})">
                    <div class="cursor-move w-10 flex justify-center text-slate-600 group-hover:text-slate-400 transition-colors">
                        <i data-lucide="grip-vertical" class="w-5 h-5"></i>
                    </div>
                    <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                        <i data-lucide="link" class="w-6 h-6 text-indigo-400/50 group-hover:text-indigo-400 transition-colors"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-lg leading-tight mb-1 truncate" title="${item.name}">${item.name}</h3>
                        <p class="text-xs text-slate-500 truncate text-slate-600">${item.url}</p>
                    </div>
                    
                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onclick="previewTextbookLink('${item.url}', '${item.name}')" class="px-4 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2">
                            <i data-lucide="eye" class="w-4 h-4"></i> 預覽
                        </button>
                        <button onclick="editTextbook(${index});" class="p-2 hover:bg-amber-500/20 rounded-lg text-slate-400 hover:text-amber-400 transition-colors" title="編輯連結">
                            <i data-lucide="edit-2" class="w-5 h-5"></i>
                        </button>
                        <button onclick="deleteTextbook(${index});" class="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors" title="刪除連結">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    } else {
        grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6";

        textbookLinks.forEach((item, index) => {
            html += `
                <div class="glass-panel p-0 overflow-hidden flex flex-col group hover:ring-2 hover:ring-indigo-500/50 transition-all draggable-file" draggable="true" ondragstart="dragStart(event, ${index})" ondragover="dragOver(event)" ondrop="filesDrop(event, ${index})">
                    <div class="h-40 bg-slate-800 relative flex items-center justify-center overflow-hidden cursor-move">
                        <i data-lucide="link" class="w-16 h-16 text-indigo-400/20 group-hover:scale-110 transition-transform duration-500"></i>
                         <div class="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60"></div>
                         <span class="absolute bottom-2 right-2 text-[10px] font-mono bg-slate-900/80 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/30">LINK</span>
                         <button onclick="deleteTextbook(${index}); event.stopPropagation();" class="absolute top-2 right-2 p-1.5 bg-slate-900/50 hover:bg-rose-500 rounded-lg text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100" title="刪除連結">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                         </button>
                          <button onclick="editTextbook(${index}); event.stopPropagation();" class="absolute top-2 right-10 p-1.5 bg-slate-900/50 hover:bg-amber-500 rounded-lg text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100" title="編輯連結">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                         </button>
                    </div>
                    <div class="p-4 flex-1 flex flex-col">
                        <h3 class="font-bold text-lg leading-tight mb-1 truncate" title="${item.name}">${item.name}</h3>
                        <p class="text-xs text-slate-500 mb-4 truncate text-slate-600">${item.url}</p>
                        <button onclick="previewTextbookLink('${item.url}', '${item.name}')" class="mt-auto w-full bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-700 group-hover:border-indigo-500/50">
                            <i data-lucide="eye" class="w-4 h-4"></i> 預覽
                        </button>
                    </div>
                </div>
            `;
        });
    }

    grid.innerHTML = html;
    lucide.createIcons();
}

let textbookLayoutMode = 'grid';

function setTextbookLayout(mode) {
    textbookLayoutMode = mode;

    // Update active button state
    document.getElementById('btnLayoutGrid').classList.toggle('bg-slate-700', mode === 'grid');
    document.getElementById('btnLayoutGrid').classList.toggle('text-white', mode === 'grid');
    document.getElementById('btnLayoutGrid').classList.toggle('text-slate-400', mode !== 'grid');

    document.getElementById('btnLayoutList').classList.toggle('bg-slate-700', mode === 'list');
    document.getElementById('btnLayoutList').classList.toggle('text-white', mode === 'list');
    document.getElementById('btnLayoutList').classList.toggle('text-slate-400', mode !== 'list');

    renderTextbookGrid();
}

// Drag and Drop Logic for Textbook Links
let draggedFileIndex = null;

function dragStart(event, index) {
    draggedFileIndex = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.innerHTML);
    event.target.classList.add('opacity-50');
}

function dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return false;
}

function filesDrop(event, targetIndex) {
    event.stopPropagation();
    event.preventDefault();

    const files = document.querySelectorAll('.draggable-file');
    files.forEach(file => file.classList.remove('opacity-50'));

    if (draggedFileIndex !== null && draggedFileIndex !== targetIndex) {
        // Reorder array
        const item = textbookLinks.splice(draggedFileIndex, 1)[0];
        textbookLinks.splice(targetIndex, 0, item);

        // Update functionality 'order'
        textbookLinks.forEach((f, i) => f.order = i);

        saveData(); // Sync new order
        renderTextbookGrid();
    }
    return false;
}

function deleteTextbook(index) {
    if (!confirm('確定要刪除這個教材連結嗎？')) return;
    textbookLinks.splice(index, 1);
    saveData();
    renderTextbookGrid();
}

function editTextbook(index) {
    const item = textbookLinks[index];
    const newName = prompt("請輸入新的教材名稱：", item.name);
    if (!newName) return;
    const newUrl = prompt("請輸入新的教材連結：", item.url);
    if (!newUrl) return;

    item.name = newName;
    item.url = newUrl;

    saveData();
    renderTextbookGrid();
}

function previewTextbookLink(url, name) {
    let finalUrl = url;
    // Basic Google Drive viewer support for preview
    if (url.includes('drive.google.com') && (url.includes('/view') || url.includes('/file/d/'))) {
        // Convert view link to preview link to avoid headers if possible, 
        // but generally just embedding the preview URL works best.
        // Replace /view with /preview
        finalUrl = url.replace(/\/view.*/, '/preview');
    }

    const iframe = document.getElementById('pdfPreviewFrame');
    const title = document.getElementById('pdfPreviewTitle');
    const downloadBtn = document.getElementById('pdfDownloadLink');
    const modal = document.getElementById('pdfPreviewModal');

    if (iframe && modal) {
        iframe.src = finalUrl;
        if (title) title.innerText = name;
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = name; // Attribute often ignored for cross-origin but good practice
        }
        modal.classList.remove('hidden');
    }
}

function closePdfPreview() {
    const modal = document.getElementById('pdfPreviewModal');
    const iframe = document.getElementById('pdfPreviewFrame');
    if (modal) modal.classList.add('hidden');
    if (iframe) iframe.src = "";
}

// --- 設定頁面邏輯 ---
function renderSettingsPage() {
    const listEl = document.getElementById('settingsClassList');
    if (!listEl) return;

    const keys = Object.keys(classesData).sort(); // Alphabetical Sort

    listEl.innerHTML = keys.map(cls => {
        const data = classesData[cls];
        const studentCount = data.students ? Object.keys(data.students).length : 0;
        const isCurrent = cls === currentClass;
        return `
                 <div class="bg-slate-800/50 border ${isCurrent ? 'border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.1)]' : 'border-slate-700/50'} rounded-2xl p-5 flex justify-between items-center group hover:bg-slate-800 transition-all">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <h3 class="text-xl font-black text-white">${cls}</h3>
                            ${isCurrent ? '<span class="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-bold border border-sky-500/30">CURRENT</span>' : ''}
                            <button onclick="renameClass('${cls}')" class="text-slate-500 hover:text-white transition-colors" title="修改班級名稱">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <p class="text-sm text-slate-500 font-medium">${studentCount} 位學生</p>
                    </div>
                    <div class="flex gap-2">
                         <button onclick="openStudentManager('${cls}')" class="p-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white transition-colors border border-sky-500/20" title="管理名單">
                            <i data-lucide="users" class="w-5 h-5"></i>
                        </button>
                        ${!isCurrent ? `
                        <button onclick="deleteClass('${cls}')" class="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors border border-rose-500/20" title="刪除班級">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>` : ''}
                    </div>
                 </div>
                 `;
    }).join('');
    renderReasonSettings();
    lucide.createIcons();
}

// --- 班級管理 ---
function renameClass(oldName) {
    const newName = prompt(`請輸入 [${oldName}] 的新名稱：`, oldName);
    if (!newName || newName === oldName) return;
    if (classesData[newName]) {
        alert('該班級名稱已存在！');
        return;
    }

    // 1. Copy data to new key
    classesData[newName] = classesData[oldName];
    delete classesData[oldName];

    // 2. Update currentClass if needed
    if (currentClass === oldName) {
        currentClass = newName;
    }

    // 3. Update Timetable references
    Object.values(teacherTimetable).forEach(daySchedule => {
        for (let i = 0; i < daySchedule.length; i++) {
            if (daySchedule[i] === oldName) {
                daySchedule[i] = newName;
            }
        }
    });

    saveData();
    initClassSelector();
    initTimetableEditor(); // Refresh timetable UI
    renderSettingsPage();
    alert(`已將 [${oldName}] 更名為 [${newName}]`);
}

function deleteClass(cls) {
    if (!confirm(`確定要刪除 [${cls}] 嗎？此動作無法復原！`)) return;

    delete classesData[cls];

    // If deleting current class, switch to another if available
    if (cls === currentClass) {
        const remaining = Object.keys(classesData);
        if (remaining.length > 0) {
            currentClass = remaining[0];
        } else {
            classesData['default'] = { students: {}, history: [], seatingLayout: [], attendanceLogs: [] };
            currentClass = 'default';
        }
    }

    saveData();
    initClassSelector(); // Refresh dropdown
    renderSettingsPage(); // Refresh list
    alert('班級已刪除');
}

let managingClass = null;

function openStudentManager(cls) {
    managingClass = cls;
    document.getElementById('studentManagerTitle').innerText = cls;
    document.getElementById('studentManagerModal').classList.remove('hidden');
    renderStudentManagerList();
}

function closeStudentManager() {
    document.getElementById('studentManagerModal').classList.add('hidden');
    managingClass = null;
    // Refresh other views if modified current class
    if (currentTab === 'seating') renderSeating();
    if (currentTab === 'leaderboard') renderLeaderboard();
    if (currentTab === 'settings') renderSettingsPage(); // Update counts
}

function renderStudentManagerList() {
    if (!managingClass) return;
    const students = Object.values(classesData[managingClass].students);
    // Sort by seat number
    students.sort((a, b) => parseInt(a.seatNo) - parseInt(b.seatNo));

    const listEl = document.getElementById('studentManagerList');
    if (students.length === 0) {
        listEl.innerHTML = `<div class="text-center text-slate-500 py-8">此班級尚無學生</div>`;
        return;
    }

    listEl.innerHTML = students.map(s => `
                <div class="grid grid-cols-12 gap-4 items-center bg-slate-800/30 p-3 rounded-xl border border-white/5 hover:bg-slate-800 transition-colors group">
                    <div class="col-span-2 text-center font-mono font-bold text-slate-300 bg-slate-900 rounded-lg py-1">${s.seatNo}</div>
                    <div class="col-span-4 font-bold text-white truncate">${s.name}</div>
                    <div class="col-span-3 text-center font-mono text-yellow-500">${s.score || 0}</div>
                    <div class="col-span-3 text-right flex justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onclick="editStudent('${s.seatNo}')" class="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-white transition-colors" title="編輯">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button onclick="managerDeleteStudent('${s.seatNo}')" class="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors" title="刪除">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('');
    lucide.createIcons();
}

function editStudent(seatNo) {
    const data = classesData[managingClass];
    // Find student by seatNo value since keys are grid indices
    const student = Object.values(data.students).find(s => s.seatNo === seatNo);

    if (student) {
        document.getElementById('manageSeatNo').value = student.seatNo;
        document.getElementById('manageName').value = student.name;
        document.getElementById('manageName').focus(); // Focus name for quick edit
    }
}

function managerAddStudent() {
    if (!managingClass) return;
    const seatInput = document.getElementById('manageSeatNo');
    const nameInput = document.getElementById('manageName');
    const seatNo = seatInput.value.trim().padStart(2, '0');
    const name = nameInput.value.trim();

    if (!seatNo || !name) {
        alert('請輸入座號與姓名');
        return;
    }

    // Check if this seat number already exists
    const existingKey = Object.keys(classesData[managingClass].students).find(k =>
        classesData[managingClass].students[k].seatNo === seatNo
    );

    if (existingKey) {
        // Update existing student (preserve score, history, etc.)
        if (!confirm(`座號 ${seatNo} 已存在 (${classesData[managingClass].students[existingKey].name})，確定要更新資料嗎？`)) return;

        const existingStudent = classesData[managingClass].students[existingKey];
        existingStudent.name = name;
        // seatNo is same
    } else {
        // New Student
        classesData[managingClass].students['temp_' + seatNo] = {
            id: seatNo,
            seatNo: seatNo,
            name: name,
            score: 0,
            status: 'present',
            note: '',
            history: []
        };
    }

    saveData();
    reflowClassLayout(managingClass); // Sort and assign Grid Keys
    renderStudentManagerList();

    // Refresh main view if managing current class
    if (managingClass === currentClass && currentTab === 'seating') renderSeating();

    // Clear inputs
    seatInput.value = '';
    nameInput.value = '';
    seatInput.focus();
}

function managerDeleteStudent(seatNo) {
    if (!confirm(`確定要刪除座號 ${seatNo} 嗎？`)) return;

    const data = classesData[managingClass];
    // Find key by value
    const targetKey = Object.keys(data.students).find(k => data.students[k].seatNo === seatNo);

    if (targetKey) {
        delete data.students[targetKey];
        saveData();
        reflowClassLayout(managingClass);
        renderStudentManagerList();
        if (managingClass === currentClass && currentTab === 'seating') renderSeating();
    }
}

// --- 舊的 Import Class 改寫 (整合進來) ---

// --- 教材資源管理邏輯 ---

// Helper: Convert Google Drive Link to Direct Image Link (Preview/Download)
function getDriveDirectLink(url) {
    if (!url) return '';
    let processedUrl = url.trim();
    try {
        let id = '';
        // Pattern 1: https://drive.google.com/file/d/FILE_ID/view...
        const matchFile = processedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (matchFile) {
            id = matchFile[1];
        }
        // Pattern 2: https://drive.google.com/open?id=FILE_ID
        else if (processedUrl.includes('id=') && processedUrl.includes('drive.google.com')) {
            const matchId = processedUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (matchId) id = matchId[1];
        }

        if (id) {
            // Use lh3.googleusercontent.com for better direct image support
            return `https://lh3.googleusercontent.com/d/${id}`;
        }
    } catch (e) { console.error('URL parse error', e); }
    return processedUrl;
}

// Helper: Convert Google Drive Link to Preview Embed Link (for PDF/Docs)
function getDrivePreviewLink(url) {
    if (!url) return '';
    let processedUrl = url.trim();
    try {
        let id = '';
        const matchFile = processedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (matchFile) id = matchFile[1];
        else if (processedUrl.includes('id=') && processedUrl.includes('drive.google.com')) {
            const matchId = processedUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (matchId) id = matchId[1];
        }

        if (id) {
            return `https://drive.google.com/file/d/${id}/preview`; // Preview mode for iframe
        }
    } catch (e) { }
    // If not a drive link, return as is (assuming direct PDF or website)
    return processedUrl;
}

function renderResources() {
    const grid = document.getElementById('resourceGrid');
    if (!grid) return;

    grid.innerHTML = teachingResources.map(r => {
        // Background: Cover Image OR Icon Fallback
        let bgContent = '';
        const coverUrl = getDriveDirectLink(r.cover);

        if (coverUrl && coverUrl.length > 0) {
            bgContent = `<img src="${coverUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">`;
        } else {
            bgContent = `<div class="w-full h-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors"><i data-lucide="${r.icon || 'book'}" class="w-12 h-12 text-slate-600 group-hover:text-slate-400 transition-colors"></i></div>`;
        }

        // Tag Color logic
        const colorMap = {
            'sky': 'bg-sky-500/20 text-sky-400',
            'orange': 'bg-orange-500/20 text-orange-400',
            'emerald': 'bg-emerald-500/20 text-emerald-400',
            'rose': 'bg-rose-500/20 text-rose-400',
            'violet': 'bg-violet-500/20 text-violet-400',
            'amber': 'bg-amber-500/20 text-amber-400'
        };
        const tagClass = colorMap[r.tagColor] || 'bg-slate-500/20 text-slate-400';

        return `
            <div onclick="openResourceDetail('${r.id}')" class="glass-panel overflow-hidden group relative flex flex-col h-full hover:ring-2 hover:ring-indigo-500/50 transition-all w-[85%] md:w-[calc((100%-3rem)/3)] flex-shrink-0 snap-center cursor-pointer">
                <div class="h-40 relative overflow-hidden bg-slate-900 border-b border-white/5">
                    ${bgContent}
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60"></div>
                </div>
                <div class="p-5 flex-1 flex flex-col relative">
                    <div class="absolute -top-3 left-4">
                        <span class="text-[10px] ${tagClass} px-2 py-0.5 rounded uppercase font-bold shadow-lg backdrop-blur-md border border-white/5">${r.tag}</span>
                    </div>
                    <h5 class="font-bold mt-2 text-lg leading-tight text-white group-hover:text-sky-400 transition-colors">${r.title}</h5>
                    <p class="text-xs text-slate-400 mt-2 line-clamp-2">${r.desc}</p>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function scrollResources(direction) {
    const container = document.getElementById('resourceGrid');
    if (container) {
        const scrollAmount = container.clientWidth * 0.8;
        container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
}

let tempResources = [];

function openResourceManager() {
    // Clone data to temp
    tempResources = JSON.parse(JSON.stringify(teachingResources));
    renderResourceManagerList();
    document.getElementById('resourceManagerModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeResourceManager() {
    document.getElementById('resourceManagerModal').classList.add('hidden');
}

function renderResourceManagerList() {
    const list = document.getElementById('resourceEditorList');
    list.innerHTML = tempResources.map((r, i) => {
        const directUrl = getDriveDirectLink(r.cover);

        // Content List HTML
        const contentHtml = (r.contents || []).map((c, j) => `
            <div class="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700 mb-2">
                <div class="flex-shrink-0 text-slate-500 font-mono text-xs w-4">${j + 1}.</div>
                <div class="flex flex-col gap-1 mr-1">
                     <button onclick="moveContent(${i}, ${j}, -1)" class="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white ${j === 0 ? 'opacity-30 pointer-events-none' : ''}"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
                     <button onclick="moveContent(${i}, ${j}, 1)" class="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white ${j === (r.contents || []).length - 1 ? 'opacity-30 pointer-events-none' : ''}"><i data-lucide="chevron-down" class="w-3 h-3"></i></button>
                </div>
                <select onchange="updateContent(${i}, ${j}, 'type', this.value)" class="bg-slate-800 border-slate-600 rounded text-xs py-1 px-1 text-slate-300 w-16">
                    <option value="pdf" ${c.type === 'pdf' ? 'selected' : ''}>PDF</option>
                    <option value="link" ${c.type === 'link' ? 'selected' : ''}>Link</option>
                    <option value="video" ${c.type === 'video' ? 'selected' : ''}>Video</option>
                </select>
                <input type="text" value="${c.title}" placeholder="標題" onchange="updateContent(${i}, ${j}, 'title', this.value)" class="bg-slate-800 border-slate-600 rounded text-xs py-1 px-2 text-white flex-1 min-w-[80px]">
                <input type="text" value="${c.url}" placeholder="URL (Google Drive/PDF)" onchange="updateContent(${i}, ${j}, 'url', this.value)" class="bg-slate-800 border-slate-600 rounded text-xs py-1 px-2 text-sky-300 flex-[2] min-w-[120px] font-mono">
                <button onclick="removeContent(${i}, ${j})" class="text-slate-500 hover:text-rose-400 p-1"><i data-lucide="x" class="w-3 h-3"></i></button>
            </div>
        `).join('');

        return `
        <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 group">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-2">
                    <div class="flex flex-col gap-0.5 mr-2 bg-slate-900 rounded p-0.5 border border-slate-700">
                         <button onclick="moveResource(${i}, -1)" class="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white ${i === 0 ? 'opacity-30 pointer-events-none' : ''}"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
                         <button onclick="moveResource(${i}, 1)" class="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white ${i === tempResources.length - 1 ? 'opacity-30 pointer-events-none' : ''}"><i data-lucide="chevron-down" class="w-3 h-3"></i></button>
                    </div>
                    <span class="text-xs font-mono text-slate-500">ID: ${r.id}</span>
                </div>
                <button onclick="deleteResource(${i})" class="text-slate-500 hover:text-rose-400 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            
            <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                     <label class="text-[10px] text-slate-400 uppercase font-bold">標題</label>
                     <input type="text" value="${r.title}" onchange="updateTempResource(${i}, 'title', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none">
                </div>
                <div class="col-span-2">
                     <label class="text-[10px] text-slate-400 uppercase font-bold">描述</label>
                     <input type="text" value="${r.desc}" onchange="updateTempResource(${i}, 'desc', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none">
                </div>
                <div>
                     <label class="text-[10px] text-slate-400 uppercase font-bold">標籤文字</label>
                     <input type="text" value="${r.tag}" onchange="updateTempResource(${i}, 'tag', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none">
                </div>
                <div>
                     <label class="text-[10px] text-slate-400 uppercase font-bold">標籤顏色</label>
                     <select onchange="updateTempResource(${i}, 'tagColor', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none">
                        <option value="sky" ${r.tagColor === 'sky' ? 'selected' : ''}>Sky Blue</option>
                        <option value="orange" ${r.tagColor === 'orange' ? 'selected' : ''}>Orange</option>
                        <option value="emerald" ${r.tagColor === 'emerald' ? 'selected' : ''}>Emerald</option>
                        <option value="rose" ${r.tagColor === 'rose' ? 'selected' : ''}>Rose Red</option>
                        <option value="violet" ${r.tagColor === 'violet' ? 'selected' : ''}>Violet</option>
                        <option value="amber" ${r.tagColor === 'amber' ? 'selected' : ''}>Amber</option>
                     </select>
                </div>
                <div class="col-span-2">
                     <label class="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        封面圖片 URL 
                        <span class="text-[10px] text-slate-500 font-normal normal-case">(支援 Google Drive 共享連結)</span>
                     </label>
                     <input type="text" value="${r.cover || ''}" placeholder="https://drive.google.com/..." onchange="updateTempResource(${i}, 'cover', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-orange-300 focus:border-orange-500 outline-none font-mono">
                </div>
                 <div class="col-span-2 ${r.cover ? 'hidden' : ''}">
                     <label class="text-[10px] text-slate-400 uppercase font-bold">預設圖示 (Icon)</label>
                     <input type="text" value="${r.icon || 'book'}" onchange="updateTempResource(${i}, 'icon', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none">
                </div>
            </div>
            
            ${directUrl ? `
            <div class="mt-2 h-32 rounded-lg bg-slate-900 overflow-hidden relative border border-slate-700">
                <img src="${directUrl}" class="w-full h-full object-cover opacity-80" onerror="this.src='https://via.placeholder.com/400x200?text=Load+Error';">
                <div class="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">Preview</div>
            </div>
            ` : ''}

            <!-- Contents Section -->
            <div class="mt-2 pt-2 border-t border-slate-700/50">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-[10px] text-slate-400 uppercase font-bold">單元內容 (PDF/Links)</label>
                    <button onclick="addContent(${i})" class="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-0.5 rounded flex items-center gap-1">
                        <i data-lucide="plus" class="w-3 h-3"></i> 新增內容
                    </button>
                </div>
                <div class="space-y-1">
                    ${contentHtml.length > 0 ? contentHtml : '<div class="text-xs text-slate-600 italic">尚無內容</div>'}
                </div>
            </div>
        </div>
    `;
    }).join('');
    lucide.createIcons();
}

function updateTempResource(index, field, value) {
    tempResources[index][field] = value;
    // Re-render only if image or conditional fields changed to show preview
    if (field === 'cover' || field === 'tagColor') {
        renderResourceManagerList();
    }
}

function addContent(rIdx) {
    if (!tempResources[rIdx].contents) tempResources[rIdx].contents = [];
    tempResources[rIdx].contents.push({ type: 'pdf', title: '新的教材', url: '' });
    renderResourceManagerList();
}

function removeContent(rIdx, cIdx) {
    tempResources[rIdx].contents.splice(cIdx, 1);
    renderResourceManagerList();
}

function updateContent(rIdx, cIdx, field, value) {
    tempResources[rIdx].contents[cIdx][field] = value;
}

function addNewResource() {
    tempResources.push({
        id: 'new_' + Date.now(),
        title: '新教材單元',
        desc: '請輸入描述...',
        tag: 'New',
        tagColor: 'sky',
        icon: 'book',
        cover: '',
        contents: []
    });
    renderResourceManagerList();
    // Scroll to bottom
    setTimeout(() => {
        const list = document.getElementById('resourceEditorList');
        list.scrollTop = list.scrollHeight;
    }, 100);
}

function deleteResource(index) {
    if (!confirm('確定要刪除此教材卡片嗎？')) return;
    tempResources.splice(index, 1);
    renderResourceManagerList();
}

function saveResources() {
    teachingResources = JSON.parse(JSON.stringify(tempResources));
    saveData();
    renderResources();
    closeResourceManager();
    alert('教材資源已更新！');
}

function moveResource(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tempResources.length) return;

    // Swap
    const temp = tempResources[index];
    tempResources[index] = tempResources[newIndex];
    tempResources[newIndex] = temp;

    renderResourceManagerList();
}

function moveContent(rIdx, cIdx, direction) {
    const contents = tempResources[rIdx].contents;
    const newIndex = cIdx + direction;
    if (newIndex < 0 || newIndex >= contents.length) return;

    // Swap
    const temp = contents[cIdx];
    contents[cIdx] = contents[newIndex];
    contents[newIndex] = temp;

    renderResourceManagerList();
}

// --- 教材單元詳情頁面邏輯 ---
let currentResContents = [];
let currentResIndex = 0;
let isResSidebarCollapsed = false;

function updateResSidebarUI() {
    const sidebar = document.getElementById('resSidebar');
    const text = document.getElementById('resSidebarText');
    const icon = document.getElementById('resSidebarIcon');

    if (!sidebar) return;

    if (isResSidebarCollapsed) {
        sidebar.classList.remove('md:w-72', 'w-full');
        sidebar.classList.add('w-16');

        if (text) {
            text.classList.add('opacity-0', 'w-0');
            text.classList.remove('opacity-100');
        }

        if (icon) icon.classList.add('rotate-180');

        document.querySelectorAll('.res-item-detail').forEach(el => el.classList.add('hidden'));
    } else {
        sidebar.classList.add('md:w-72', 'w-full');
        sidebar.classList.remove('w-16');

        if (text) {
            text.classList.remove('opacity-0', 'w-0');
            text.classList.add('opacity-100');
        }

        if (icon) icon.classList.remove('rotate-180');

        document.querySelectorAll('.res-item-detail').forEach(el => el.classList.remove('hidden'));
    }
}

function toggleResSidebar() {
    isResSidebarCollapsed = !isResSidebarCollapsed;
    updateResSidebarUI();
}


function openResourceDetail(id) {
    currentTab = 'resource-detail'; // 防止 Google Sync 完成後跳回 Dashboard
    const resource = teachingResources.find(r => r.id === id);
    if (!resource) return;

    // Deselect Nav Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow-lg');
        btn.classList.add('text-slate-400', 'hover:bg-slate-800');
    });

    // Hide all sections manually (or rely on switchTab logic if adapted, but here we do it manually to show detail view)
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    const detailSection = document.getElementById('view-resource-detail');
    detailSection.classList.remove('hidden');

    // Populate Info
    document.getElementById('resDetailTitle').textContent = resource.title;
    document.getElementById('resDetailTag').textContent = resource.tag;

    // Store contents for access
    currentResContents = resource.contents || [];

    // Render Sidebar List
    const list = document.getElementById('resDetailList');
    if (currentResContents.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-500 p-4 text-center">本單元尚無教材內容</div>';
        document.getElementById('resViewerFrame').classList.add('hidden');
        document.getElementById('resViewerPlaceholder').classList.remove('hidden');
        return;
    }

    list.innerHTML = currentResContents.map((c, i) => `
        <div onclick="loadResContent(${i})" id="resItem-${i}" class="bg-slate-800/50 hover:bg-slate-700/80 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-600 group mb-2 relative overflow-hidden" title="${c.title}">
            <div class="flex items-center gap-3 justify-center md:justify-start">
                <div class="w-8 h-8 shrink-0 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <i data-lucide="${c.type === 'video' ? 'play-circle' : c.type === 'link' ? 'link' : 'file-text'}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0 res-item-detail ${isResSidebarCollapsed ? 'hidden' : ''}">
                    <h5 class="text-sm font-bold text-slate-200 group-hover:text-white truncate">${c.title}</h5>
                    <p class="text-[10px] text-slate-500 truncate font-mono opacity-0 group-hover:opacity-100 transition-opacity">${c.type.toUpperCase()}</p>
                </div>
            </div>
        </div>
    `).join('');

    updateResSidebarUI();
    lucide.createIcons();

    // Auto-load first item
    if (currentResContents.length > 0) {
        loadResContent(0);
    }
}

function loadResContent(index) {
    currentResIndex = index;
    const content = currentResContents[index];
    const frame = document.getElementById('resViewerFrame');
    const placeholder = document.getElementById('resViewerPlaceholder');

    // Highlight sidebar item
    document.querySelectorAll('#resDetailList > div').forEach((el, i) => {
        if (i === index) {
            el.classList.add('bg-indigo-600/20', 'border-indigo-500/50');
            el.classList.remove('bg-slate-800/50', 'border-transparent');
        } else {
            el.classList.remove('bg-indigo-600/20', 'border-indigo-500/50');
            el.classList.add('bg-slate-800/50', 'border-transparent');
        }
    });

    if (!content.url) {
        frame.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    // Determine URL (Handle Google Drive Preview)
    let finalUrl = content.url;

    // If it's a Drive link, force preview mode for embedding
    const previewLink = getDrivePreviewLink(content.url);
    // Logic: getDrivePreviewLink returns original if not matched, or preview url if matched.
    // However, if type is 'video' (e.g. YouTube), we might need different handling? 
    // For now, assume PDF/Link are main targets.

    if (previewLink !== content.url) {
        finalUrl = previewLink;
    }

    frame.src = finalUrl;
    frame.onload = () => {
        placeholder.classList.add('hidden');
        frame.classList.remove('hidden');
    };
    // Force show if onload doesn't trigger (some strict CSP sites)
    placeholder.classList.add('hidden');
    frame.classList.remove('hidden');
}

function toggleResFullscreen() {
    const container = document.getElementById('resViewerContainer');
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
}

function openResExternal() {
    if (currentResContents[currentResIndex]) {
        window.open(currentResContents[currentResIndex].url, '_blank');
    }
}
function importClass() {
    const name = document.getElementById('newClassName').value.trim();
    const raw = document.getElementById('importArea').value.trim();

    if (!name) { alert('請輸入班級名稱'); return; }
    if (classesData[name]) { alert('班級名稱已存在'); return; }
    if (!raw) { alert('請輸入名單資料'); return; }

    const lines = raw.split('\n');
    const newStudents = {};
    let count = 0;

    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const seatNo = parts[0].trim();
            const sName = parts[1].trim();
            newStudents[seatNo] = {
                seatNo: seatNo,
                name: sName,
                score: 0,
                status: 'present',
                note: ''
            };
            count++;
        }
    });

    if (count === 0) { alert('無法解析名單，請確認格式'); return; }

    classesData[name] = {
        students: newStudents,
        history: [],
        seatingLayout: [], // default empty
        attendanceLogs: [],
        config: { cols: 6, rows: 8 } // Default config
    };

    saveData();
    reflowClassLayout(name); // Convert SeatKeys to GridKeys

    initClassSelector();
    renderSettingsPage();

    // clear inputs
    document.getElementById('newClassName').value = '';
    document.getElementById('importArea').value = '';

    alert(`成功建立班級 [${name}]，共 ${count} 位學生`);
}

// --- 班級紀錄頁面渲染邏輯 (取代原本的 Modal) ---
function renderRecordsPage() {
    renderAttendanceList('pageAttendanceList');
    renderScoreHistoryList('pageScoreList');
    lucide.createIcons();
}

function renderAttendanceList(targetId) {
    const data = classesData[currentClass];
    const logs = data.attendanceLogs || [];
    const list = document.getElementById(targetId);
    const countLabel = document.getElementById('attendanceCount');
    if (countLabel) countLabel.innerText = `${logs.length} 筆資料`;

    // 使用 originalIdx 保留原始索引以便編輯
    const logsWithIdx = logs.map((log, idx) => ({ ...log, originalIdx: idx }));
    logsWithIdx.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (logs.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-500 py-10 opacity-50">尚無點名紀錄</div>`;
    } else {
        list.innerHTML = logsWithIdx.map(log => {
            const date = new Date(log.time);
            const dateStr = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            let detailHtml = '';
            if (log.details.length > 0) {
                // 排序：缺席優先，然後遲到；同狀態依座號排序
                const sortedDetails = [...log.details].sort((a, b) => {
                    const statusOrder = { 'absent': 0, 'late': 1 };
                    const sA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 99;
                    const sB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 99;
                    if (sA !== sB) return sA - sB;

                    const noA = parseInt(a.seatNo.replace(/[^\d]/g, '')) || 0;
                    const noB = parseInt(b.seatNo.replace(/[^\d]/g, '')) || 0;
                    return noA - noB;
                });

                detailHtml = `<div class="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-2">` +
                    sortedDetails.map(d => {
                        let color;
                        if (d.status === 'absent') {
                            color = 'text-rose-400 bg-rose-500/10';
                        } else {
                            color = 'text-amber-400 bg-amber-500/10';
                        }
                        // 只顯示詳細 Note，若無 Note 則顯示簡短狀態
                        let label = d.note ? `(${d.note})` : (d.status === 'absent' ? '(缺席)' : '(遲到)');

                        return `<span class="text-[10px] px-2 py-1 rounded ${color}">${d.seatNo} ${d.name} <span class="opacity-70">${label}</span></span>`;
                    }).join('') +
                    `</div>`;
            } else {
                detailHtml = `<div class="mt-2 text-xs text-emerald-500/50 flex items-center"><i data-lucide="check" class="w-3 h-3 mr-1"></i> 全勤</div>`;
            }

            // Note Logic
            const noteContent = log.note || "";
            const hasNote = noteContent && noteContent.trim().length > 0;
            const noteLabel = hasNote ? "查看記事" : "新增記事";
            const noteColor = hasNote ? "text-sky-400" : "text-slate-600";
            const icon = hasNote ? "file-text" : "file-plus";

            return `
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 hover:border-slate-500 transition-all cursor-pointer group" onclick="toggleAttendanceNote(${log.originalIdx}, event)">
                        <div class="flex justify-between items-start mb-1">
                            <div>
                                <div class="text-sky-400 font-bold font-mono text-sm">${dateStr}</div>
                                <div class="text-slate-500 font-mono text-xs">${timeStr}</div>
                            </div>
                            <div class="flex flex-col items-end gap-1 text-xs font-bold">
                                <span class="text-emerald-500">出席 ${log.stats.present}</span>
                                <div class="flex gap-2">
                                    <span class="text-rose-500">缺 ${log.stats.absent}</span>
                                    <span class="text-amber-500">遲 ${log.stats.late}</span>
                                </div>
                            </div>
                        </div>
                        ${detailHtml}
                        
                        <!-- Note Indicator -->
                        <div class="mt-2 flex justify-end relative z-10" id="note-display-${log.originalIdx}">
                            <div class="text-[10px] ${noteColor} flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity bg-slate-800/50 px-2 py-1 rounded-full">
                                <i data-lucide="${icon}" class="w-3 h-3"></i>
                                <span>${noteLabel}</span>
                            </div>
                        </div>

                        <!-- Hidden Editor -->
                        <div class="hidden mt-3 pt-2 border-t border-slate-800 animate-in slide-in-from-top-1" id="note-editor-${log.originalIdx}" onclick="event.stopPropagation()">
                            <textarea id="note-input-${log.originalIdx}" 
                                class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:ring-1 focus:ring-sky-500 outline-none resize-none placeholder-slate-600" 
                                rows="3" placeholder="記錄上課進度或特殊狀況...">${noteContent}</textarea>
                            <div class="flex justify-end gap-2 mt-2">
                                <button onclick="saveAttendanceNote(${log.originalIdx}, event)" class="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded text-xs shadow-lg">儲存</button>
                            </div>
                        </div>
                    </div>
                    `;
        }).join('');
    }
    lucide.createIcons();
}

function toggleAttendanceNote(idx, event) {
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'TEXTAREA') return;

    const display = document.getElementById(`note-display-${idx}`);
    const editor = document.getElementById(`note-editor-${idx}`);

    // Toggle logic
    if (display && editor) {
        if (editor.classList.contains('hidden')) {
            // Close all other editors first
            document.querySelectorAll('[id^="note-editor-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="note-display-"]').forEach(el => el.classList.remove('hidden'));

            editor.classList.remove('hidden');
            display.classList.add('hidden');

            // Focus textarea
            const ta = editor.querySelector('textarea');
            if (ta) ta.focus();

        } else {
            editor.classList.add('hidden');
            display.classList.remove('hidden');
        }
    }
}

function saveAttendanceNote(idx, event) {
    event.stopPropagation(); // Stop bubbling
    const input = document.getElementById(`note-input-${idx}`);
    if (!input) return;

    const val = input.value.trim();
    const data = classesData[currentClass];
    if (data && data.attendanceLogs && data.attendanceLogs[idx]) {
        data.attendanceLogs[idx].note = val;
        saveData();
        renderAttendanceList('pageAttendanceList'); // Re-render to update view
    }
}

let scoreHistoryPage = 1;
const SCORE_ITEMS_PER_PAGE = 10;

function renderScoreHistoryList(targetId) {
    const list = document.getElementById(targetId);
    const studentData = classesData[currentClass].students;

    // 收集所有紀錄
    let allLogs = [];
    Object.entries(studentData).forEach(([sIdx, s]) => {
        if (s.history && s.history.length > 0) {
            s.history.forEach((log, logIdx) => {
                allLogs.push({
                    ...log,
                    name: s.name,
                    seatNo: s.seatNo,
                    studentIdx: sIdx,
                    logIdx: logIdx
                });
            });
        }
    });

    // 進階排序邏輯：
    // 1. 先將同一時間批次操作的紀錄分組
    // 2. 組與組之間按時間新到舊排序
    // 3. 組內紀錄依照座號由大到小排序 (越上面座號越大)
    const groups = {};
    allLogs.forEach(log => {
        // 使用 time 作為 key，批次操作時 time 字串會完全相同
        const t = log.time;
        if (!groups[t]) groups[t] = [];
        groups[t].push(log);
    });

    // 依時間倒序排列各組
    const sortedTimes = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

    // 重組 list
    allLogs = [];
    sortedTimes.forEach(t => {
        const batch = groups[t];
        // 組內依座號倒序 (大 -> 小)
        batch.sort((a, b) => {
            const seatA = parseInt(a.seatNo) || 0;
            const seatB = parseInt(b.seatNo) || 0;
            return seatB - seatA;
        });
        allLogs.push(...batch);
    });

    // Pagination Logic
    const totalItems = allLogs.length;
    const totalPages = Math.ceil(totalItems / SCORE_ITEMS_PER_PAGE) || 1;
    if (scoreHistoryPage > totalPages) scoreHistoryPage = totalPages;
    if (scoreHistoryPage < 1) scoreHistoryPage = 1;

    const startIndex = (scoreHistoryPage - 1) * SCORE_ITEMS_PER_PAGE;
    const pagedLogs = allLogs.slice(startIndex, startIndex + SCORE_ITEMS_PER_PAGE);

    if (totalItems === 0) {
        list.innerHTML = `<div class="text-center text-slate-500 py-10 opacity-50">尚無評分紀錄</div>`;
    } else {
        const listHtml = pagedLogs.map((log, i) => {
            const date = new Date(log.time);
            const dateStr = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            const isPositive = log.delta > 0;
            const valId = `${log.studentIdx}_${log.logIdx}`;

            return `
                    <div class="flex items-start gap-3 bg-slate-900 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors group relative">
                        <div class="pt-1">
                             <input type="checkbox" value="${valId}" data-delta="${log.delta}" class="history-checkbox w-4 h-4 rounded bg-slate-800 border-slate-600 text-rose-500 focus:ring-offset-0 focus:ring-1 focus:ring-rose-500" onchange="updateRevokeBtnState()">
                        </div>
                        
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-bold text-slate-300 text-sm">${log.seatNo} ${log.name}</span>
                                    <span class="font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'} text-sm">
                                        ${isPositive ? '+' : ''}${log.delta}
                                    </span>
                                </div>
                                <div class="text-[10px] font-mono text-slate-500 text-right leading-tight">
                                    <div>${dateStr}</div>
                                    <div>${timeStr}</div>
                                </div>
                            </div>
                            <div class="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded inline-block">
                                ${log.reason}
                            </div>
                        </div>
                    </div>
                    `;
        }).join('');

        // Pagination Controls
        const paginationHtml = `
            <div class="flex justify-between items-center mt-4 pt-2 border-t border-slate-700/50">
                <button onclick="changeScorePage(-1)" ${scoreHistoryPage === 1 ? 'disabled' : ''} class="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <span class="text-xs text-slate-500 font-mono">Page ${scoreHistoryPage} / ${totalPages}</span>
                <button onclick="changeScorePage(1)" ${scoreHistoryPage === totalPages ? 'disabled' : ''} class="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        list.innerHTML = listHtml + paginationHtml;
    }
    lucide.createIcons();
    updateRevokeBtnState();
}

function changeScorePage(delta) {
    scoreHistoryPage += delta;
    renderScoreHistoryList('pageScoreList');
}

function updateRevokeBtnState() {
    const checked = document.querySelectorAll('.history-checkbox:checked').length;
    const btn = document.getElementById('pageBtnRevoke'); // Update ID
    if (btn) {
        btn.disabled = checked === 0;
        btn.innerHTML = checked > 0 ? `<i data-lucide="undo-2" class="w-3 h-3"></i> 撤銷已選 (${checked})` : `<i data-lucide="undo-2" class="w-3 h-3"></i> 撤銷紀錄`;
        lucide.createIcons();
    }
}

// 修改 revokeHistory 以支援新頁面重繪
function revokeHistory(isPage = false) {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`確定要撤銷這 ${checkboxes.length} 筆紀錄嗎？\n學生的分數將會被復原。`)) return;

    const data = classesData[currentClass];
    const tasks = {};

    checkboxes.forEach(cb => {
        const [sIdx, lIdx] = cb.value.split('_');
        const delta = parseInt(cb.dataset.delta);
        if (!tasks[sIdx]) tasks[sIdx] = [];
        tasks[sIdx].push({ logIdx: parseInt(lIdx), delta });
    });

    Object.keys(tasks).forEach(sIdx => {
        const s = data.students[sIdx];
        if (!s || !s.history) return;
        tasks[sIdx].forEach(task => { s.score = (s.score || 0) - task.delta; });
        const indicesToDelete = new Set(tasks[sIdx].map(t => t.logIdx));
        s.history = s.history.filter((_, idx) => !indicesToDelete.has(idx));
    });

    saveData();
    if (isPage) renderScoreHistoryList('pageScoreList');
    renderSeating(); // Re-render seating to reflect score changes
}

function clearAllData() { if (confirm('重置？')) { localStorage.clear(); location.reload(); } }
// --- 點名功能 ---
function saveAttendance(isAuto = false) {
    const data = classesData[currentClass];
    if (!data.attendanceLogs) data.attendanceLogs = [];

    const now = new Date();
    const dateString = now.toDateString(); // e.g. "Fri Feb 02 2024"

    // 檢查是否已有今日紀錄
    let targetRecord = data.attendanceLogs.find(log => new Date(log.time).toDateString() === dateString);

    if (!targetRecord) {
        targetRecord = {
            id: now.getTime(),
            time: now.toISOString(),
            stats: { present: 0, absent: 0, late: 0, other: 0 },
            details: []
        };
        data.attendanceLogs.push(targetRecord);
    } else {
        // 更新時間與內容
        targetRecord.time = now.toISOString();
        targetRecord.stats = { present: 0, absent: 0, late: 0, other: 0 };
        targetRecord.details = [];
    }

    const students = Object.values(data.students);
    students.forEach(s => {
        if (s.status === 'present') {
            targetRecord.stats.present++;
        } else {
            if (targetRecord.stats[s.status] !== undefined) targetRecord.stats[s.status]++;
            else targetRecord.stats.other++;

            targetRecord.details.push({
                seatNo: s.seatNo,
                name: s.name,
                status: s.status,
                note: s.note // 儲存詳細資訊
            });
        }
    });

    saveData();

    if (!isAuto) {
        // 手動觸發時才跳 Alert
        const counts = targetRecord.stats;
        alert(`更新完成！\n出席: ${counts.present}\n缺席: ${counts.absent}\n遲到: ${counts.late}\n已更新今日點名紀錄。`);
    } else {
        console.log('Attendance auto-saved with details');
    }
}

function showAttendanceHistory() {
    const data = classesData[currentClass];
    const logs = data.attendanceLogs || [];
    const list = document.getElementById('attendanceList');
    const modal = document.getElementById('attendanceHistoryModal');

    // 排序：新到舊
    logs.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (logs.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-500 py-10">尚無點名紀錄</div>`;
    } else {
        list.innerHTML = logs.map(log => {
            const date = new Date(log.time);
            const dateStr = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            // 生成異常名單字串
            let detailHtml = '';
            if (log.details.length > 0) {
                detailHtml = `<div class="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-2">` +
                    log.details.map(d => {
                        let color = d.status === 'absent' ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10';
                        let label = d.status === 'absent' ? '缺席' : '遲到';
                        return `<span class="text-xs px-2 py-1 rounded ${color}">${d.seatNo} ${d.name} (${label})</span>`;
                    }).join('') +
                    `</div>`;
            } else {
                detailHtml = `<div class="mt-2 text-xs text-emerald-500/70"><i data-lucide="check-circle" class="w-3 h-3 inline mr-1"></i> 全員出席</div>`;
            }

            return `
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <div class="flex justify-between items-center mb-1">
                            <div class="flex items-center gap-3">
                                <span class="text-sky-400 font-bold font-mono text-lg">${dateStr}</span>
                                <span class="text-slate-500 font-mono text-sm">${timeStr}</span>
                            </div>
                            <div class="flex gap-3 text-sm font-bold">
                                <span class="text-emerald-500">出席 ${log.stats.present}</span>
                                <span class="text-rose-500">缺席 ${log.stats.absent}</span>
                                <span class="text-amber-500">遲到 ${log.stats.late}</span>
                            </div>
                        </div>
                        ${detailHtml}
                    </div>
                    `;
        }).join('');
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeAttendanceHistory() {
    document.getElementById('attendanceHistoryModal').classList.add('hidden');
}

// --- 排行榜渲染邏輯 ---
function renderLeaderboard() {
    const data = classesData[currentClass];
    document.getElementById('leaderboardClassTitle').innerText = `${currentClass}`;

    // Get valid students and sort by score
    const students = Object.values(data.students).filter(s => s);
    students.sort((a, b) => {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA; // 分數高者在前
        return (parseInt(a.seatNo) || 0) - (parseInt(b.seatNo) || 0); // 同分依座號小到大 (較小者在前)
    });

    const podiumEl = document.getElementById('leaderboardPodium');
    const listEl = document.getElementById('leaderboardList');

    // Top 3
    const top3 = students.slice(0, 3);

    let podiumHtml = '';

    // 2nd Place (Left)
    if (top3[1]) {
        podiumHtml += `
                <div class="flex flex-col items-center animate-in slide-in-from-left duration-700 z-10 order-1">
                    <div class="relative group">
                        <!-- Glow -->
                        <div class="absolute -inset-4 bg-slate-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
                        
                        <!-- Avatar -->
                        <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-500 p-[3px] shadow-[0_10px_20px_-5px_rgba(148,163,184,0.4)] transform rotate-[-3deg] group-hover:rotate-0 transition-all duration-300">
                            <div class="w-full h-full rounded-xl bg-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                                <span class="text-3xl font-black text-slate-200 z-10 leading-none mb-1">${top3[1].seatNo}</span>
                                <span class="text-xs font-bold text-slate-300/90 tracking-wider z-10">${top3[1].name}</span>
                                <div class="absolute inset-0 bg-gradient-to-t from-slate-700/50 to-transparent"></div>
                            </div>
                        </div>
                        
                        <!-- Badge -->
                        <div class="absolute -top-3 -right-3 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-800 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-lg border border-white/20 rotate-[10deg]">2</div>
                    </div>
                    
                    <!-- Info -->
                    <div class="mt-4 text-center mb-2">
                         <div class="px-3 py-0.5 rounded-full bg-slate-800 border border-slate-600 inline-block">
                            <span class="font-black text-slate-300">${top3[1].score}</span> <span class="text-[10px] text-slate-500 font-bold">PTS</span>
                        </div>
                    </div>
                    
                    <!-- Podium Block -->
                    <div class="w-32 h-40 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700/80 rounded-t-2xl border-t border-slate-500/30 relative overflow-hidden backdrop-blur-md shadow-2xl">
                         <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                         <div class="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-slate-400 to-transparent opacity-50"></div>
                         <div class="w-full h-full flex items-end justify-center pb-4 opacity-10 font-black text-6xl text-slate-500">2</div>
                    </div>
                </div>`;
    } else {
        podiumHtml += `<div class="w-32 order-1"></div>`;
    }

    // 1st Place (Center)
    if (top3[0]) {
        podiumHtml += `
                <div class="flex flex-col items-center z-20 -mx-2 pb-6 animate-in zoom-in duration-500 order-2">
                     <div class="relative group scale-110 mb-2">
                        <!-- Radiant Glow -->
                        <div class="absolute -inset-10 bg-gradient-to-r from-yellow-500/30 via-orange-500/30 to-yellow-500/30 rounded-full blur-2xl opacity-60 animate-pulse-soft"></div>
                        <div class="absolute -inset-1 bg-gradient-to-r from-yellow-300 via-white to-yellow-300 rounded-2xl blur opacity-70 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
                        
                        <!-- Crown -->
                        <i data-lucide="crown" class="absolute -top-12 left-1/2 -translate-x-1/2 text-yellow-400 w-12 h-12 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] filter brightness-125 animate-bounce"></i>
                        
                        <!-- Avatar -->
                        <div class="w-32 h-32 rounded-2xl bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-600 p-1 shadow-[0_0_50px_rgba(234,179,8,0.4)] transform hover:-translate-y-2 transition-transform duration-300">
                             <div class="w-full h-full rounded-xl bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
                                <span class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 z-10 leading-none mb-2">${top3[0].seatNo}</span>
                                <span class="text-base font-bold text-yellow-100/90 tracking-widest z-10">${top3[0].name}</span>
                                <div class="absolute inset-0 bg-gradient-to-t from-yellow-900/20 to-transparent"></div>
                                <div class="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent"></div>
                            </div>
                        </div>
                        
                        <!-- Badge -->
                         <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-full font-black text-xs shadow-lg border border-yellow-400/50 tracking-widest uppercase">Champion</div>
                    </div>
                    
                    <!-- Info -->
                    <div class="mt-8 text-center mb-4">
                         <div class="px-5 py-1 rounded-full bg-gradient-to-r from-slate-900/80 to-slate-800/80 border border-yellow-500/30 inline-flex items-end gap-1 shadow-lg backdrop-blur-md">
                            <span class="font-black text-4xl text-yellow-400 leading-none">${top3[0].score}</span> 
                            <span class="text-xs text-yellow-600 font-bold mb-1">PTS</span>
                        </div>
                    </div>
                    
                    <!-- Podium Block -->
                    <div class="w-44 h-56 bg-gradient-to-t from-yellow-950 via-yellow-900/60 to-slate-800 rounded-t-3xl border-t border-yellow-500/50 relative overflow-hidden backdrop-blur-xl shadow-[0_0_40px_rgba(234,179,8,0.15)] flex flex-col justify-end items-center">
                         <div class="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
                         <div class="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                         
                         <!-- Rank Big Number -->
                         <div class="font-black text-8xl text-yellow-600/10 mb-4 mix-blend-overlay">1</div>
                    </div>
                </div>`;
    }

    // 3rd Place (Right)
    if (top3[2]) {
        podiumHtml += `
                <div class="flex flex-col items-center animate-in slide-in-from-right duration-700 z-10 order-3">
                     <div class="relative group">
                         <!-- Glow -->
                        <div class="absolute -inset-4 bg-orange-700/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>

                        <!-- Avatar -->
                        <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-700 p-[3px] shadow-[0_10px_20px_-5px_rgba(194,65,12,0.3)] transform rotate-[3deg] group-hover:rotate-0 transition-all duration-300">
                             <div class="w-full h-full rounded-xl bg-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                                <span class="text-3xl font-black text-orange-200 z-10 leading-none mb-1">${top3[2].seatNo}</span>
                                <span class="text-xs font-bold text-orange-200/80 tracking-wider z-10">${top3[2].name}</span>
                                <div class="absolute inset-0 bg-gradient-to-t from-orange-900/30 to-transparent"></div>
                            </div>
                        </div>
                        
                         <!-- Badge -->
                        <div class="absolute -top-3 -left-3 bg-gradient-to-br from-orange-100 to-orange-300 text-orange-900 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-lg border border-white/20 rotate-[-10deg]">3</div>
                    </div>
                    
                    <!-- Info -->
                    <div class="mt-4 text-center mb-2">
                        <div class="px-3 py-0.5 rounded-full bg-slate-800 border border-slate-600 inline-block">
                            <span class="font-black text-orange-400">${top3[2].score}</span> <span class="text-[10px] text-slate-500 font-bold">PTS</span>
                        </div>
                    </div>
                    
                     <!-- Podium Block -->
                    <div class="w-32 h-28 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700/80 rounded-t-2xl border-t border-orange-500/30 relative overflow-hidden backdrop-blur-md shadow-2xl">
                         <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                         <div class="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-50"></div>
                         <div class="w-full h-full flex items-end justify-center pb-4 opacity-10 font-black text-6xl text-orange-500">3</div>
                    </div>
                </div>`;
    } else {
        podiumHtml += `<div class="w-32 order-3"></div>`;
    }

    podiumEl.innerHTML = podiumHtml;

    // Rest of list (4th onwards)
    const rest = students.slice(3);
    listEl.innerHTML = rest.map((s, i) => {
        const rank = i + 4;
        return `
                <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700/50 hover:border-slate-600 group">
                    <div class="font-mono font-bold text-slate-500 w-6 text-center group-hover:text-white transition-colors">${rank}</div>
                    <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-300">
                        ${s.seatNo}
                    </div>
                    <div class="flex-1 font-bold text-slate-300 group-hover:text-white transition-colors">${s.name}</div>
                    <div class="font-mono font-bold text-sky-400 bg-sky-950/30 px-3 py-1 rounded-lg">${s.score}</div>
                </div>
                `;
    }).join('');

    lucide.createIcons();
}

// --- 懸浮計時器邏輯 ---
let timerState = {
    totalSeconds: 300,
    remainingSeconds: 300,
    isRunning: false,
    intervalId: null
};

function toggleTimerModal() {
    const el = document.getElementById('floatingTimer');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
        el.classList.add('animate-in', 'zoom-in-95', 'slide-in-from-bottom-5');
    }
    lucide.createIcons();
}

function updateTimerDisplay() {
    const m = Math.floor(timerState.remainingSeconds / 60);
    const s = timerState.remainingSeconds % 60;
    document.getElementById('timerDisplay').innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Progress
    const progress = document.getElementById('timerProgress');
    const circumference = 283;
    const offset = circumference - (timerState.remainingSeconds / timerState.totalSeconds) * circumference;
    progress.style.strokeDashoffset = offset;

    if (timerState.remainingSeconds <= 10 && timerState.remainingSeconds > 0) {
        progress.classList.add('text-rose-500');
        progress.style.stroke = '#f43f5e';
        if (timerState.remainingSeconds % 2 !== 0 && timerState.isRunning) SoundFX.playTick();
    } else {
        progress.style.stroke = '#fbbf24';
    }
}

// --- Module Reordering Logic ---
function renderModules() {
    const container = document.getElementById('modulesContainer');
    if (!container) return;

    container.innerHTML = modules.map((m, index) => {
        const colorClass = {
            'sky': 'bg-sky-500/20 text-sky-400 group-hover:bg-sky-500/5',
            'emerald': 'bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/5',
            'orange': 'bg-orange-500/20 text-orange-400 group-hover:bg-orange-500/5',
            'pink': 'bg-pink-500/20 text-pink-400 group-hover:bg-pink-500/5',
            'violet': 'bg-violet-500/20 text-violet-400 group-hover:bg-violet-500/5'
        }[m.color] || 'bg-slate-500/20 text-slate-400';

        const iconBg = {
            'sky': 'bg-sky-500/20 text-sky-400',
            'emerald': 'bg-emerald-500/20 text-emerald-400',
            'orange': 'bg-orange-500/20 text-orange-400',
            'pink': 'bg-pink-500/20 text-pink-400',
            'violet': 'bg-violet-500/20 text-violet-400'
        }[m.color] || 'bg-slate-500/20 text-slate-400';

        // Reorder Controls
        let controls = '';
        if (isModuleReordering) {
            controls = `
                <div class="absolute top-2 right-2 flex gap-1 z-20" onclick="event.stopPropagation()">
                    <button onclick="moveModule(${index}, -1)" class="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white ${index === 0 ? 'opacity-30 pointer-events-none' : ''}">
                        <i data-lucide="chevron-left" class="w-4 h-4"></i>
                    </button>
                    <button onclick="moveModule(${index}, 1)" class="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white ${index === modules.length - 1 ? 'opacity-30 pointer-events-none' : ''}">
                         <i data-lucide="chevron-right" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div onclick="${isModuleReordering ? '' : m.action}"
                class="dashboard-card glass-panel p-5 cursor-pointer flex flex-col items-center text-center group transition-colors min-w-[160px] w-[calc(50%-12px)] md:w-[calc(25%-18px)] flex-shrink-0 snap-start relative ${isModuleReordering ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''}">
                ${controls}
                <div
                    class="w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <i data-lucide="${m.icon}"></i>
                </div>
                <h4 class="font-bold mb-1">${m.title}</h4>
                <p class="text-xs text-slate-500">${m.desc}</p>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function toggleModuleReorder() {
    isModuleReordering = !isModuleReordering;
    const btn = document.getElementById('btnModuleReorder');
    if (btn) {
        if (isModuleReordering) {
            btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500');
            btn.classList.remove('bg-slate-800', 'text-slate-400', 'border-slate-700');
            btn.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> 完成`;
        } else {
            btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500');
            btn.classList.add('bg-slate-800', 'text-slate-400', 'border-slate-700');
            btn.innerHTML = `<i data-lucide="arrow-left-right" class="w-3 h-3"></i> 排序`;
        }
    }
    renderModules();
}

function moveModule(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= modules.length) return;

    // Swap
    [modules[index], modules[newIndex]] = [modules[newIndex], modules[index]];
    saveData();
    renderModules();
}

function timerAction(action) {
    if (action === 'toggle') {
        if (timerState.isRunning) {
            clearInterval(timerState.intervalId);
            timerState.isRunning = false;
            document.getElementById('timerStatusLabel').innerText = "PAUSED";
            document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
        } else {
            if (timerState.remainingSeconds <= 0) return;
            timerState.isRunning = true;
            document.getElementById('timerStatusLabel').innerText = "RUNNING";
            document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="pause" class="w-6 h-6 fill-current"></i>`;

            timerState.intervalId = setInterval(() => {
                timerState.remainingSeconds--;
                updateTimerDisplay();

                if (timerState.remainingSeconds <= 0) {
                    clearInterval(timerState.intervalId);
                    timerState.isRunning = false;
                    document.getElementById('timerStatusLabel').innerText = "TIME UP";
                    document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
                    SoundFX.playFanfare();
                    const modal = document.getElementById('floatingTimer');
                    modal.classList.add('ring-4', 'ring-rose-500');
                    setTimeout(() => modal.classList.remove('ring-4', 'ring-rose-500'), 1000);
                }
            }, 1000);
        }
    } else if (action === 'reset') {
        clearInterval(timerState.intervalId);
        timerState.isRunning = false;
        timerState.remainingSeconds = timerState.totalSeconds;
        document.getElementById('timerStatusLabel').innerText = "READY";
        document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
        updateTimerDisplay();
    }
    lucide.createIcons();
}

function setTimer(minutes) {
    clearInterval(timerState.intervalId);
    timerState.isRunning = false;
    timerState.totalSeconds = minutes * 60;
    timerState.remainingSeconds = timerState.totalSeconds;
    document.getElementById('timerStatusLabel').innerText = "READY";
    document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
    updateTimerDisplay();
    lucide.createIcons();
}

// Draggable Logic
const dragHandle = document.getElementById('timerDragHandle');
const dragModal = document.getElementById('floatingTimer');
let isDragging = false;
let startX, startY, initialLeft, initialTop;

if (dragHandle) { // Check existence to avoid error before execution
    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = dragModal.getBoundingClientRect();
        if (!dragModal.style.left) {
            dragModal.style.left = rect.left + 'px';
            dragModal.style.top = rect.top + 'px';
            dragModal.style.bottom = 'auto';
            dragModal.style.right = 'auto';
        }
        initialLeft = parseFloat(dragModal.style.left);
        initialTop = parseFloat(dragModal.style.top);
        dragModal.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        dragModal.style.left = `${initialLeft + dx}px`;
        dragModal.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (dragModal) dragModal.style.cursor = 'default';
        document.body.style.userSelect = '';
    });
}

// Settings Page Toggle
function toggleSettingsSection(sectionId) {
    const wrapper = document.getElementById(`wrapper-${sectionId}`);
    const arrow = document.getElementById(`chevron-${sectionId}`);

    if (wrapper) {
        wrapper.classList.toggle('grid-rows-[1fr]');
        wrapper.classList.toggle('grid-rows-[0fr]');
        wrapper.classList.toggle('opacity-50'); // Optional: Add opacity transition
    }

    if (arrow) {
        arrow.classList.toggle('rotate-180');
    }
}

// --- Score Reason Settings Logic ---
function renderReasonSettings() {
    ['positive', 'negative'].forEach(type => {
        const container = document.getElementById(`list-${type}`);
        if (!container) return;

        const list = scoreReasons[type];
        container.innerHTML = list.map((reason, index) => {
            const isFirst = index === 0;
            const isLast = index === list.length - 1;
            return `
            <div class="flex items-center justify-between group bg-slate-900/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-500 transition-colors">
                <span class="text-sm text-white font-medium pl-1 break-all mr-2 flex-1 text-left">${reason}</span>
                <div class="flex items-center gap-1 opacity-100 lg:opacity-50 lg:group-hover:opacity-100 transition-all">
                    <button onclick="moveReason('${type}', ${index}, -1)" class="p-1 hover:text-sky-400 ${isFirst ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500'}" ${isFirst ? 'disabled' : ''} title="上移">
                        <i data-lucide="arrow-up" class="w-3 h-3"></i>
                    </button>
                    <button onclick="moveReason('${type}', ${index}, 1)" class="p-1 hover:text-sky-400 ${isLast ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500'}" ${isLast ? 'disabled' : ''} title="下移">
                        <i data-lucide="arrow-down" class="w-3 h-3"></i>
                    </button>
                    <div class="w-px h-3 bg-slate-700 mx-1"></div>
                    <button onclick="editReason('${type}', ${index})" class="text-slate-500 hover:text-indigo-400 p-1" title="編輯">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                    </button>
                    <button onclick="deleteReason('${type}', ${index})" class="text-slate-500 hover:text-red-400 p-1" title="刪除">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    });
    if (window.lucide) lucide.createIcons();
}

function addReason(type) {
    const input = document.getElementById(`input-${type}`);
    const val = input.value.trim();
    if (!val) return;

    scoreReasons[type].push(val);
    saveData();
    input.value = '';
    renderReasonSettings();
}

function deleteReason(type, index) {
    if (confirm(`確定要刪除「${scoreReasons[type][index]}」嗎？`)) {
        scoreReasons[type].splice(index, 1);
        saveData();
        renderReasonSettings();
    }
}

function editReason(type, index) {
    const oldVal = scoreReasons[type][index];
    const newVal = prompt("編輯理由：", oldVal);
    if (newVal === null || newVal.trim() === "") return;

    scoreReasons[type][index] = newVal.trim();
    saveData();
    renderReasonSettings();
}

function moveReason(type, index, direction) {
    const list = scoreReasons[type];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= list.length) return;

    // Swap
    [list[index], list[newIndex]] = [list[newIndex], list[index]];
    saveData();
    renderReasonSettings();
}










// --- Keyboard Demo Logic ---
// --- Keyboard Demo Logic ---
let activeKeysOrder = [];

function toggleKey(el) {
    const isPressed = el.classList.toggle('pressed');

    if (isPressed) {
        // Add to order
        activeKeysOrder.push(el);
    } else {
        // Remove from order
        activeKeysOrder = activeKeysOrder.filter(k => k !== el);
    }

    updateKeyDisplay();
}

function resetKeyboard() {
    document.querySelectorAll('.key-cap').forEach(el => {
        el.classList.remove('pressed');
    });
    activeKeysOrder = [];
    updateKeyDisplay();
}

function getKeyName(k) {
    // 0. Try explicitly set data-key (Robust fix for icons/empty keys)
    if (k.hasAttribute('data-key')) {
        return k.getAttribute('data-key');
    }

    // 1. Try direct text
    let text = k.innerText.trim();
    if (text) return text;

    // 2. Try Icon (Fallback)
    const icon = k.querySelector('i');
    if (icon) {
        const name = icon.getAttribute('data-lucide');
        if (name === 'layout-grid') return 'Win';
        if (name === 'menu') return 'Menu';
        return name;
    }
    return '?';
}

function updateKeyDisplay() {
    const display = document.getElementById('currentKeyDisplay');

    // Check if real active keys are still consistent (double check safety)
    // Filter out any key elements that might have been removed or lost 'pressed' class unexpectedly
    activeKeysOrder = activeKeysOrder.filter(k => k.classList.contains('pressed'));

    if (activeKeysOrder.length === 0) {
        display.innerHTML = '<span class="text-slate-600 text-2xl animate-pulse">Waiting for input...</span>';
        display.classList.remove('border-sky-500', 'shadow-[0_0_15px_rgba(14,165,233,0.3)]');
        return;
    }

    const combination = activeKeysOrder.map(k => getKeyName(k)).join(' + ');
    display.innerText = combination;
    display.classList.add('border-sky-500', 'shadow-[0_0_15px_rgba(14,165,233,0.3)]');
}

function saveGasUrl() {
    const input = document.getElementById('gasUrlInput');
    if (input && typeof GoogleSync !== 'undefined') {
        GoogleSync.setURL(input.value);
        alert('連線設定已儲存，正在嘗試同步...');
    }
}

function scrollModules(direction) {
    const container = document.getElementById('modulesContainer');
    if (container) {
        const scrollAmount = container.clientWidth * 0.5; // Scroll half view width
        container.scrollBy({
            left: direction * scrollAmount,
            behavior: 'smooth'
        });
    }
}

function exportOfflineFile() {
    saveData(true); // Ensure latest state is in globals
    const bundle = {
        classesData: window.classesData,
        teacherTimetable: window.teacherTimetable,
        periodTimes: window.periodTimes,
        scoreReasons: window.scoreReasons,
        gasUrl: localStorage.getItem('it-class-master-gas-url') || '',
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `IT_Class_Master_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerImportFile() {
    document.getElementById('backupFileInput').click();
}

function importOfflineFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            console.log("Importing backup:", data);

            if (data.classesData) {
                if (confirm('確定要從備份檔還原資料嗎？\\n這將會覆蓋當前所有的班級與設定。')) {
                    // Restore Data
                    classesData = data.classesData;
                    teacherTimetable = data.teacherTimetable || teacherTimetable;
                    periodTimes = data.periodTimes || periodTimes;
                    scoreReasons = data.scoreReasons || scoreReasons;

                    // Sync variables to window
                    window.classesData = classesData;
                    window.teacherTimetable = teacherTimetable;
                    window.periodTimes = periodTimes;
                    window.scoreReasons = scoreReasons;

                    // Restore GAS URL if available and simpler setup
                    if (data.gasUrl) {
                        localStorage.setItem('it-class-master-gas-url', data.gasUrl);
                    }

                    saveData(true); // Save to local storage
                    alert('還原成功！網頁將重新載入。');
                    location.reload();
                }
            } else {
                alert('錯誤：無效的備份檔案格式。');
            }
        } catch (err) {
            console.error(err);
            alert('還原失敗：檔案無法讀取 (' + err.message + ')');
        }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
}
/* --- Relax / Joke Feature --- */
const jokes = [
    { q: "為什麼企鵝只有肚子是白的？", a: "因為手短洗不到背。" },
    { q: "什麼動物最愛亂買東西？", a: "斑馬，因為牠是黑白買（台語）。" },
    { q: "綠豆哪裡人？", a: "嘉義人（綠豆加薏仁）。" },
    { q: "皮卡丘站起來變什麼？", a: "皮卡兵（乒乓球）。" },
    { q: "鉛筆姓什麼？", a: "蕭（削鉛筆）。" },
    { q: "哪種花最沒力？", a: "茉莉花（好一朵美麗的茉莉花 -> 沒力花）。" },
    { q: "什麼布剪不斷？", a: "瀑布。" },
    { q: "猴子最討厭什麼線？", a: "平行線（因為沒有相交 -> 香蕉）。" },
    { q: "為什麼飛機撞不到星星？", a: "因為星星會「閃」。" },
    { q: "鍵盤裡的哪個鍵最帥？", a: "F4。" },
    { q: "蚊子不叮哪種動物？", a: "布丁狗（因為布丁）。" },
    { q: "第 11 本書（猜一句成語）", a: "不可思議（Book 11）。" },
    { q: "羊打電話給老鷹（猜一句成語）", a: "陽奉陰違（羊Phone鷹喂）。" }
];

function openRelaxModal() {
    document.getElementById('relaxModal').classList.remove('hidden');
    nextJoke();
}

function nextJoke() {
    const qEl = document.getElementById('jokeQuestion');
    const aEl = document.getElementById('jokeAnswer');
    const btn = document.getElementById('btnShowAnswer');

    if (!qEl || !aEl) return;

    // Pick random
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

    qEl.innerText = randomJoke.q;
    aEl.innerText = randomJoke.a;

    // Reset state
    aEl.classList.add('hidden');
    const container = aEl.closest('div');
    if (container) {
        container.classList.remove('bg-pink-900/20', 'border-pink-500/30');
        container.classList.add('bg-slate-800/50', 'border-slate-700/50');
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '看謎底';
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function showJokeAnswer() {
    const aEl = document.getElementById('jokeAnswer');
    const btn = document.getElementById('btnShowAnswer');

    if (aEl) aEl.classList.remove('hidden');

    // Highlight
    const container = aEl.closest('div');
    if (container) {
        container.classList.remove('bg-slate-800/50', 'border-slate-700/50');
        container.classList.add('bg-pink-900/20', 'border-pink-500/30');
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '已揭曉';
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// --- 模組化達人 (Polygon) 邏輯 ---
let polyCtx = null;
let polyAnimId = null;
let isPolyRunning = false;

function initPolygon() {
    const canvas = document.getElementById('polyCanvas');
    const container = document.getElementById('canvasContainer');

    if (!canvas || !container) return;

    // Resize canvas to fit container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    polyCtx = canvas.getContext('2d');
    polyCtx.lineCap = 'round';
    polyCtx.lineJoin = 'round';
    polyCtx.lineWidth = 4;
    polyCtx.strokeStyle = '#6366f1'; // Indigo-500

    clearPolygon();
    updatePolyParams(); // Sync UI

    // Default to Level 1
    if (window.currentPolyLevel === undefined) {
        setPolyLevel(1);
    }
}

let currentPolyLevel = 1;

function setPolyLevel(level) {
    currentPolyLevel = level;

    // Update Tabs
    // Simplified Scalable Logic
    const buttons = [
        document.getElementById('btnLevel1'),
        document.getElementById('btnLevel2'),
        document.getElementById('btnLevel3'),
        document.getElementById('btnLevel4')
    ];
    const views = [
        document.getElementById('polyLevel1'),
        document.getElementById('polyLevel2'),
        document.getElementById('polyLevel3'),
        document.getElementById('polyLevel4')
    ];

    buttons.forEach((btn, index) => {
        if (!btn) return;
        if (index + 1 === level) {
            btn.classList.remove('bg-slate-800', 'text-slate-400', 'border-slate-700');
            btn.classList.add('bg-slate-700', 'text-white', 'border-slate-600');
        } else {
            btn.classList.add('bg-slate-800', 'text-slate-400', 'border-slate-700');
            btn.classList.remove('bg-slate-700', 'text-white', 'border-slate-600');
        }
    });

    views.forEach((view, index) => {
        if (!view) return;
        if (index + 1 === level) {
            view.classList.remove('hidden');
        } else {
            view.classList.add('hidden');
        }
    });
}

function updatePolyParams(isAngleManual = false) {
    const sidesInput = document.getElementById('polySides');
    const lengthInput = document.getElementById('polyLength');
    const angleInput = document.getElementById('polyAngle');
    const autoCheck = document.getElementById('autoAngle');

    if (!sidesInput || !lengthInput || !angleInput) return;

    if (!isAngleManual && autoCheck.checked) {
        const sides = parseInt(sidesInput.value);
        if (sides > 0) {
            const autoVal = Math.round(360 / sides);
            angleInput.value = autoVal;
        }
    } else if (isAngleManual) {
        autoCheck.checked = false;
    }

    // Update Text Display
    document.getElementById('polySidesVal').innerText = sidesInput.value;
    document.getElementById('polyLengthVal').innerText = lengthInput.value;
    document.getElementById('polyAngleVal').innerText = angleInput.value + '°';

    // Update Speed Display
    const speedInput = document.getElementById('polySpeed');
    if (speedInput) {
        document.getElementById('polySpeedVal').innerText = speedInput.value + 'x';
    }

    // Update Scratch Blocks Text (Class-based for multiple instances)
    document.querySelectorAll('.poly-sides-display').forEach(el => el.innerText = sidesInput.value);
    document.querySelectorAll('.poly-length-display').forEach(el => el.innerText = lengthInput.value);
    document.querySelectorAll('.poly-angle-display').forEach(el => el.innerText = angleInput.value);

    // Legacy ID support (safe to remove if IDs are gone, but keeping just in case)
    const elSides = document.getElementById('blockSides');
    if (elSides) elSides.innerText = sidesInput.value;
    const elLength = document.getElementById('blockLength');
    if (elLength) elLength.innerText = lengthInput.value;
    const elAngle = document.getElementById('blockAngle');
    if (elAngle) elAngle.innerText = angleInput.value;
}

function toggleAutoAngle() {
    const autoCheck = document.getElementById('autoAngle');
    if (autoCheck.checked) {
        updatePolyParams();
    }
}

function clearPolygon() {
    const canvas = document.getElementById('polyCanvas');
    if (!canvas || !polyCtx) return;

    // Stop any running animation
    // Stop any running animation
    isPolyRunning = false;

    // Cancel rAF
    if (polyAnimId) {
        cancelAnimationFrame(polyAnimId);
        polyAnimId = null;
    }

    // Cancel Timeout (if any)
    if (window.polyTimeoutId) {
        clearTimeout(window.polyTimeoutId);
        window.polyTimeoutId = null;
    }

    if (polyCtx) {
        polyCtx.clearRect(0, 0, canvas.width, canvas.height);
        polyCtx.beginPath();
    }

    // Reset Turtle UI position
    const turtle = document.getElementById('turtleSprite');
    const icon = document.getElementById('turtleIcon');

    if (turtle) {
        turtle.style.left = '50%';
        turtle.style.top = '50%';
        turtle.style.transition = 'none';
    }

    if (icon) {
        icon.style.transform = 'rotate(90deg)';
    }

    const stepEl = document.getElementById('runStep');
    if (stepEl) stepEl.innerText = '0';

    const totalEl = document.getElementById('totalSteps');
    if (totalEl && document.getElementById('polySides'))
        totalEl.innerText = document.getElementById('polySides').value;

    const angleEl = document.getElementById('currentAngleVal');
    if (angleEl) angleEl.innerText = '90°';
}

function runPolygon() {
    if (isPolyRunning) return;

    clearPolygon();
    isPolyRunning = true;

    const sidesEl = document.getElementById('polySides');
    const lengthEl = document.getElementById('polyLength');
    const angleEl = document.getElementById('polyAngle');

    if (!sidesEl || !lengthEl || !angleEl) return;

    const sides = parseInt(sidesEl.value);
    const length = parseInt(lengthEl.value);
    const turnAngle = parseInt(angleEl.value);

    const totalStepsEl = document.getElementById('totalSteps');
    if (totalStepsEl) totalStepsEl.innerText = sides;

    const canvas = document.getElementById('polyCanvas');
    let currentX = canvas.width / 2;
    let currentY = canvas.height / 2;

    let currentDir = 90; // Scratch 90 (Right) -> Logic 0 (Right)

    let stepCount = 0;

    const turtle = document.getElementById('turtleSprite');
    turtle.style.left = `${currentX}px`;
    turtle.style.top = `${currentY}px`;

    polyCtx.beginPath();
    polyCtx.moveTo(currentX, currentY);

    function executionLoop() {
        if (!isPolyRunning || stepCount >= sides) {
            isPolyRunning = false;
            return;
        }

        // Get dynamic speed 
        const speedVal = parseInt(document.getElementById('polySpeed').value) || 5;
        // Base speed = 0.05 per frame
        // Multiplier: 1x -> 0.01, 5x -> 0.05, 10x -> 0.1
        const drawStep = 0.01 * speedVal;
        const turnStep = 0.02 * speedVal;

        stepCount++;
        const stepEl = document.getElementById('runStep');
        if (stepEl) stepEl.innerText = stepCount;

        // Calculate Target Position
        const rad = (currentDir - 90) * (Math.PI / 180);
        const targetX = currentX + length * Math.cos(rad);
        const targetY = currentY + length * Math.sin(rad);

        let progress = 0;
        const startX = currentX;
        const startY = currentY;

        function drawFrame() {
            if (!isPolyRunning) return;
            progress += drawStep;

            if (progress >= 1) progress = 1;

            const nextX = startX + (targetX - startX) * progress;
            const nextY = startY + (targetY - startY) * progress;

            polyCtx.lineTo(nextX, nextY);
            polyCtx.stroke();

            // Move turtle
            turtle.style.left = `${nextX}px`;
            turtle.style.top = `${nextY}px`;

            if (progress < 1) {
                polyAnimId = requestAnimationFrame(drawFrame);
            } else {
                currentX = targetX;
                currentY = targetY;

                // Turn Animation
                let turnProgress = 0;
                const startAngle = currentDir;
                const endAngle = currentDir + turnAngle; // Check rotation logic

                function turnFrame() {
                    if (!isPolyRunning) return; // Check isPolyRunning correctly
                    turnProgress += turnStep;
                    if (turnProgress >= 1) turnProgress = 1;

                    const nowAngle = startAngle + (endAngle - startAngle) * turnProgress;

                    const icon = document.getElementById('turtleIcon');
                    if (icon) icon.style.transform = `rotate(${nowAngle}deg)`;

                    const angleEl = document.getElementById('currentAngleVal');
                    if (angleEl) angleEl.innerText = Math.round(nowAngle % 360) + '°';

                    if (turnProgress < 1) {
                        polyAnimId = requestAnimationFrame(turnFrame);
                    } else {
                        currentDir = endAngle;

                        // Wait before next step
                        if (isPolyRunning) { // Check isPolyRunning before scheduling next step
                            // Use setTimeout but track it to cancel if needed? 
                            // Use tracked timeout
                            window.polyTimeoutId = setTimeout(executionLoop, 50);
                        }
                    }
                }
                polyAnimId = requestAnimationFrame(turnFrame);
            }
        }
        polyAnimId = requestAnimationFrame(drawFrame);
    }
    executionLoop();
}

// --- Drawing System Global Logic ---
let isDrawingMode = false;
let isDrawing = false;
let drawCtx;
let drawLastX = 0;
let drawLastY = 0;
let drawStartX = 0;
let drawStartY = 0;
let drawColor = '#ef4444';
let currentTool = 'pen';
let brushSize = 4;
let canvasSnapshot = null;
let drawingHistory = [];
let historyStep = -1;

function saveState() {
    if (!drawCtx) return;
    historyStep++;
    if (historyStep < drawingHistory.length) {
        drawingHistory.length = historyStep;
    }
    drawingHistory.push(drawCtx.getImageData(0, 0, drawCtx.canvas.width, drawCtx.canvas.height));
    if (drawingHistory.length > 20) {
        drawingHistory.shift();
        historyStep--;
    }
}

function undoLastAction() {
    if (historyStep > 0) {
        historyStep--;
        const imgData = drawingHistory[historyStep];
        drawCtx.putImageData(imgData, 0, 0);
    }
}

function initDrawing() {
    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;

    drawCtx = canvas.getContext('2d');
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);

    // Mouse Events
    canvas.addEventListener('mousedown', startAction);
    canvas.addEventListener('mousemove', handleAction);
    canvas.addEventListener('mouseup', stopAction);
    canvas.addEventListener('mouseout', stopAction);

    // Touch Events
    canvas.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });

    // Initial color active state
    setDrawColor(drawColor);

    // Initialize history
    saveState();

    // Undo Shortcut
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undoLastAction();
        }
    });
}

function resizeCanvas() {
    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;

    // Save current content if needed? For now, we accept clear on resize or need a sophisticated buffer.
    // Simple approach: set dimensions. content is cleared.
    // To preserve: create temp canvas.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Restore
    drawCtx.drawImage(tempCanvas, 0, 0);
}

function toggleDrawingMode() {
    const layer = document.getElementById('drawingLayer');
    const toolbar = document.getElementById('drawingToolbar');
    const fab = document.getElementById('fabDrawing');

    isDrawingMode = !isDrawingMode;

    if (isDrawingMode) {
        layer.classList.remove('hidden');
        // Force reflow
        void layer.offsetWidth;
        layer.classList.remove('pointer-events-none');

        // Show Toolbar
        setTimeout(() => {
            toolbar.classList.remove('translate-y-32', 'opacity-0');
        }, 50);

        fab.classList.add('scale-0', 'opacity-0', 'pointer-events-none');

        if (!drawCtx) initDrawing();
    } else {
        toolbar.classList.add('translate-y-32', 'opacity-0');
        fab.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');

        // Hide layer after transition
        setTimeout(() => {
            layer.classList.add('hidden');
            layer.classList.add('pointer-events-none');
        }, 300);
    }
}

function startAction(e) {
    if (!isDrawingMode) return;

    if (currentTool === 'text') {
        createTextInput(e.clientX, e.clientY);
        return;
    }

    isDrawing = true;
    [drawStartX, drawStartY] = [e.clientX, e.clientY];
    [drawLastX, drawLastY] = [e.clientX, e.clientY];

    // Save canvas state for shape preview
    if (currentTool === 'line' || currentTool === 'rect') {
        canvasSnapshot = drawCtx.getImageData(0, 0, drawCtx.canvas.width, drawCtx.canvas.height);
    }

    if (currentTool === 'pen' || currentTool === 'eraser') {
        drawCtx.beginPath();
        drawCtx.moveTo(drawLastX, drawLastY);
    }
}

function handleAction(e) {
    if (!isDrawing || !isDrawingMode) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    if (currentTool === 'eraser') {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.lineWidth = brushSize * 4; // Eraser often needs to be bigger
        drawCtx.lineTo(currentX, currentY);
        drawCtx.stroke();
        [drawLastX, drawLastY] = [currentX, currentY];
    } else if (currentTool === 'pen') {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = drawColor;
        drawCtx.lineWidth = brushSize;
        drawCtx.lineTo(currentX, currentY);
        drawCtx.stroke();
        [drawLastX, drawLastY] = [currentX, currentY];
    } else if (currentTool === 'line') {
        // Restore then draw
        drawCtx.putImageData(canvasSnapshot, 0, 0);
        drawCtx.beginPath();
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = drawColor;
        drawCtx.lineWidth = brushSize;
        drawCtx.moveTo(drawStartX, drawStartY);
        drawCtx.lineTo(currentX, currentY);
        drawCtx.stroke();
    } else if (currentTool === 'rect') {
        // Restore then draw
        drawCtx.putImageData(canvasSnapshot, 0, 0);
        drawCtx.beginPath();
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = drawColor;
        drawCtx.lineWidth = brushSize;
        const w = currentX - drawStartX;
        const h = currentY - drawStartY;
        drawCtx.strokeRect(drawStartX, drawStartY, w, h);
    }
}

function stopAction() {
    if (!isDrawing) return;
    isDrawing = false;
    drawCtx.beginPath(); // Reset path
    canvasSnapshot = null;
    saveState();
}

function createTextInputOld(x, y) {
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'fixed';
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.style.zIndex = '10000';
    input.style.background = 'transparent';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.color = drawColor;
    input.style.fontSize = '24px';
    input.style.fontFamily = 'sans-serif';
    input.style.fontWeight = 'bold';
    input.style.minWidth = '100px';
    input.style.transform = 'translateY(-50%)';
    input.placeholder = 'Type here...';

    document.body.appendChild(input);
    input.focus();

    const finishText = () => {
        const text = input.value;
        if (text) {
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.font = 'bold 24px sans-serif';
            drawCtx.fillStyle = drawColor;
            drawCtx.fillText(text, x, y + 8); // Adjust baseline slightly
        }
        input.remove();
    };

    input.addEventListener('blur', finishText);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishText();
        }
    });
}


function createTextInput(x, y) {
    if (document.getElementById('drawTextInput')) return;

    const input = document.createElement('textarea');
    input.id = 'drawTextInput';
    input.type = 'text'; // textarea doesn't need type, but keep it for now or remove? Remove.
    input.style.position = 'fixed';
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.style.zIndex = '10000';
    input.style.background = 'rgba(0,0,0,0.5)';
    input.style.border = '1px solid ' + drawColor;
    input.style.borderRadius = '4px';
    input.style.outline = 'none';
    input.style.color = drawColor;
    const currentFontSize = Math.max(12, typeof brushSize !== 'undefined' ? brushSize * 4 : 24);
    input.style.fontSize = currentFontSize + 'px';
    input.style.lineHeight = '1.2';
    input.style.fontFamily = 'monospace';
    input.style.fontWeight = 'bold';
    input.style.minWidth = '200px';
    input.style.minHeight = (currentFontSize * 1.5) + 'px';
    input.style.padding = '4px 8px';
    // input.style.transform = 'translateY(-50%)'; // Prevent shifting up when height grows
    input.style.overflow = 'hidden';
    input.style.resize = 'both';
    input.placeholder = 'Type here...';

    // Auto-resize logic
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    document.body.appendChild(input);
    setTimeout(() => input.focus(), 10);

    let isComposing = false;
    let isFinalized = false;

    const finishText = () => {
        if (isFinalized || isComposing) return;
        isFinalized = true;

        const text = input.value;
        if (text) {
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.font = 'bold ' + currentFontSize + 'px monospace';
            drawCtx.fillStyle = drawColor;
            drawCtx.textBaseline = 'top';

            // Draw text line by line
            const lines = text.split('\n');
            const lineHeight = currentFontSize * 1.2;

            // Get input position for accurate drawing
            const rect = input.getBoundingClientRect();
            // Adjust for padding
            const drawX = rect.left + 8; // padding-left
            const drawY = rect.top + 4;  // padding-top (approx)

            lines.forEach((line, index) => {
                drawCtx.fillText(line, drawX, drawY + (index * lineHeight));
            });
            saveState();
        }
        input.remove();
    };

    // IME Support (Chinese, Japanese, etc.)
    input.addEventListener('compositionstart', () => { isComposing = true; });
    input.addEventListener('compositionend', () => { isComposing = false; });

    input.addEventListener('blur', () => {
        // Small delay to allow click events to process if clicking elsewhere
        setTimeout(finishText, 100);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            isFinalized = true; // Just remove without drawing
            input.remove();
        }
    });
}

function setTool(toolName) {
    currentTool = toolName;
    updateToolbarUI();
}

function setDrawColor(color) {
    drawColor = color;
    // If we pick a color while using eraser, switch back to last tool or pen
    if (currentTool === 'eraser') {
        currentTool = 'pen';
    }
    updateToolbarUI();
}

function updateToolbarUI() {
    // Colors
    document.querySelectorAll('.color-btn').forEach(btn => {
        const c = btn.dataset.color;
        if (c === drawColor && currentTool !== 'eraser') {
            btn.classList.add('ring-offset-2', 'ring-offset-slate-900', 'ring-white');
            btn.classList.remove('ring-transparent');
        } else {
            btn.classList.remove('ring-offset-2', 'ring-offset-slate-900', 'ring-white');
            btn.classList.add('ring-transparent');
        }
    });

    // Tools
    const tools = ['pen', 'line', 'rect', 'text', 'eraser'];
    tools.forEach(t => {
        const btnIdx = t === 'pen' ? 'btnToolPen' :
            t === 'line' ? 'btnToolLine' :
                t === 'rect' ? 'btnToolRect' :
                    t === 'text' ? 'btnToolText' : 'btnToolEraser';

        const btn = document.getElementById(btnIdx);
        if (btn) {
            if (currentTool === t) {
                btn.classList.add('text-indigo-400', 'bg-slate-800', 'ring-1', 'ring-indigo-500');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('text-indigo-400', 'bg-slate-800', 'ring-1', 'ring-indigo-500');
                btn.classList.add('text-slate-400');
            }
        }
    });
}

function toggleToolbarCollapse() {
    const content = document.getElementById('toolbarContent');
    const btn = document.getElementById('btnCollapseToolbar');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.classList.add('flex');
        btn.title = '縮小工具列';
        btn.innerHTML = '<i data-lucide="chevron-down" class="w-6 h-6"></i>';
    } else {
        content.classList.add('hidden');
        content.classList.remove('flex');
        btn.title = '放大工具列';
        btn.innerHTML = '<i data-lucide="chevron-up" class="w-6 h-6"></i>';
    }
    lucide.createIcons();
}

function clearCanvas() {
    if (confirm('確定要清除所有筆跡嗎？')) {
        const canvas = document.getElementById('mainCanvas');
        drawCtx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
    }
}
function updateBrushSize(size) { brushSize = parseInt(size); }

let isChalkboardMode = false;
function toggleChalkboard() {
    const canvas = document.getElementById('mainCanvas');
    isChalkboardMode = !isChalkboardMode;

    if (isChalkboardMode) {
        let bg = document.getElementById('chalkboardBg');
        if (!bg) {
            bg = document.createElement('div');
            bg.id = 'chalkboardBg';
            bg.classList.add('absolute', 'inset-0', 'bg-gray-900', '-z-10');
            canvas.parentNode.insertBefore(bg, canvas);
        }
        bg.classList.remove('hidden');

    } else {
        const bg = document.getElementById('chalkboardBg');
        if (bg) bg.classList.add('hidden');
    }

    const btn = document.getElementById('btnChalkboard');
    if (btn) {
        if (isChalkboardMode) {
            btn.classList.add('bg-slate-700', 'text-white', 'ring-1', 'ring-white/20');
            btn.classList.remove('text-slate-400');
        } else {
            btn.classList.remove('bg-slate-700', 'text-white', 'ring-1', 'ring-white/20');
            btn.classList.add('text-slate-400');
        }
    }
}

function minimizeFab(e) {
    if (e) {
        e.stopPropagation(); // prevent toggling drawing mode
    }
    const fabContainer = document.getElementById('fabDrawingContainer');
    const fabHandle = document.getElementById('fabMinimizedHandle');

    // Hide large FAB
    if (fabContainer) {
        fabContainer.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
    }
    // Show small handle
    if (fabHandle) {
        fabHandle.classList.remove('hidden');
        // Small delay for fluid transition
        setTimeout(() => {
            fabHandle.classList.remove('translate-x-full');
        }, 50);
    }
}

function restoreFab() {
    const fabContainer = document.getElementById('fabDrawingContainer');
    const fabHandle = document.getElementById('fabMinimizedHandle');

    // Hide small handle
    if (fabHandle) {
        fabHandle.classList.add('translate-x-full');
        setTimeout(() => {
            fabHandle.classList.add('hidden');
        }, 300);
    }
    // Show large FAB
    if (fabContainer) {
        fabContainer.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
    }
}

