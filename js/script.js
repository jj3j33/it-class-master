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
    { id: 'calendar', title: '行事曆', desc: '查看月曆與課程排程', icon: 'calendar-days', color: 'sky', action: "switchTab('calendar')" },
    { id: 'sortAlgo', title: '排序演算法', desc: '可視化演示選擇與插入排序', icon: 'bar-chart-2', color: 'emerald', action: "switchTab('sortAlgo')" },
    { id: 'timer', title: '課堂計時器', desc: '懸浮式倒數計時工具', icon: 'timer', color: 'orange', action: "toggleTimerModal()" },
    { id: 'leaderboard', title: '積分排行榜', desc: '查看學生學期積分排名', icon: 'trophy', color: 'pink', action: "switchTab('leaderboard')" },
    { id: 'keyboard', title: '互動鍵盤', desc: '示範常用快捷鍵操作', icon: 'keyboard', color: 'violet', action: "switchTab('keyboard')" },
    { id: 'relax', title: '輕鬆一下', desc: '隨機冷笑話與謎語', icon: 'coffee', color: 'pink', action: "openRelaxModal()" },
    { id: 'polygon', title: '模組化達人', desc: 'Scratch 幾何圖形模擬', icon: 'shapes', color: 'violet', action: "switchTab('polygon')" }
];
var modules = JSON.parse(JSON.stringify(defaultModules));
window.modules = modules;
let isModuleReordering = false;

var currentTab = 'dashboard';
window.currentTab = currentTab;
var currentClass = "";
window.currentClass = currentClass;
let lotteryHistory = [];
let selectedIndices = new Set();
let isSelectionMode = false; // 控制是否進入多選模式
let lastSelectedIndexSelection = null; // 為多選(Shift鍵)紀錄上一次點擊的索引
let lastWinnerIndex = null;
let lastCheckedDateStr = new Date().toDateString();

// Textbook Files Logic
// Textbook Links Logic (Synced via localStorage/Google Sheets)
var textbookLinks = [];
window.textbookLinks = textbookLinks;

var scoreReasons = {
    positive: [],
    negative: []
};
window.scoreReasons = scoreReasons;

var sysSettings = {
    defaultCols: 6,
    defaultRows: 8,
    defaultLayoutMode: 'rtl',
    backupReminder: {
        enabled: false,
        day: 5, // 週五
        time: "16:00",
        lastShownDate: "" // 防止重複提醒
    }
};
window.sysSettings = sysSettings;

// DOM Cache for performance
let domCache = {};
function getCachedElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Start with a clean slate but don't wait for everything to load the fonts/scripts
    console.log("App initializing...");
    const saved = localStorage.getItem('it-class-master-v4');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Re-use the robust apply logic
            window.applySyncData(parsed);
        } catch (e) {
            console.error("Failed to load local storage:", e);
        }
    }

    // 新增：多分頁同步監聽 (Same-device Multi-tab Sync)
    window.addEventListener('storage', (e) => {
        // 當其他分頁儲存資料時，此分頁會收到通知並更新
        if (e.key === 'it-class-master-v4' && e.newValue) {
            console.log("Detect change from another tab, syncing...");
            try {
                const data = JSON.parse(e.newValue);
                // 使用 window.applySyncData 確保重新渲染 UI
                if (typeof window.applySyncData === 'function') {
                    // Added true as second argument to prevent self-triggering storage event loop
                    window.applySyncData(data, true);
                }
            } catch (err) {
                console.error("Storage sync failed:", err);
            }
        }
    });



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
    updateDashboardStats(); // Ensure stats are visible immediately
    initTimetableEditor();

    renderModules(); // Initial Render
    switchTab('dashboard');
    // Global render once on start
    lucide.createIcons();

    setInterval(updateTimeAndStatus, 1000);
    updateTimeAndStatus();

    // Ensure we are using the global GoogleSync
    if (typeof window.GoogleSync !== 'undefined') {
        window.GoogleSync.init();
        const urlInput = document.getElementById('gasUrlInput');
        if (urlInput) urlInput.value = window.GoogleSync.url;

        // Pull fresh data from cloud on background
        if (window.GoogleSync.url) {
            window.GoogleSync.pull();
        }
    } else {
        console.error("GoogleSync module failed to load!");
    }

    // Hide Loader as soon as local data is rendered
    // Reduced delay for better perceived performance
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
        setTimeout(() => loader.remove(), 500);
    }

    initDrawing();
});



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
    // CRITICAL: Propagate local updates to window globals for Sync visibility
    // No need to manually assign if they are already the same reference, but good for safety
    window.classesData = classesData;
    window.teacherTimetable = teacherTimetable;
    window.periodTimes = periodTimes;
    window.scoreReasons = scoreReasons;
    window.teachingResources = teachingResources;
    window.modules = modules;
    window.textbookLinks = textbookLinks;
    window.sysSettings = sysSettings;

    const bundle = {
        classesData: classesData,
        teacherTimetable: teacherTimetable,
        periodTimes: periodTimes,
        scoreReasons: scoreReasons,
        teachingResources: teachingResources,
        modules: modules,
        textbookLinks: textbookLinks,
        sysSettings: sysSettings,
        currentClass: currentClass,
        lastActiveDate: new Date().toDateString()
    };

    localStorage.setItem('it-class-master-v4', JSON.stringify(bundle));
    updateDashboardStats();

    if (!skipPush) {
        if (typeof window.GoogleSync !== 'undefined') {
            window.GoogleSync.schedPush();
        }
    }
}

/**
 * Newly added: Apply data from Cloud/External to local variables 
 * This fixes the issue where local variables would overwrite cloud data after a pull.
 */
window.applySyncData = function (data, skipSave = false) {
    if (!data) return;

    if (data.classesData) {
        classesData = data.classesData;
        window.classesData = classesData;
    }
    if (data.teacherTimetable) {
        teacherTimetable = data.teacherTimetable;
        window.teacherTimetable = teacherTimetable;
    }
    if (data.periodTimes) {
        periodTimes = data.periodTimes;
        window.periodTimes = periodTimes;
    }
    if (data.scoreReasons) {
        scoreReasons = data.scoreReasons;
        window.scoreReasons = scoreReasons;
    }
    if (data.teachingResources) {
        teachingResources = data.teachingResources;
        window.teachingResources = teachingResources;
    }
    if (data.modules && Array.isArray(data.modules)) {
        // Robust Feature Sync from Cloud
        const validIds = new Set(defaultModules.map(dm => dm.id));
        let syncedModules = data.modules
            .filter(m => validIds.has(m.id))
            .map(m => {
                const latest = defaultModules.find(dm => dm.id === m.id);
                return { ...m, ...latest }; // Refresh code-defined properties like action, icon, title
            });

        // Add new features added in the latest version but missing in Cloud
        const currentIds = new Set(syncedModules.map(m => m.id));
        defaultModules.forEach(dm => {
            if (!currentIds.has(dm.id)) syncedModules.push(dm);
        });
        modules = syncedModules;
        window.modules = modules;
    }
    if (data.textbookLinks) {
        textbookLinks = data.textbookLinks;
        window.textbookLinks = textbookLinks;
    }
    if (data.sysSettings) {
        // Robust merge to handle new settings fields
        sysSettings = { ...sysSettings, ...data.sysSettings };
        if (data.sysSettings.backupReminder) {
            sysSettings.backupReminder = { ...sysSettings.backupReminder, ...data.sysSettings.backupReminder };
        }
        window.sysSettings = sysSettings;
    }
    // 關鍵修正：同步時不應強制改變各分頁自己的「目前選取班級」，除非本地還是空的
    if (!currentClass || !classesData[currentClass]) {
        if (data.currentClass && classesData[data.currentClass]) {
            currentClass = data.currentClass;
            window.currentClass = currentClass;
        } else if (Object.keys(classesData).length > 0) {
            currentClass = Object.keys(classesData).sort()[0];
            window.currentClass = currentClass;
        }
    }

    console.log("Local variables updated from sync data.");

    // Save to local storage (silent save) - Only if not coming from a storage event
    if (!skipSave) {
        saveData(true);
    }

    // Refresh UI
    initClassSelector();
    updateDashboardStats();
    initTimetableEditor();
    renderModules();
    updateTimeAndStatus();

    // Page specific refresh
    if (window.currentTab === 'seating') renderSeating();
    if (window.currentTab === 'records') renderRecordsPage();
    if (window.currentTab === 'leaderboard') renderLeaderboard();
    if (window.currentTab === 'textbook') renderTextbookGrid();
    if (window.currentTab === 'calendar') renderCalendar();

    // Ensure settings UI is updated
    if (window.currentTab === 'settings') renderSettingsPage();
    if (typeof renderReasonSettings === 'function') renderReasonSettings();
};

function switchTab(tabId) {
    currentTab = tabId;
    window.currentTab = tabId;

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
    const sections = ['dashboard', 'seating', 'records', 'lottery', 'textbook', 'settings', 'leaderboard', 'keyboard', 'resource-detail', 'polygon', 'calendar', 'sortAlgo'];

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
                updateDashboardStats(); // Refresh stats when returning to dashboard
                renderModules();
                renderResources();
            }
            if (tabId === 'seating') renderSeating();
            if (tabId === 'records') renderRecordsPage();
            if (tabId === 'leaderboard') renderLeaderboard();
            if (tabId === 'settings') renderSettingsPage();
            if (tabId === 'polygon') initPolygon();
            if (tabId === 'calendar') renderCalendar();
            if (tabId === 'textbook') renderTextbookGrid();
            if (tabId === 'sortAlgo' && typeof initSortAlgo === 'function') {
                if (!sortState.initialized) initSortAlgo('selection');
            }
        } catch (e) {
            console.error(`Error initializing ${tabId}:`, e);
        }

        // 4. Initialize Lucide icons ONLY for the newly shown section
        lucide.createIcons({
            node: targetEl
        });
    }
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
let lastAttendanceReminder = "";

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

    const dateEl = getCachedElement('currentDate');
    const timeEl = getCachedElement('currentTime');

    if (dateEl) dateEl.innerText = dateStr;
    if (timeEl) timeEl.innerText = `${hours}:${minutes}:${seconds}`;

    const currentTimeVal = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay();
    const dayIndex = day - 1; // 0-4 (Mon-Fri)

    const currentClassDisplay = getCachedElement('currentClassDisplay');
    const countdownText = getCachedElement('countdownText');
    const periodLabel = getCachedElement('currentPeriodLabel');
    const timeRange = getCachedElement('periodTimeRange');
    const statusMsg = getCachedElement('classStatusMsg');
    const autoBtn = getCachedElement('autoSwitchBtn');
    const timerContainer = getCachedElement('timerContainer');
    const timerLabel = getCachedElement('timerLabel');
    const classInfoHeading = getCachedElement('classInfoHeading');

    // Safety check for UI elements (dashboard section)
    if (!currentClassDisplay || !periodLabel) return;

    // 檢查備份提醒
    checkBackupReminder(now);

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

        // --- 檢查是否需要下課前儲存提醒 ---
        if (targetClass) {
            const diffMinutes = Math.floor((endTime - now) / 60000);
            const reminderKey = `${nowStr}-${foundPeriod.id}`;

            // 下課前 3 分鐘提醒，且今天這節課還沒提醒過
            if (diffMinutes <= 3 && diffMinutes >= 0 && lastAttendanceReminder !== reminderKey) {
                const targetData = classesData[targetClass];
                const alreadySaved = targetData && targetData.attendanceLogs &&
                    targetData.attendanceLogs.some(log => new Date(log.time).toDateString() === nowStr);

                if (!alreadySaved) {
                    lastAttendanceReminder = reminderKey;
                    setTimeout(() => {
                        if (confirm(`這節課即將結束！\n目前的「${targetClass}」尚未儲存今日點名紀錄。\n\n是否立即依照目前的狀態儲存點名？`)) {
                            // 如果目前選取的不是這節課的班級，先切換
                            if (currentClass !== targetClass) {
                                currentClass = targetClass;
                                window.currentClass = targetClass;
                                initClassSelector();
                                updateDashboardStats();
                                if (currentTab === 'seating') renderSeating();
                            }
                            saveAttendance(false); // 執行儲存
                        }
                    }, 500);
                }
            }
        }

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

function checkBackupReminder(now) {
    if (!sysSettings.backupReminder || !sysSettings.backupReminder.enabled) return;

    const day = now.getDay();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const nowTimeStr = `${hours}:${minutes}`;
    const nowDateStr = now.toDateString();

    // 如果星期與時間符合，且今天還沒提醒過
    if (day === sysSettings.backupReminder.day &&
        nowTimeStr === sysSettings.backupReminder.time &&
        sysSettings.backupReminder.lastShownDate !== nowDateStr) {

        // 標記今日已提醒，避免彈窗狂跳
        sysSettings.backupReminder.lastShownDate = nowDateStr;
        saveData(true); // 僅存本地

        // 顯示提醒視窗
        const modal = document.getElementById('backupReminderModal');
        if (modal) {
            modal.classList.remove('hidden');
            lucide.createIcons({ node: modal });
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
        saveData(); // Persist selection 
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

    // Reflow with new config (only if NOT manually adjusted)
    if (!data.config.isManualLayout) {
        reflowClassLayout(currentClass);
    }

    // 修正佈局後，原本的選取位置已失效，必須清除
    selectedIndices.clear();
    renderSeating();
}

// --- 核心排位邏輯 (Reflow) ---
function reflowClassLayout(cls, forceReflow = false) {
    const data = classesData[cls];
    if (!data) return;

    if (data.config.isManualLayout && !forceReflow) return;

    const cols = data.config.cols;
    const rows = data.config.rows;
    const layoutMode = data.config.layoutMode || 'rtl';

    const unavailableSeats = data.config.unavailableSeats || [];
    const allStudents = Object.values(data.students).filter(s => s);
    const newMap = {};

    const overflowStudents = [];

    // --- 新增：產生可用的順序插槽 ---
    const availableOrderedSlots = [];
    for (let i = 0; i < cols * rows; i++) {
        const colIndex = Math.floor(i / rows);
        const rowFromBottom = i % rows;

        let c = layoutMode === 'ltr' ? colIndex : (cols - 1) - colIndex;
        let r = (rows - 1) - rowFromBottom;
        const flatIndex = r * cols + c;

        if (!unavailableSeats.includes(flatIndex)) {
            availableOrderedSlots.push(flatIndex);
        }
    }

    // 第一階段：按照座號放入對應空位
    allStudents.forEach((student) => {
        const seatNum = parseInt(student.seatNo.replace(/[^\d]/g, '')) || 0;
        if (seatNum <= 0) {
            overflowStudents.push(student);
            return;
        }

        const p = seatNum - 1;
        if (p < availableOrderedSlots.length) {
            const flatIndex = availableOrderedSlots[p];
            if (newMap[flatIndex] === undefined) {
                newMap[flatIndex] = student;
            } else {
                overflowStudents.push(student);
            }
        } else {
            // 座號超出可用座位數量
            overflowStudents.push(student);
        }
    });

    // 第二階段：處理超出網格或衝突的學生
    let searchIndex = 0;
    overflowStudents.forEach(student => {
        while (searchIndex < cols * rows && (newMap[searchIndex] !== undefined || unavailableSeats.includes(searchIndex))) {
            searchIndex++;
        }
        if (searchIndex < cols * rows) {
            newMap[searchIndex] = student;
            searchIndex++;
        }
    });

    data.students = newMap;
    saveData();
}

// 新增切換排序模式
function updateLayoutMode() {
    const layoutMode = document.getElementById('gridLayoutMode').value;
    const data = classesData[currentClass];
    data.config.layoutMode = layoutMode;
    data.config.isManualLayout = false; // Reset manual layout when sorting rule changes
    reflowClassLayout(currentClass, true);
    selectedIndices.clear();
    renderSeating();
}

// 新增強制重新排列
function resetLayoutSort() {
    const data = classesData[currentClass];
    data.config.isManualLayout = false;
    reflowClassLayout(currentClass, true);
    selectedIndices.clear();
    renderSeating();
}

let draggedSeatIndex = null;

function renderSeating() {
    const grid = document.getElementById('seatingGrid');
    const data = classesData[currentClass];
    const { config, students } = data;

    if (!config.pcNumbers) config.pcNumbers = {};

    // 更新工具列狀態
    const activeKeys = Object.keys(students).filter(k => students[k] && students[k].status !== 'absent');
    const totalActive = activeKeys.length;

    // Count selected active students
    const selectedActiveCount = activeKeys.filter(k => selectedIndices.has(parseInt(k))).length;
    const selectedCount = selectedIndices.size;

    document.getElementById('gridCols').value = config.cols;
    document.getElementById('gridRows').value = config.rows;

    const layoutModeSelect = document.getElementById('gridLayoutMode');
    if (layoutModeSelect) {
        layoutModeSelect.value = config.layoutMode || 'rtl';
    }

    // 更新全選按鈕與計數
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        const isAllActiveSelected = totalActive > 0 && selectedActiveCount === totalActive;
        selectAllCheckbox.checked = isAllActiveSelected;
        selectAllCheckbox.indeterminate = selectedCount > 0 && !isAllActiveSelected;
    }
    const countLabel = document.getElementById('selectionCount');
    if (countLabel) countLabel.innerText = `(${selectedCount})`;

    // 控制「多選學生」按鈕的狀態
    const btnEnable = document.getElementById('btnEnableSelection');
    if (btnEnable) {
        if (isSelectionMode) {
            btnEnable.innerHTML = '<i data-lucide="x" class="w-3.5 h-3.5"></i> 取消多選';
            btnEnable.className = "bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-slate-600";
        } else {
            btnEnable.innerHTML = '<i data-lucide="check-square" class="w-3.5 h-3.5"></i> 多選學生';
            btnEnable.className = "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-indigo-500/30";
        }
    }

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

        slot.className = `border rounded-xl min-h-[110px] flex flex-col items-center justify-center relative group transition-all duration-200`;
        slot.setAttribute('ondragover', 'handleDragOver(event)');
        slot.setAttribute('ondrop', `handleDrop(event, ${i})`);
        slot.setAttribute('ondragenter', 'handleDragEnter(event)');
        slot.setAttribute('ondragleave', 'handleDragLeave(event)');

        if (s) {
            if (s.score === undefined) s.score = 0;
            const isSelected = selectedIndices.has(i);

            slot.className += ` ${isSelected ? 'border-indigo-500 bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-800 bg-slate-900/30 hover:border-slate-600'}`;

            let statusColorClass = '';
            let statusIcon = '';
            let scoreClass = 'bg-slate-700 text-slate-300';

            if (s.score > 0) scoreClass = 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/20 shadow-lg';
            if (s.score < 0) scoreClass = 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-rose-500/20 shadow-lg';
            if (s.score === 0) scoreClass = 'bg-gradient-to-br from-slate-600 to-slate-700 text-slate-300';

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

            let genderAccent = '';
            if (s.gender) {
                const g = s.gender.toLowerCase();
                if (g === '男' || g === 'm' || g === 'boy' || g === 'male') {
                    genderAccent = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-sky-500/80 z-30 shadow-[2px_0_8px_rgba(14,165,233,0.5)] pointer-events-none"></div>';
                } else if (g === '女' || g === 'f' || g === 'girl' || g === 'female') {
                    genderAccent = '<div class="absolute left-0 top-0 bottom-0 w-1 bg-pink-500/80 z-30 shadow-[2px_0_8px_rgba(236,72,153,0.5)] pointer-events-none"></div>';
                }
            }

            slot.innerHTML = `
                    <div class="student-card w-full h-full relative group select-none transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                         draggable="true" 
                         onclick="toggleSelection(event, ${i})"
                         ondragstart="handleDragStart(event, ${i})"
                         ondragend="handleDragEnd(event)">
                        
                        <div class="absolute inset-0 rounded-xl border backdrop-blur-sm shadow-sm transition-all duration-300 ${statusColorClass} ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-900/20 z-10' : 'hover:border-slate-500 hover:shadow-md hover:bg-slate-800/80'} flex flex-col overflow-hidden">
                            ${genderAccent}
                            
                            <div class="flex justify-between items-start p-1.5 z-20">
                                <div class="flex items-center gap-1.5">
                                   <!-- 多選 Checkbox (僅在多選模式下顯示) -->
                                   ${isSelectionMode ? `
                                   <div class="w-5 h-5 flex items-center justify-center rounded border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-transparent hover:border-slate-500'}"
                                        onclick="toggleSelection(event, ${i}); event.stopPropagation();">
                                       ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}
                                   </div>
                                   ` : ''}

                                   <!-- 電腦編號 Badge -->
                                   <div class="pc-badge-wrapper font-mono text-base font-extrabold px-2.5 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors ${config.pcNumbers[i] ? 'text-sky-300 bg-sky-900/80 border-sky-700/50 hover:bg-sky-800' : 'text-slate-500 bg-slate-800/50 border-slate-700/50 hover:bg-sky-900/80 hover:text-sky-300 opacity-30 group-hover:opacity-100'}"
                                        title="設定電腦編號(Shift+點擊可設為不開放座位)"
                                        onclick="if (event.shiftKey) { toggleSeatAvailability(${i}); } else { setPcNumber(${i}); } event.stopPropagation();">
                                       <i data-lucide="monitor" class="pc-icon w-2.5 h-2.5"></i>
                                       <span>${config.pcNumbers[i] || '+'}</span>
                                   </div>
                                </div>
                                
                                <div class="flex items-center gap-1.5">
                                    <div class="box-score font-mono font-black text-base px-2 py-0.5 rounded-md flex items-center shadow-sm backdrop-blur-md cursor-default ${scoreClass}">
                                        ${s.score > 0 ? '+' : ''}${s.score}
                                    </div>
                                </div>
                            </div>

                            <div class="flex-1 flex flex-col items-center justify-center py-1 px-1 relative z-10 cursor-pointer" 
                                 onclick="openStatusModal(${i}); event.stopPropagation();" title="設定狀態">
                                <div class="font-bold text-2xl text-slate-200 tracking-wide text-center leading-tight drop-shadow-md group-hover:text-white transition-colors truncate w-full px-1">
                                    <span class="text-slate-400 font-mono text-base mr-1">${s.seatNo}</span>${s.name}
                                </div>
                                
                                ${(s.status !== 'present') ? `
                                <div class="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border max-w-full truncate
                                    ${s.status === 'absent' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}">
                                    ${statusIcon}
                                    <span class="truncate">${s.note || (s.status === 'absent' ? '缺席' : '遲到')}</span>
                                </div>
                                ` : ''}
                            </div>

                            <div class="w-full h-[30px] mt-auto flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pb-1.5 z-30">
                                 <button onclick="updateScore(${i}, 1); event.stopPropagation();" 
                                    class="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center transition-transform active:scale-90 hover:scale-110 border border-emerald-400/30">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                </button>
                                <button onclick="updateScore(${i}, -1); event.stopPropagation();" 
                                    class="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 flex items-center justify-center transition-transform active:scale-90 hover:scale-110 border border-rose-400/30">
                                    <i data-lucide="minus" class="w-4 h-4"></i>
                                </button>
                            </div>
                            
                            <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl pointer-events-none group-hover:from-white/10 transition-all"></div>
                        </div>
                    </div>`;
        } else {
            const isUnavailable = config.unavailableSeats && config.unavailableSeats.includes(i);
            const emptyPcBadge = `
                <div class="pc-badge-wrapper absolute top-2 left-2 z-40 font-mono text-base font-bold px-2.5 py-0.5 rounded border cursor-pointer transition-colors ${config.pcNumbers[i] ? 'text-sky-300 bg-sky-900/60 border-sky-700/50 hover:bg-sky-800' : 'text-slate-500 bg-slate-800/30 border-slate-700/30 hover:bg-sky-900/60 hover:text-sky-300 opacity-0 group-hover:opacity-100'}"
                     title="設定電腦編號"
                     onclick="setPcNumber(${i}); event.stopPropagation();">
                    <i data-lucide="monitor" class="pc-icon w-3 h-3 inline-block -mt-0.5 text-slate-500"></i> <span class="pointer-events-none">${config.pcNumbers[i] || '+'}</span>
                </div>`;

            if (isUnavailable) {
                slot.className += ` border-rose-900/30 bg-rose-900/10 opacity-30 cursor-pointer hover:opacity-80`;
                slot.innerHTML = `
                    ${emptyPcBadge}
                    <div class="w-full h-full flex items-center justify-center text-rose-500/50" onclick="toggleSeatAvailability(${i})" title="恢復開放座位"><i data-lucide="ban" class="w-6 h-6"></i></div>`;
                // 取消拖曳目標屬性
                slot.removeAttribute('ondragover');
                slot.removeAttribute('ondrop');
                slot.removeAttribute('ondragenter');
                slot.removeAttribute('ondragleave');
            } else {
                slot.className += ` border-slate-800 bg-slate-900/30 opacity-50 cursor-pointer hover:opacity-80`;
                slot.innerHTML = `
                    ${emptyPcBadge}
                    <div class="w-full h-full flex items-center justify-center text-slate-700/50" onclick="toggleSeatAvailability(${i})" title="設為不開放座位"><i data-lucide="box-select" class="w-6 h-6"></i></div>`;
            }
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

        // 標記為手動排列
        data.config.isManualLayout = true;

        // 若有選取狀態，也需要一併轉移 (這裡簡單起見先清空選取，避免混淆)
        selectedIndices.clear();

        saveData();
        renderSeating();
    }
}

function toggleSeatAvailability(index) {
    const data = classesData[currentClass];
    if (!data.config.unavailableSeats) {
        data.config.unavailableSeats = [];
    }
    const idx = data.config.unavailableSeats.indexOf(index);
    const isOccupied = data.students && data.students[index] !== undefined;

    if (idx > -1) {
        data.config.unavailableSeats.splice(idx, 1);
        if (isOccupied || !data.config.isManualLayout) {
            data.config.isManualLayout = false; // 強制重新排列以填補空缺
            reflowClassLayout(currentClass, true);
        }
    } else {
        data.config.unavailableSeats.push(index);
        if (isOccupied) {
            data.config.isManualLayout = false; // 強制重新排列以擠出學生
            reflowClassLayout(currentClass, true);
        }
    }
    selectedIndices.clear();
    saveData();
    renderSeating();
}

function setPcNumber(index) {
    const data = classesData[currentClass];
    if (!data.config.pcNumbers) data.config.pcNumbers = {};

    const currentNum = data.config.pcNumbers[index] || '';
    const newNum = prompt("請輸入此座位的電腦編號 (留空則清除)：", currentNum);

    if (newNum !== null) {
        if (newNum.trim() === '') {
            delete data.config.pcNumbers[index];
        } else {
            data.config.pcNumbers[index] = newNum.trim();
        }
        saveData();
        renderSeating();
    }
}
// --- 匯出座位表圖片 ---
function exportSeatingChart() {
    const grid = document.getElementById('seatingGrid');
    if (!grid) return;

    const exportBtn = document.querySelector('button[onclick="exportSeatingChart()"]');
    const originalText = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) exportBtn.innerHTML = '<i data-lucide="loader" class="w-3 h-3 animate-spin"></i> 匯出中...';
    lucide.createIcons();

    setTimeout(() => {
        html2canvas(grid, {
            backgroundColor: '#0f172a', // match app background (slate-900)
            scale: 2, // high res
            logging: false,
            useCORS: true,
            onclone: (clonedDoc) => {
                // Ensure export mode applies to clone since body classes might not inherit correctly
                clonedDoc.body.classList.add('export-mode');
            }
        }).then(canvas => {
            const link = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `座位表_${currentClass}_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            if (exportBtn) exportBtn.innerHTML = originalText;
        }).catch(err => {
            console.error('Export failed:', err);
            alert('匯出圖片失敗，請稍後再試。');
            if (exportBtn) exportBtn.innerHTML = originalText;
        });
    }, 100);
}

// --- 套用設定至其他班級邏輯 ---
function openApplySettingsModal() {
    const modal = document.getElementById('applySettingsModal');
    const list = document.getElementById('targetClassesList');
    list.innerHTML = '';

    let optionsHtml = '';
    Object.keys(classesData).forEach(cls => {
        if (cls === currentClass) return;
        const studentCount = Object.values(classesData[cls].students || {}).length;
        optionsHtml += `
            <label class="flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-md cursor-pointer select-none transition-colors border border-transparent hover:border-slate-700">
                <input type="checkbox" value="${cls}" class="target-class-checkbox w-4 h-4 rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-0">
                <span class="text-sm font-bold text-slate-300 flex-1">${cls}</span>
                <span class="text-[10px] text-slate-500 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded font-mono">${studentCount} 人</span>
            </label>
        `;
    });

    if (optionsHtml === '') {
        list.innerHTML = '<div class="text-slate-500 text-sm p-4 text-center bg-slate-800/50 rounded-lg">目前沒有其他班級可供套用</div>';
    } else {
        list.innerHTML = optionsHtml;
    }

    modal.classList.remove('hidden');
}

function closeApplySettingsModal() {
    document.getElementById('applySettingsModal').classList.add('hidden');
}

function toggleAllTargetClasses() {
    const checkboxes = document.querySelectorAll('.target-class-checkbox');
    if (checkboxes.length === 0) return;
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

function confirmApplySettings() {
    const checkboxes = document.querySelectorAll('.target-class-checkbox:checked');
    const targetClasses = Array.from(checkboxes).map(cb => cb.value);

    if (targetClasses.length === 0) {
        alert('請先選擇至少一個目標班級！');
        return;
    }

    if (!confirm(`確定要將本班的座位設定套用到選取的 ${targetClasses.length} 個班級嗎？\n這會覆蓋這些班級目前的網格大小與不開放座位配置，並強制重新自動排位。\n電腦編號也會一併複製覆蓋。\n(不會影響學生的個人資料，但可能會把學生換位子)`)) {
        return;
    }

    const sourceConfig = classesData[currentClass].config;
    const sourceCols = sourceConfig.cols || 6;
    const sourceRows = sourceConfig.rows || 8;
    const sourceUnavailableCount = sourceConfig.unavailableSeats ? sourceConfig.unavailableSeats.length : 0;
    const validSeatCount = (sourceCols * sourceRows) - sourceUnavailableCount;

    const failedClasses = [];
    const successfulClasses = [];

    targetClasses.forEach(cls => {
        const targetData = classesData[cls];
        const studentCount = targetData.students ? Object.keys(targetData.students).length : 0;

        if (studentCount > validSeatCount) {
            failedClasses.push(`${cls} (${studentCount} 人)`);
            return;
        }

        if (!targetData.config) targetData.config = {};

        targetData.config.cols = sourceConfig.cols || 6;
        targetData.config.rows = sourceConfig.rows || 8;
        targetData.config.layoutMode = sourceConfig.layoutMode || 'rtl';
        targetData.config.unavailableSeats = sourceConfig.unavailableSeats ? [...sourceConfig.unavailableSeats] : [];
        targetData.config.pcNumbers = sourceConfig.pcNumbers ? JSON.parse(JSON.stringify(sourceConfig.pcNumbers)) : {};

        targetData.config.isManualLayout = false;
        reflowClassLayout(cls, true);

        successfulClasses.push(cls);
    });

    saveData();
    closeApplySettingsModal();

    let resultMessage = '';
    if (successfulClasses.length > 0) {
        resultMessage += `✅ 座位設定已成功套用至 ${successfulClasses.length} 個班級！\n`;
    }
    if (failedClasses.length > 0) {
        resultMessage += `⚠️ 以下班級因學生人数大於有效座位數 (${validSeatCount} 個)，套用失敗：\n${failedClasses.join(', ')}`;
    }

    if (resultMessage) {
        alert(resultMessage);
    }
}

function toggleSelection(event, index) {
    if (!currentClass || !classesData[currentClass]) return;

    // 如果不是多選模式且沒有按下 Shift/Ctrl，則不允許選取 (除非是透過點擊電腦編號等特定位置)
    if (!isSelectionMode && !(event && (event.shiftKey || event.ctrlKey || event.metaKey))) return;

    const data = classesData[currentClass];

    // Shift 鍵支援範圍選取
    if (event && event.shiftKey && lastSelectedIndexSelection !== null) {
        const start = Math.min(lastSelectedIndexSelection, index);
        const end = Math.max(lastSelectedIndexSelection, index);

        // 判斷是要全選還是全取消 (根據當前點擊目標的狀態的反向)
        const willSelect = !selectedIndices.has(index);

        for (let i = start; i <= end; i++) {
            // 只有有學生的位置且非缺席才選取
            if (data.students[i] && data.students[i].status !== 'absent') {
                if (willSelect) selectedIndices.add(i);
                else selectedIndices.delete(i);
            }
        }
    } else {
        // 一般單選
        if (selectedIndices.has(index)) {
            selectedIndices.delete(index);
        } else {
            // 只有有學生的座位才能選取
            if (data.students[index]) {
                selectedIndices.add(index);
            }
        }
        lastSelectedIndexSelection = index;
    }
    renderSeating();
}

function toggleSelectAll(isChecked) {
    const data = classesData[currentClass];
    selectedIndices.clear();
    if (isChecked) {
        isSelectionMode = true; // 強制進入多選模式以顯示勾選框
        Object.keys(data.students).forEach(key => {
            if (data.students[key].status !== 'absent') {
                selectedIndices.add(parseInt(key));
            }
        });
    } else {
        isSelectionMode = false; // 取消全選時，關閉多選模式 (隱藏勾選框)
    }
    renderSeating();
}

function toggleSelectionMode(forceValue) {
    if (typeof forceValue === 'boolean') {
        isSelectionMode = forceValue;
    } else {
        isSelectionMode = !isSelectionMode;
    }

    if (!isSelectionMode) {
        selectedIndices.clear(); // 關閉模式時清除選取
    }
    renderSeating();
}

// --- 分數理由與模態視窗邏輯 ---
let pendingScoreAction = null;

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
    },
    playTimerEnd: function () {
        this.init();
        const t = this.ctx.currentTime;
        const playTone = (freq, start, dur) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine'; // pure and soft tone to avoid harshness
            osc.frequency.value = freq;

            // Soft attack and smooth slow decay like a bell/chime
            gain.gain.setValueAtTime(0, start);
            // Allow the chime to be a little louder to distinguish it from the bg music
            gain.gain.linearRampToValueAtTime(0.9, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, start + dur);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + dur);
        };

        // Pleasant, soft 3 chimes (A5 note)
        for (let i = 0; i < 3; i++) {
            const offset = (i * 0.5); // Spread them out slightly
            playTone(880, t + offset, 0.8); // 880Hz, 0.8s duration per chime
        }
    },
    playCountdownBeep: function (index) {
        this.init();
        const t = this.ctx.currentTime;

        // Use a tiny burst of noise to simulate a mechanical "click"
        const bufferSize = this.ctx.sampleRate * 0.05; // 50ms
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter noise to sound like a sharp metallic tick/tock
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        // Alternate frequency for tick vs tock
        const isTick = index % 2 !== 0;
        filter.frequency.value = isTick ? 4000 : 2500;
        filter.Q.value = 1.0;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1.5, t); // loud!
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03); // super fast decay

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        // Add a very short, tonal square-wave to give the click a pitch
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(isTick ? 800 : 500, t);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Start context
        noise.start(t);
        noise.stop(t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
    }
};

function confirmScore(reason) {
    if (!pendingScoreAction) return;
    const { targets, delta, isBatch } = pendingScoreAction;
    // Always use the latest shared data
    const activeClassesData = window.classesData || classesData;
    const data = activeClassesData[currentClass];

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
        isSelectionMode = false; // 批次執行完畢後自動關閉多選模式
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

// --- 介面控制 ---
function toggleSeatingSettingsMenu() {
    const menu = document.getElementById('seatingSettingsMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
    menu.classList.toggle('animate-in', !menu.classList.contains('hidden'));

    // 點擊外面自動收合
    if (!menu.classList.contains('hidden')) {
        const closer = (e) => {
            const btn = document.getElementById('btnSeatingSettings');
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closer);
            }
        };
        setTimeout(() => document.addEventListener('click', closer), 10);
    }
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

        // 改進：合併儲存邏輯。saveAttendance 會呼叫 saveData，不需重複呼叫。
        // 這能減少同步鎖定的頻率，降低「跳動」感。
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
        SoundFX.playFanfare();
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
    document.getElementById('textbookEditTitle').innerHTML = '<i data-lucide="link-2" class="text-sky-400"></i> 新增教材連結';
    document.getElementById('editTplId').value = '';
    document.getElementById('editTplName').value = '';
    document.getElementById('editTplUrl').value = '';
    document.getElementById('editTplPublisher').value = '翰林';
    document.getElementById('editTplSemester').value = '一下';
    document.getElementById('textbookEditModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeTextbookEditModal() {
    document.getElementById('textbookEditModal').classList.add('hidden');
}

function saveTextbookEdit() {
    const id = document.getElementById('editTplId').value;
    const name = document.getElementById('editTplName').value.trim();
    const url = document.getElementById('editTplUrl').value.trim();
    const publisher = document.getElementById('editTplPublisher').value;
    const semester = document.getElementById('editTplSemester').value;

    if (!name || !url) {
        alert("請輸入名稱和連結");
        return;
    }

    if (id) {
        // Edit existing
        const item = textbookLinks.find(link => link.id == id);
        if (item) {
            item.name = name;
            item.url = url;
            item.publisher = publisher;
            item.semester = semester;
        }
    } else {
        // Add new
        textbookLinks.push({
            id: Date.now(),
            name: name,
            url: url,
            publisher: publisher,
            semester: semester,
            order: textbookLinks.length
        });
    }

    closeTextbookEditModal();
    saveData(); // Syncs to cloud
    renderTextbookGrid();
}

function renderTextbookGrid() {
    const grid = document.getElementById('textbookGrid');
    if (!grid) return;

    const publisherFilter = document.getElementById('textbookFilterPublisher') ? document.getElementById('textbookFilterPublisher').value : 'All';
    const semesterFilter = document.getElementById('textbookFilterSemester') ? document.getElementById('textbookFilterSemester').value : 'All';

    const filteredLinks = textbookLinks.filter(item => {
        const pubMatch = publisherFilter === 'All' || item.publisher === publisherFilter;
        const semMatch = semesterFilter === 'All' || item.semester === semesterFilter;
        return pubMatch && semMatch;
    });

    let html = '';

    if (textbookLayoutMode === 'list') {
        grid.className = "flex flex-col gap-4";
        filteredLinks.forEach((item) => {
            const pubBadge = item.publisher ? `<span class="bg-sky-600/20 text-sky-400 px-2 py-0.5 rounded text-xs ml-2">${item.publisher}</span>` : '';
            const semBadge = item.semester ? `<span class="bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded text-xs ml-2">${item.semester}</span>` : '';
            html += `
                <div class="glass-panel p-4 flex items-center gap-4 group hover:bg-slate-800/80 transition-all draggable-file" draggable="true" ondragstart="dragStart(event, ${item.id})" ondragover="dragOver(event)" ondrop="filesDrop(event, ${item.id})">
                    <div class="cursor-move w-10 flex justify-center text-slate-600 group-hover:text-slate-400 transition-colors">
                        <i data-lucide="grip-vertical" class="w-5 h-5"></i>
                    </div>
                    <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                        <i data-lucide="link" class="w-6 h-6 text-indigo-400/50 group-hover:text-indigo-400 transition-colors"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-lg leading-tight mb-1 truncate" title="${item.name}">${item.name}${pubBadge}${semBadge}</h3>
                        <p class="text-xs text-slate-500 truncate text-slate-600">${item.url}</p>
                    </div>
                    
                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onclick="previewTextbookLink('${item.url}', '${item.name}')" class="px-4 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2">
                            <i data-lucide="eye" class="w-4 h-4"></i> 預覽
                        </button>
                        <button onclick="editTextbook(${item.id});" class="p-2 hover:bg-amber-500/20 rounded-lg text-slate-400 hover:text-amber-400 transition-colors" title="編輯連結">
                            <i data-lucide="edit-2" class="w-5 h-5"></i>
                        </button>
                        <button onclick="deleteTextbook(${item.id});" class="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors" title="刪除連結">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    } else {
        grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6";

        filteredLinks.forEach((item) => {
            const pubBadge = item.publisher ? `<span class="bg-sky-600/20 text-sky-400 px-2 py-0.5 rounded text-xs mr-1">${item.publisher}</span>` : '';
            const semBadge = item.semester ? `<span class="bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded text-xs">${item.semester}</span>` : '';
            html += `
                <div class="glass-panel p-0 overflow-hidden flex flex-col group hover:ring-2 hover:ring-indigo-500/50 transition-all draggable-file" draggable="true" ondragstart="dragStart(event, ${item.id})" ondragover="dragOver(event)" ondrop="filesDrop(event, ${item.id})">
                    <div class="h-40 bg-slate-800 relative flex items-center justify-center overflow-hidden cursor-move">
                        <i data-lucide="link" class="w-16 h-16 text-indigo-400/20 group-hover:scale-110 transition-transform duration-500"></i>
                         <div class="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60"></div>
                         <span class="absolute bottom-2 right-2 text-[10px] font-mono bg-slate-900/80 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/30">LINK</span>
                         <button onclick="deleteTextbook(${item.id}); event.stopPropagation();" class="absolute top-2 right-2 p-1.5 bg-slate-900/50 hover:bg-rose-500 rounded-lg text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100" title="刪除連結">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                         </button>
                          <button onclick="editTextbook(${item.id}); event.stopPropagation();" class="absolute top-2 right-10 p-1.5 bg-slate-900/50 hover:bg-amber-500 rounded-lg text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100" title="編輯連結">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                         </button>
                    </div>
                    <div class="p-4 flex-1 flex flex-col">
                        <h3 class="font-bold text-lg leading-tight mb-1 truncate" title="${item.name}">${item.name}</h3>
                        <div class="flex items-center mb-1">${pubBadge}${semBadge}</div>
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
let draggedFileId = null;

function dragStart(event, id) {
    draggedFileId = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.innerHTML);
    event.target.classList.add('opacity-50');
}

function dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return false;
}

function filesDrop(event, targetId) {
    event.stopPropagation();
    event.preventDefault();

    const files = document.querySelectorAll('.draggable-file');
    files.forEach(file => file.classList.remove('opacity-50'));

    if (draggedFileId !== null && draggedFileId !== targetId) {
        // Find indices using id
        const dragIndex = textbookLinks.findIndex(l => l.id == draggedFileId);
        const targetIndex = textbookLinks.findIndex(l => l.id == targetId);

        if (dragIndex > -1 && targetIndex > -1) {
            // Reorder array
            const item = textbookLinks.splice(dragIndex, 1)[0];
            textbookLinks.splice(targetIndex, 0, item);

            // Update functionality 'order'
            textbookLinks.forEach((f, i) => f.order = i);

            saveData(); // Sync new order
            renderTextbookGrid();
        }
    }
    return false;
}

function deleteTextbook(id) {
    if (!confirm('確定要刪除這個教材連結嗎？')) return;
    const index = textbookLinks.findIndex(l => l.id == id);
    if (index > -1) {
        textbookLinks.splice(index, 1);
        saveData();
        renderTextbookGrid();
    }
}

function editTextbook(id) {
    const item = textbookLinks.find(l => l.id == id);
    if (!item) return;

    document.getElementById('textbookEditTitle').innerHTML = '<i data-lucide="edit-2" class="text-amber-400"></i> 編輯教材連結';
    document.getElementById('editTplId').value = item.id;
    document.getElementById('editTplName').value = item.name || '';
    document.getElementById('editTplUrl').value = item.url || '';
    document.getElementById('editTplPublisher').value = item.publisher || '翰林';
    document.getElementById('editTplSemester').value = item.semester || '一下';
    document.getElementById('textbookEditModal').classList.remove('hidden');
    lucide.createIcons();
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

    // Init Defaults
    const colEl = document.getElementById('sysDefCols');
    if (colEl) colEl.value = sysSettings.defaultCols || 6;
    const rowEl = document.getElementById('sysDefRows');
    if (rowEl) rowEl.value = sysSettings.defaultRows || 8;
    const layoutEl = document.getElementById('sysDefLayout');
    if (layoutEl) layoutEl.value = sysSettings.defaultLayoutMode || 'rtl';

    // Init Backup Reminder
    const brEnabled = document.getElementById('backupReminderEnabled');
    if (brEnabled) brEnabled.checked = sysSettings.backupReminder?.enabled || false;
    const brDay = document.getElementById('backupReminderDay');
    if (brDay) brDay.value = sysSettings.backupReminder?.day ?? 5;
    const brTime = document.getElementById('backupReminderTime');
    if (brTime) brTime.value = sysSettings.backupReminder?.time || "16:00";
}

function saveBackupReminderSettings() {
    if (!sysSettings.backupReminder) {
        sysSettings.backupReminder = { enabled: false, day: 5, time: "16:00", lastShownDate: "" };
    }

    sysSettings.backupReminder.enabled = document.getElementById('backupReminderEnabled').checked;
    sysSettings.backupReminder.day = parseInt(document.getElementById('backupReminderDay').value);
    sysSettings.backupReminder.time = document.getElementById('backupReminderTime').value;

    saveData();
}

function saveSysDefaults() {
    const cols = parseInt(document.getElementById('sysDefCols').value) || 6;
    const rows = parseInt(document.getElementById('sysDefRows').value) || 8;
    const layout = document.getElementById('sysDefLayout').value || 'rtl';

    sysSettings.defaultCols = cols;
    sysSettings.defaultRows = rows;
    sysSettings.defaultLayoutMode = layout;

    saveData();
    alert('✅ 預設座位設定已儲存！新建立的班級將會採用此網格與排序設定。');
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
            classesData['default'] = { students: {}, history: [], seatingLayout: [], attendanceLogs: [], config: { cols: 4, rows: 8 } };
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
                    <div class="col-span-3 font-bold text-white truncate">${s.name}</div>
                    <div class="col-span-2 text-center text-sm font-bold text-slate-400">
                        ${s.gender ? (['男', 'm', 'boy', 'male'].includes(s.gender.toLowerCase()) ? '<span class="text-sky-400">男</span>' : (['女', 'f', 'girl', 'female'].includes(s.gender.toLowerCase()) ? '<span class="text-pink-400">女</span>' : s.gender)) : '-'}
                    </div>
                    <div class="col-span-2 text-center font-mono text-yellow-500">${s.score || 0}</div>
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
        document.getElementById('manageGender').value = student.gender || '';
        document.getElementById('manageName').focus(); // Focus name for quick edit
    }
}

function managerAddStudent() {
    if (!managingClass) return;
    const seatInput = document.getElementById('manageSeatNo');
    const nameInput = document.getElementById('manageName');
    const genderInput = document.getElementById('manageGender');
    const seatNo = seatInput.value.trim().padStart(2, '0');
    const name = nameInput.value.trim();
    const gender = genderInput ? genderInput.value.trim() : '';

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
        existingStudent.gender = gender;
        // seatNo is same
    } else {
        // New Student
        classesData[managingClass].students['temp_' + seatNo] = {
            id: seatNo,
            seatNo: seatNo,
            name: name,
            gender: gender,
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
    if (genderInput) genderInput.value = '';
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

    lucide.createIcons({
        node: grid
    });
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
    currentTab = 'resource-detail';
    window.currentTab = 'resource-detail'; // Ensure global sync
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
            const sGender = parts[2] ? parts[2].trim() : '';
            newStudents[seatNo] = {
                seatNo: seatNo,
                name: sName,
                gender: sGender,
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
        config: { cols: sysSettings.defaultCols || 6, rows: sysSettings.defaultRows || 8, layoutMode: sysSettings.defaultLayoutMode || 'rtl', unavailableSeats: [] }
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

    // 每次渲染時重置全選勾選框 (Reset Select All checkbox on render)
    const selectAllCb = document.querySelector('input[onchange^="toggleSelectAllAttendance"]');
    if (selectAllCb) selectAllCb.checked = false;

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
                detailHtml = `<div class="mt-2 text-xs text-emerald-500/50 flex items-center"><i data-lucide="check" class="w-3 h-3 mr-1"></i> 全員出席</div>`;
            }

            // Note Logic
            const noteContent = log.note || "";
            const hasNote = noteContent && noteContent.trim().length > 0;
            const noteLabel = hasNote ? "查看記事" : "新增記事";
            const noteColor = hasNote ? "text-sky-400" : "text-slate-600";
            const icon = hasNote ? "file-text" : "file-plus";

            return `
                    <div class="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700 hover:border-slate-500 transition-all cursor-pointer group" onclick="toggleAttendanceNote(${log.originalIdx}, event)">
                        <div class="pt-1" onclick="event.stopPropagation()">
                             <input type="checkbox" value="${log.originalIdx}" class="attendance-checkbox w-4 h-4 rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-offset-0 focus:ring-1 focus:ring-sky-500" onchange="updateAttendanceDeleteBtnState()">
                        </div>
                        <div class="flex-1">
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
                    </div>
                    `;
        }).join('');
    }
    lucide.createIcons();
    updateAttendanceDeleteBtnState();
}

function updateAttendanceDeleteBtnState() {
    const checkedCount = document.querySelectorAll('.attendance-checkbox:checked').length;
    const btn = document.getElementById('btnDeleteAttendance');
    if (btn) {
        btn.disabled = checkedCount === 0;
        btn.innerHTML = checkedCount > 0 ? `<i data-lucide="trash-2" class="w-3 h-3"></i> 刪除紀錄 (${checkedCount})` : `<i data-lucide="trash-2" class="w-3 h-3"></i> 刪除已選`;
        lucide.createIcons();
    }
}

function toggleSelectAllAttendance(isChecked) {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
    updateAttendanceDeleteBtnState();
}

function deleteAttendanceLogs() {
    const checkboxes = document.querySelectorAll('.attendance-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`確定要刪除選取的 ${checkboxes.length} 筆點名紀錄嗎？此動作無法復原！`)) return;

    const data = classesData[currentClass];
    const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);

    indicesToDelete.forEach(idx => {
        data.attendanceLogs.splice(idx, 1);
    });

    saveData();
    renderAttendanceList('pageAttendanceList');
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

    // 每次渲染時重置全選勾選框 (Reset Select All checkbox on render)
    const selectAllCb = document.querySelector('input[onchange^="toggleSelectAllScores"]');
    if (selectAllCb) selectAllCb.checked = false;

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

function toggleSelectAllScores(isChecked) {
    const checkboxes = document.querySelectorAll('.history-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
    updateRevokeBtnState();
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
function saveAttendance(isAuto = false, timestamp = null) {
    const data = classesData[currentClass];
    if (!data.attendanceLogs) data.attendanceLogs = [];

    const now = timestamp ? new Date(timestamp) : new Date();
    const dateString = now.toDateString(); // e.g. "Fri Feb 02 2024"

    // 檢查是否已有該日期紀錄
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
        // 更新內容但保留時間戳記 (除非是手動儲存)
        // 這能防止自動儲存時，紀錄在清單中頻繁「跳動」位置
        if (!isAuto) {
            targetRecord.time = now.toISOString();
        }
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

    // 如果在紀錄頁面，立即更新列表
    if (currentTab === 'records') {
        renderAttendanceList('pageAttendanceList');
        if (window.lucide) lucide.createIcons();
    }

    if (!isAuto) {
        // 手動觸發時才跳 Alert
        const counts = targetRecord.stats;
        alert(`更新完成！\n日期: ${now.toLocaleDateString()}\n出席: ${counts.present}\n缺席: ${counts.absent}\n遲到: ${counts.late}\n已更新該日點名紀錄。`);
    } else {
        console.log('Attendance auto-saved with details');
    }
}

function openManualAttendanceModal() {
    const now = new Date();
    // 預設今天與現在時間
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    document.getElementById('manualAttendanceDate').value = `${year}-${month}-${day}`;
    document.getElementById('manualAttendanceTime').value = `${hours}:${minutes}`;

    document.getElementById('manualAttendanceModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeManualAttendanceModal() {
    document.getElementById('manualAttendanceModal').classList.add('hidden');
}

function confirmManualAttendance() {
    const dateVal = document.getElementById('manualAttendanceDate').value;
    const timeVal = document.getElementById('manualAttendanceTime').value;

    if (!dateVal || !timeVal) {
        alert("請選擇日期與時間");
        return;
    }

    // 將日期與時間組合成 Date 物件
    // YYYY-MM-DD + T + HH:MM
    const isoString = `${dateVal}T${timeVal}`;
    const timestamp = new Date(isoString).getTime();

    if (isNaN(timestamp)) {
        alert("無效的日期或時間格式");
        return;
    }

    saveAttendance(false, timestamp);
    closeManualAttendanceModal();
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
    totalSeconds: 60,
    remainingSeconds: 60,
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

    const minInput = document.getElementById('timerInputMin');
    const secInput = document.getElementById('timerInputSec');

    if (minInput && secInput) {
        minInput.value = String(m).padStart(2, '0');
        secInput.value = String(s).padStart(2, '0');
    } else {
        const display = document.getElementById('timerDisplay');
        if (display) display.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Progress
    const progress = document.getElementById('timerProgress');
    const circumference = 283;
    const offset = circumference - (timerState.remainingSeconds / timerState.totalSeconds) * circumference;
    progress.style.strokeDashoffset = offset;

    if (timerState.remainingSeconds <= 10 && timerState.remainingSeconds > 0) {
        progress.classList.add('text-rose-500');
        progress.style.stroke = '#f43f5e';
        if (timerState.isRunning) {
            const beepIndex = 11 - timerState.remainingSeconds; // 1 to 10
            SoundFX.playCountdownBeep(beepIndex);

            // Lower music volume to make beep more prominent
            const audioPlayer = document.getElementById('timerAudioPlayer');
            if (audioPlayer) audioPlayer.volume = 0.2;
        }
    } else {
        progress.classList.remove('text-rose-500');
        progress.style.stroke = '#fbbf24';

        // Restore music volume
        const audioPlayer = document.getElementById('timerAudioPlayer');
        if (audioPlayer) audioPlayer.volume = 1.0;
    }
}

function updateTimerFromInput() {
    if (timerState.isRunning) return;

    const minInput = document.getElementById('timerInputMin');
    const secInput = document.getElementById('timerInputSec');

    if (!minInput || !secInput) return;

    let m = parseInt(minInput.value) || 0;
    let s = parseInt(secInput.value) || 0;

    // Constrain values
    if (m < 0) m = 0;
    if (m > 99) m = 99;
    if (s < 0) s = 0;
    if (s > 59) s = 59;

    minInput.value = String(m).padStart(2, '0');
    secInput.value = String(s).padStart(2, '0');

    timerState.totalSeconds = (m * 60) + s;
    timerState.remainingSeconds = timerState.totalSeconds;

    // Update progress ring
    updateTimerDisplay();
}

function handleTimerInputEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur(); // Triggers onblur which calls updateTimerFromInput
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

    lucide.createIcons({
        node: container
    });
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

function handleTimerMusicSelect() {
    const select = document.getElementById('timerMusicSelect');
    const audioPlayer = document.getElementById('timerAudioPlayer');
    const value = select.value;

    if (value === 'custom') {
        document.getElementById('timerMusicUpload').click();
    } else if (value === '') {
        audioPlayer.removeAttribute('src');
        audioPlayer.pause();
    } else {
        audioPlayer.src = value;
        // 如果計時器正在跑，就直接播放
        if (timerState.isRunning) {
            audioPlayer.play().catch(console.error);
        }
    }
}

function handleTimerMusicUpload(event) {
    const file = event.target.files[0];
    const select = document.getElementById('timerMusicSelect');

    if (!file) {
        select.value = "";
        handleTimerMusicSelect();
        return;
    }

    const audioPlayer = document.getElementById('timerAudioPlayer');
    const objectUrl = URL.createObjectURL(file);
    audioPlayer.src = objectUrl;

    if (timerState.isRunning) {
        audioPlayer.play().catch(console.error);
    }
}

function timerAction(action) {
    if (action === 'toggle') {
        if (timerState.isRunning) {
            clearInterval(timerState.intervalId);
            timerState.isRunning = false;
            document.getElementById('timerStatusLabel').innerText = "PAUSED";
            document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
            document.getElementById('timerAudioPlayer').pause();
        } else {
            if (timerState.remainingSeconds <= 0) return;
            timerState.isRunning = true;
            document.getElementById('timerStatusLabel').innerText = "RUNNING";
            document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="pause" class="w-6 h-6 fill-current"></i>`;

            const audioPlayer = document.getElementById('timerAudioPlayer');
            if (audioPlayer.src) {
                audioPlayer.play().catch(console.error);
            }

            timerState.intervalId = setInterval(() => {
                timerState.remainingSeconds--;
                updateTimerDisplay();

                if (timerState.remainingSeconds <= 0) {
                    clearInterval(timerState.intervalId);
                    timerState.isRunning = false;
                    document.getElementById('timerStatusLabel').innerText = "TIME UP";
                    document.getElementById('btnTimerToggle').innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
                    document.getElementById('timerAudioPlayer').pause();
                    document.getElementById('timerAudioPlayer').currentTime = 0;
                    SoundFX.playTimerEnd();
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

        const audioPlayer = document.getElementById('timerAudioPlayer');
        audioPlayer.pause();
        audioPlayer.currentTime = 0;

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

    const audioPlayer = document.getElementById('timerAudioPlayer');
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }

    updateTimerDisplay();
    lucide.createIcons();
}

// Draggable Logic
const dragHandle = document.getElementById('timerDragHandle');
const dragModal = document.getElementById('floatingTimer');
let isDragging = false;
let currentX = 0;
let currentY = 0;
let initialX = 0;
let initialY = 0;

if (dragHandle && dragModal) {
    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;

        if (dragModal.style.position !== 'fixed' && dragModal.style.position !== 'absolute') {
            const rect = dragModal.getBoundingClientRect();
            dragModal.style.position = 'fixed';
            dragModal.style.left = rect.left + 'px';
            dragModal.style.top = rect.top + 'px';
            dragModal.style.bottom = 'auto';
            dragModal.style.right = 'auto';
            dragModal.style.transform = 'none';
            dragModal.style.margin = '0';
        }

        initialX = e.clientX - dragModal.offsetLeft;
        initialY = e.clientY - dragModal.offsetTop;

        dragModal.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        dragModal.style.pointerEvents = 'none';
        dragHandle.style.pointerEvents = 'auto';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        e.preventDefault();

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        dragModal.style.left = currentX + 'px';
        dragModal.style.top = currentY + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        dragModal.style.cursor = 'default';
        document.body.style.userSelect = '';
        dragModal.style.pointerEvents = 'auto';
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

// --- Calendar Logic ---
let currentCalendarDate = new Date();

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('currentCalendarMonthLabel');
    if (!grid || !label) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    label.innerText = `${year}年 ${String(month + 1).padStart(2, '0')}月`;

    grid.innerHTML = '';

    // Get first day of month (0 = Sunday) and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Fill empty days before 1st
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="p-2 min-h-[80px] rounded-xl bg-slate-800/10 border border-slate-700/10"></div>`;
    }

    // Fill days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        const currentDayOfWeek = new Date(year, month, day).getDay();
        const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

        let dayClass = "p-3 h-24 rounded-xl flex flex-col items-start justify-start border transition-all hover:bg-slate-700/50 hover:-translate-y-1 shadow-sm relative group ";
        let numClass = "font-mono font-bold text-lg ";

        if (isToday) {
            dayClass += "bg-sky-500/10 border-sky-500 shadow-[inset_0_0_15px_rgba(14,165,233,0.2)]";
            numClass += "text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-full";
        } else {
            dayClass += "bg-slate-800/40 border-slate-700 hover:border-slate-500";
            numClass += isWeekend ? "text-rose-400" : "text-slate-300";
        }

        grid.innerHTML += `
            <div class="${dayClass}">
                <span class="${numClass} mb-1">${day}</span>
                <div class="flex-1 w-full flex flex-col gap-1 overflow-y-auto hide-scrollbar">
                    <!-- Events will go here if any -->
                </div>
            </div>
        `;
    }

    if (window.lucide) lucide.createIcons();
}

function changeCalendarMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function resetCalendarToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}

// ============================================
// 排序演算法視覺化 (Sort Algorithm Visualization)
// ============================================
let sortState = {
    algo: 'selection',
    array: [8, 5, 10, 1, 7],
    initialArray: [8, 5, 10, 1, 7],
    autoPlayTimer: null,
    isPlaying: false,
    initialized: false,
    states: [],
    stepIndex: 0
};

function initSortAlgo(algo = 'selection') {
    sortState.algo = algo;
    sortState.array = [...sortState.initialArray];
    sortState.stepIndex = 0;
    sortState.initialized = true;
    sortState.states = [];
    if (sortState.isPlaying) algoToggleAutoPlay();

    // Generate states
    if (algo === 'selection') {
        generateSelectionSortStates();
    } else {
        generateInsertionSortStates();
    }

    // Update UI active tab
    const btnSel = document.getElementById('btn-algo-selection');
    const btnIns = document.getElementById('btn-algo-insertion');
    if (btnSel && btnIns) {
        btnSel.className = 'px-4 py-2 rounded-lg font-bold shadow-lg transition-all ' + (algo === 'selection' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300');
        btnIns.className = 'px-4 py-2 rounded-lg font-bold shadow-lg transition-all ' + (algo === 'insertion' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300');
    }

    renderSortState();
}

function generateSelectionSortStates() {
    let arr = [...sortState.initialArray];
    let states = [];
    states.push({
        array: [...arr],
        sortedEndIndex: -1,
        comparingIndices: [],
        minIndex: -1,
        roundIndex: 0,
        explanation: "<b>初始狀態</b><br>未排序的原始資料：[8, 5, 10, 1, 7]"
    });

    for (let i = 0; i < arr.length; i++) {
        let minIdx = i;
        let currentRound = i + 1;
        states.push({
            array: [...arr],
            sortedEndIndex: i - 1,
            comparingIndices: [i],
            minIndex: minIdx,
            roundIndex: currentRound,
            explanation: `<b>第 ${currentRound} 回合尋找</b><br>從未排序的資料中找到第一個最小的元素。<br>預設目前最小元素為 ${arr[minIdx]}。`
        });

        for (let j = i + 1; j < arr.length; j++) {
            let explanation = `<b>尋找最小元素</b><br>比較 ${arr[j]} 和目前的最小值 ${arr[minIdx]}。`;
            let isNewMin = arr[j] < arr[minIdx];
            if (isNewMin) {
                explanation += `<br><span class="text-orange-400 font-bold">${arr[j]} 較小！</span> 準備更新目前最小元素為 ${arr[j]}。`;
            } else {
                explanation += `<br>目前的最小值 ${arr[minIdx]} 較小，不更新。`;
            }
            states.push({
                array: [...arr],
                sortedEndIndex: i - 1,
                comparingIndices: [j, minIdx],
                minIndex: minIdx,
                roundIndex: currentRound,
                explanation: explanation
            });

            if (isNewMin) {
                minIdx = j;
                states.push({
                    array: [...arr],
                    sortedEndIndex: i - 1,
                    comparingIndices: [minIdx],
                    minIndex: minIdx,
                    roundIndex: currentRound,
                    explanation: `<b>更新最小元素</b><br>已將目前最小元素更新為 ${arr[minIdx]}。`
                });
            }
        }

        let explanationFound = `<b>完成第 ${currentRound} 回合尋找</b><br>在未排序資料中找到最小的元素是 ${arr[minIdx]}。`;
        states.push({
            array: [...arr],
            sortedEndIndex: i - 1,
            comparingIndices: [minIdx],
            minIndex: minIdx,
            roundIndex: currentRound,
            explanation: explanationFound + (minIdx !== i ? `<br>準備將其與未排序區的第一個元素（${arr[i]}）交換。` : `<br>它已經在正確的位置。`)
        });

        if (minIdx !== i) {
            let temp = arr[i];
            arr[i] = arr[minIdx];
            arr[minIdx] = temp;
        }

        states.push({
            array: [...arr],
            sortedEndIndex: i, // array[i] is now sorted
            comparingIndices: [i, minIdx],
            minIndex: -1,
            roundIndex: currentRound,
            explanation: `<b>加入已排序數列</b><br>已將 ${arr[i]} 加到已排序數列的結尾。`
        });
    }

    states.push({
        array: [...arr],
        sortedEndIndex: arr.length - 1,
        comparingIndices: [],
        minIndex: -1,
        roundIndex: -1,
        explanation: `<b>排序完成！</b><br>原始資料已全部處理完成。`
    });

    sortState.states = states;
}

function generateInsertionSortStates() {
    let arr = [...sortState.initialArray];
    let states = [];
    states.push({
        array: [...arr],
        sortedEndIndex: -1,
        comparingIndices: [],
        activeValue: null,
        activeIndex: -1,
        roundIndex: 0,
        explanation: "<b>初始狀態</b><br>未排序的原始資料：[8, 5, 10, 1, 7]"
    });

    states.push({
        array: [...arr],
        sortedEndIndex: 0,
        comparingIndices: [],
        activeValue: null,
        activeIndex: -1,
        roundIndex: 1,
        explanation: "<b>第 1 回合</b><br>取出未排序資料中的第 1 個元素（8），加到已排序數列中的第一項。"
    });

    for (let i = 1; i < arr.length; i++) {
        let currentValue = arr[i];
        let currentRound = i + 1;

        states.push({
            array: [...arr],
            sortedEndIndex: i - 1,
            comparingIndices: [i],
            activeValue: currentValue,
            activeIndex: i,
            roundIndex: currentRound,
            explanation: `<b>第 ${currentRound} 回合</b><br>從未排序的原始資料中取出下一個元素（${currentValue}）。<br>準備由前往後和已排序數列元素比較。`
        });

        let targetIndex = i;
        for (let k = 0; k < i; k++) {
            states.push({
                array: [...arr],
                sortedEndIndex: i - 1,
                comparingIndices: [k],
                activeValue: currentValue,
                activeIndex: i,
                roundIndex: currentRound,
                explanation: `<b>尋找插入位置</b><br>由前往後將 ${currentValue} 和已排序元素 ${arr[k]} 比較。<br>遇到大於自己的元素就插入此元素之前。`
            });
            if (arr[k] > currentValue) {
                targetIndex = k;
                states.push({
                    array: [...arr],
                    sortedEndIndex: i - 1,
                    comparingIndices: [k],
                    activeValue: currentValue,
                    activeIndex: i,
                    roundIndex: currentRound,
                    explanation: `<b>找到插入位置！</b><br>遇到 ${arr[k]} 大於自己（${currentValue}），所以插入在 ${arr[k]} 之前。`
                });
                break;
            }
        }

        if (targetIndex === i) {
            states.push({
                array: [...arr],
                sortedEndIndex: i - 1,
                comparingIndices: [i - 1],
                activeValue: currentValue,
                activeIndex: i,
                roundIndex: currentRound,
                explanation: `<b>加入最後一項</b><br>沒有遇到大於自己（${currentValue}）的元素，否則插入在已排序數列的最後一項。`
            });
        }

        if (targetIndex < i) {
            for (let m = i; m > targetIndex; m--) {
                arr[m] = arr[m - 1];
            }
            arr[targetIndex] = currentValue;
        }

        states.push({
            array: [...arr],
            sortedEndIndex: i,
            comparingIndices: [],
            activeValue: null,
            activeIndex: -1,
            roundIndex: currentRound,
            explanation: `<b>完成一次插入</b><br>已將 ${currentValue} 插入到正確位置。目前已排序數列增加一項。`
        });
    }

    states.push({
        array: [...arr],
        sortedEndIndex: arr.length - 1,
        comparingIndices: [],
        activeValue: null,
        activeIndex: -1,
        roundIndex: -1,
        explanation: `<b>排序完成！</b><br>已經處理完所有元素回合。`
    });

    sortState.states = states;
}

function renderSortState() {
    if (!sortState.states[sortState.stepIndex]) return;
    const state = sortState.states[sortState.stepIndex];

    const titleEl = document.getElementById('algoTitle');
    const descEl = document.getElementById('algoDescription');
    const hintEl = document.getElementById('algoStepHint');
    const rulesListEl = document.getElementById('algoRulesList');

    if (titleEl) titleEl.innerText = sortState.algo === 'selection' ? '選擇排序法 (Selection Sort)' : '插入排序法 (Insertion Sort)';
    if (descEl) descEl.innerHTML = state.explanation;
    if (hintEl) hintEl.innerText = state.roundIndex === 0 ? '初始狀態' : (state.roundIndex === -1 ? '排序完成' : `第 ${state.roundIndex} 回合`);
    if (rulesListEl) {
        if (sortState.algo === 'selection') {
            rulesListEl.innerHTML = `
                <li>先從未排序的原始資料中找到第一個最小的元素，將它加到已排序數列的第一項。</li>
                <li>接著從未排序的原始資料中找到最小的元素。</li>
                <li>將此元素加到已排序數列的最後一項。</li>
                <li>重複第 2、3 點的步驟，直到原始資料全部處理完成。</li>
            `;
        } else {
            rulesListEl.innerHTML = `
                <li>先從未排序的原始資料中，取出第 1 個元素加到已排序數列中的第一項。</li>
                <li>接著從未排序的原始資料中逐一取出元素。</li>
                <li>由前往後和已排序數列元素比較，遇到大於自己的元素就插入此元素之前；否則插入在已排序數列的最後一項。</li>
                <li>重複第 2、3 點的步驟，直到原始資料全部處理完成。</li>
            `;
        }
    }

    const nextBtn = document.getElementById('btn-algo-next');
    if (nextBtn) {
        if (sortState.stepIndex >= sortState.states.length - 1) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
            if (sortState.isPlaying) algoToggleAutoPlay();
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    const prevBtn = document.getElementById('btn-algo-prev');
    if (prevBtn) {
        if (sortState.stepIndex <= 0) {
            prevBtn.disabled = true;
            prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            prevBtn.disabled = false;
            prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    const container = document.getElementById('sortArrayContainer');
    if (!container) return;

    const labelsContainer = document.getElementById('sortLabelsContainer');
    if (labelsContainer && labelsContainer.children.length !== state.array.length) {
        labelsContainer.innerHTML = '';
        state.array.forEach((_, idx) => {
            const labelNode = document.createElement('div');
            labelNode.className = 'w-16 md:w-20 text-center text-slate-400 text-[13px] font-bold tracking-wider';
            labelNode.innerText = `第 ${idx + 1} 個`;
            labelsContainer.appendChild(labelNode);
        });
    }

    // --- FLIP Animation Technique: First ---
    // Record current positions of existing items based on their data-flip-id
    const oldRects = {};
    const flipElements = container.querySelectorAll('[data-flip-id]');
    flipElements.forEach(el => {
        oldRects[el.dataset.flipId] = el.getBoundingClientRect();
    });

    container.innerHTML = '';
    const newElementsMap = {};

    state.array.forEach((val, idx) => {
        // Outer wrapper for tracking position and animating via FLIP
        const wrapper = document.createElement('div');
        wrapper.className = 'w-16 md:w-20 relative transition-transform z-0';
        wrapper.dataset.flipId = `val-${val}`;
        // Keep a minimum height to prevent layout collapse
        wrapper.style.height = `${Math.max(...sortState.initialArray) * 16}px`;

        // Inner block for values and states
        const blk = document.createElement('div');
        blk.className = 'absolute bottom-0 w-full transition-all duration-300 ease-in-out flex flex-col items-center justify-end origin-bottom';
        blk.style.height = `${val * 16}px`;

        let bgColor = 'bg-slate-700'; // unsorted
        let borderColor = 'border-slate-600';
        let textColor = 'text-slate-300';

        if (idx <= state.sortedEndIndex) {
            bgColor = 'bg-emerald-500';
            borderColor = 'border-emerald-400';
            textColor = 'text-white';
        }

        if (state.comparingIndices?.includes(idx)) {
            bgColor = 'bg-orange-500';
            borderColor = 'border-orange-400';
            textColor = 'text-white';
            blk.classList.add('scale-105');
            wrapper.classList.remove('z-0');
            wrapper.classList.add('z-10'); // Bring to front

            if (sortState.algo === 'insertion' && idx === state.activeIndex) {
                // active element being inserted (24px up)
                blk.classList.add('-translate-y-6', 'drop-shadow-[0_10px_10px_rgba(249,115,22,0.5)]');
            } else {
                blk.classList.add('drop-shadow-lg');
            }
        }

        const box = document.createElement('div');
        box.className = `w-full h-full ${bgColor} border-2 ${borderColor} rounded-t-lg shadow-lg flex items-end justify-center pb-2 transition-colors duration-300`;
        box.innerHTML = `<span class="font-bold text-xl md:text-2xl ${textColor} drop-shadow transition-colors duration-300">${val}</span>`;

        blk.appendChild(box);
        wrapper.appendChild(blk);

        // Add badges to wrapper, not blk, to independently FLIP transition over DOM hierarchy moves
        const baseBadgeBottom = Math.max(val * 16, 38); // prevent text overflow from low values blocking badge

        if (sortState.algo === 'selection' && idx === state.minIndex && state.minIndex !== -1) {
            const minBadgeWrapper = document.createElement('div');
            minBadgeWrapper.dataset.flipId = 'minBadge';
            minBadgeWrapper.className = 'absolute w-full z-30 transition-transform flex justify-center pointer-events-none';
            minBadgeWrapper.style.bottom = `${baseBadgeBottom + 12}px`;

            const minBadge = document.createElement('div');
            minBadge.className = 'bg-sky-500 text-white text-[12px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap animate-bounce';
            minBadge.innerText = '最小';

            minBadgeWrapper.appendChild(minBadge);
            wrapper.appendChild(minBadgeWrapper);
        }

        if (sortState.algo === 'insertion' && idx === state.activeIndex && state.activeIndex !== -1) {
            const activeBadgeWrapper = document.createElement('div');
            activeBadgeWrapper.dataset.flipId = 'activeBadge';
            activeBadgeWrapper.className = 'absolute w-full z-30 transition-transform flex justify-center pointer-events-none';
            // Offset logic: block translated up 24px visually, tracking that
            const blockOffset = (idx === state.activeIndex && state.comparingIndices?.includes(idx)) ? 24 : 0;
            activeBadgeWrapper.style.bottom = `${baseBadgeBottom + 12 + blockOffset}px`;

            const activeBadge = document.createElement('div');
            activeBadge.className = 'bg-pink-500 text-white text-[12px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap animate-bounce';
            activeBadge.innerText = '處理元素';

            activeBadgeWrapper.appendChild(activeBadge);
            wrapper.appendChild(activeBadgeWrapper);
        }

        container.appendChild(wrapper);
    });

    // Map new elements
    const newFlipElements = container.querySelectorAll('[data-flip-id]');
    newFlipElements.forEach(el => {
        newElementsMap[el.dataset.flipId] = el;
    });

    // --- FLIP: Last ---
    const newRects = {};
    newFlipElements.forEach(el => {
        newRects[el.dataset.flipId] = el.getBoundingClientRect();
    });

    // --- FLIP: Invert ---
    Object.keys(newElementsMap).forEach(flipId => {
        const el = newElementsMap[flipId];
        const oldRect = oldRects[flipId];
        const newRect = newRects[flipId];

        if (oldRect && newRect) {
            let deltaX = oldRect.left - newRect.left;
            let deltaY = oldRect.top - newRect.top;

            // Adjust for parent's FLIP inversion if parent is also FLIPped
            const parentWrapper = el.parentElement.closest('[data-flip-id]');
            if (parentWrapper) {
                const parentFlipId = parentWrapper.dataset.flipId;
                if (oldRects[parentFlipId] && newRects[parentFlipId]) {
                    const parentOld = oldRects[parentFlipId];
                    const parentNew = newRects[parentFlipId];
                    const parentDeltaX = parentOld.left - parentNew.left;
                    const parentDeltaY = parentOld.top - parentNew.top;

                    deltaX -= parentDeltaX;
                    deltaY -= parentDeltaY;
                }
            }

            if (deltaX !== 0 || deltaY !== 0) {
                // Temporarily invert to previous position securely without transition
                el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                el.style.transition = 'none';
            }
        }
    });

    // --- FLIP: Play ---
    // Force layout computation 
    container.offsetHeight;

    Object.keys(newElementsMap).forEach(flipId => {
        const el = newElementsMap[flipId];
        if (oldRects[flipId]) {
            // Initiate transition back to correct origin (0, 0)
            el.style.transition = 'transform 0.5s ease-in-out';
            el.style.transform = 'translate(0px, 0px)';

            // Cleanup post-transition
            setTimeout(() => {
                el.style.transition = '';
                el.style.transform = '';
            }, 500);
        }
    });
}

function algoNextStep() {
    if (sortState.stepIndex < sortState.states.length - 1) {
        sortState.stepIndex++;
        renderSortState();
    }
}

function algoPrevStep() {
    if (sortState.stepIndex > 0) {
        // Stop autoplay on manual prev step
        if (sortState.isPlaying) algoToggleAutoPlay();
        sortState.stepIndex--;
        renderSortState();
    }
}

function algoToggleAutoPlay() {
    sortState.isPlaying = !sortState.isPlaying;
    const autoBtnTxt = document.getElementById('autoPlayText');
    const autoBtnIcon = document.getElementById('autoPlayIcon');

    if (sortState.isPlaying) {
        if (autoBtnTxt) autoBtnTxt.innerText = '停止自動';
        if (autoBtnIcon) autoBtnIcon.setAttribute('data-lucide', 'square');
        if (window.lucide) lucide.createIcons();
        if (sortState.stepIndex >= sortState.states.length - 1) {
            sortState.stepIndex = 0; // auto-restart
        }
        sortState.autoPlayTimer = setInterval(() => {
            if (sortState.stepIndex < sortState.states.length - 1) {
                algoNextStep();
            } else {
                algoToggleAutoPlay(); // Stop
            }
        }, 1200);
    } else {
        if (autoBtnTxt) autoBtnTxt.innerText = '自動播放';
        if (autoBtnIcon) autoBtnIcon.setAttribute('data-lucide', 'play');
        if (window.lucide) lucide.createIcons();
        clearInterval(sortState.autoPlayTimer);
    }
}

function resetSortArray() {
    if (sortState.isPlaying) algoToggleAutoPlay();
    initSortAlgo(sortState.algo);
}

window.initSortAlgo = initSortAlgo;
window.algoNextStep = algoNextStep;
window.algoPrevStep = algoPrevStep;
window.algoToggleAutoPlay = algoToggleAutoPlay;
window.resetSortArray = resetSortArray;

// ============================================
// 排序互動測驗 (Sort Interactive Quiz)
// ============================================

let quizStateData = {
    algo: 'selection',
    initialArray: [],
    correctRounds: []
};

function generateSortQuiz() {
    quizStateData.algo = sortState.algo;
    const algoNameEl = document.getElementById('quizAlgoName');
    if (algoNameEl) {
        algoNameEl.innerText = quizStateData.algo === 'selection' ? '選擇排序法 (Selection Sort)' : '插入排序法 (Insertion Sort)';
    }

    const arr = [];
    for (let i = 0; i < 5; i++) {
        arr.push(Math.floor(Math.random() * 50) + 1);
    }
    quizStateData.initialArray = [...arr];

    const displayEl = document.getElementById('quizInitialArrayDisplay');
    if (displayEl) displayEl.innerText = arr.join(', ');

    // Generate correct answers based on the algorithm logic exactly like the visualizer
    quizStateData.correctRounds = computeCorrectSortRounds(quizStateData.algo, [...arr]);

    // Build UI
    const rowsContainer = document.getElementById('quizRowsContainer');
    if (!rowsContainer) return;
    rowsContainer.innerHTML = '';

    quizStateData.correctRounds.forEach((roundArr, rIdx) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'flex flex-col md:flex-row items-start md:items-center gap-3 w-full bg-slate-800/40 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors';

        const label = document.createElement('div');
        label.className = 'w-24 text-sky-400 font-bold shrink-0 text-center md:text-left text-[15px]';
        label.innerText = `第 ${rIdx + 1} 回合`;
        rowDiv.appendChild(label);

        const inputsWrapper = document.createElement('div');
        inputsWrapper.className = 'flex gap-2 flex-wrap flex-1 justify-center md:justify-start';

        for (let i = 0; i < 5; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.pattern = '[0-9]*';
            input.maxLength = 2;
            input.dataset.row = rIdx;
            input.dataset.col = i;
            input.className = 'quiz-input w-12 h-12 md:w-14 md:h-14 font-mono font-bold text-lg md:text-xl text-center bg-slate-900 border-2 border-slate-600 rounded-lg text-white placeholder-slate-600 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20 outline-none transition-all';
            input.placeholder = '?';

            // disable mouse wheel
            input.addEventListener('wheel', (e) => e.preventDefault());

            // clean styling on type
            input.addEventListener('input', (e) => {
                e.target.classList.remove('border-emerald-500', 'bg-emerald-500/20', 'text-emerald-300', 'border-rose-500', 'bg-rose-500/20', 'text-rose-300');
                e.target.classList.add('bg-slate-900', 'border-slate-600', 'text-white');
            });

            inputsWrapper.appendChild(input);
        }

        rowDiv.appendChild(inputsWrapper);
        rowsContainer.appendChild(rowDiv);
    });

    const pEl = document.getElementById('quizPlaceholder');
    const cEl = document.getElementById('quizContainer');
    const msgEl = document.getElementById('quizResultMsg');
    if (pEl) pEl.classList.add('hidden');
    if (cEl) cEl.classList.remove('hidden');
    if (msgEl) msgEl.innerHTML = '';

    if (window.lucide) lucide.createIcons();
}

function computeCorrectSortRounds(algo, arr) {
    let rounds = [];
    if (algo === 'selection') {
        for (let i = 0; i < arr.length; i++) {
            let minIdx = i;
            for (let j = i + 1; j < arr.length; j++) {
                if (arr[j] < arr[minIdx]) {
                    minIdx = j;
                }
            }
            if (minIdx !== i) {
                let temp = arr[i];
                arr[i] = arr[minIdx];
                arr[minIdx] = temp;
            }
            rounds.push([...arr]);
        }
    } else {
        rounds.push([...arr]); // 第 1 回合 (初始狀態：第1個元素已排序)
        for (let i = 1; i < arr.length; i++) {
            let current = arr[i];
            let j = i - 1;
            while (j >= 0 && arr[j] > current) {
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = current;
            rounds.push([...arr]);
        }
    }
    return rounds;
}

function verifySortQuiz() {
    const inputs = document.querySelectorAll('.quiz-input');
    if (inputs.length === 0) return;

    let allCorrect = true;
    let anyFilled = false;
    let allFilled = true;

    inputs.forEach(input => {
        const userValStr = input.value.trim();
        if (userValStr === '') {
            allFilled = false;
        } else {
            anyFilled = true;
        }
    });

    const msgEl = document.getElementById('quizResultMsg');

    inputs.forEach(input => {
        const rIdx = parseInt(input.dataset.row);
        const cIdx = parseInt(input.dataset.col);
        const correctVal = quizStateData.correctRounds[rIdx][cIdx];
        const userValStr = input.value.trim();

        input.classList.remove('border-slate-600', 'bg-slate-900', 'text-white', 'border-emerald-500', 'bg-emerald-500/20', 'text-emerald-300', 'border-rose-500', 'bg-rose-500/20', 'text-rose-300');

        if (userValStr === '') {
            input.classList.add('border-slate-600', 'bg-slate-900', 'text-white');
        } else {
            const userVal = parseInt(userValStr);
            if (userVal === correctVal) {
                input.classList.add('border-emerald-500', 'bg-emerald-500/20', 'text-emerald-300');
            } else {
                input.classList.add('border-rose-500', 'bg-rose-500/20', 'text-rose-300');
                allCorrect = false;
            }
        }
    });

    if (!anyFilled) {
        msgEl.innerHTML = '<i data-lucide="info" class="text-sky-500 w-6 h-6 shrink-0"></i><span class="text-sky-400">目前還沒有填寫任何答案喔！請先填入數字。</span>';
    } else if (allCorrect && allFilled) {
        msgEl.innerHTML = '<i data-lucide="check-circle-2" class="text-emerald-500 w-6 h-6 shrink-0"></i><span class="text-emerald-400">完全正確！你已經掌握這個演算法了！</span>';
    } else if (allCorrect && !allFilled) {
        msgEl.innerHTML = '<i data-lucide="check-circle-2" class="text-emerald-500 w-6 h-6 shrink-0"></i><span class="text-emerald-400">目前填寫的空格都是正確的，繼續加油把剩下的完成吧！</span>';
    } else {
        msgEl.innerHTML = '<i data-lucide="x-circle" class="text-rose-500 w-6 h-6 shrink-0"></i><span class="text-rose-400">哎呀有部分錯誤，請檢查紅框欄位並重新確認規則。</span>';
    }
    if (window.lucide) lucide.createIcons();
}

window.generateSortQuiz = generateSortQuiz;
window.verifySortQuiz = verifySortQuiz;

