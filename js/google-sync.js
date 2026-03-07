/**
 * Google Sheets Synchronization Module for IT Class Master
 * Handles Two-Way Sync via Google Apps Script (GAS) Web App
 */

const GoogleSync = {
    url: localStorage.getItem('it-class-master-gas-url') || '',
    autoSyncInterval: null,
    isSyncing: false,
    lastSyncTime: 0,
    lastServerTimestamp: 0, // Track server version
    dirty: false,
    debouncer: null,

    init: function () {
        if (this.url) {
            console.log("Google Sync Initialized");
            this.updateUIStatus('ready');
            this.startAutoSync();
        } else {
            console.log("Google Sync not configured.");
            this.updateUIStatus('not-configured');
        }
    },

    setURL: async function (newUrl) {
        this.url = newUrl.trim();
        localStorage.setItem('it-class-master-gas-url', this.url);
        this.isSyncing = false;

        if (this.url) {
            this.startAutoSync();

            // Try to pull first (New Device/Sync Scenario)
            console.log("New URL set, attempting initial pull...");

            // Modified to check if cloud already has data
            const pullResult = await this.pull();

            if (pullResult === "SUCCESS") {
                console.log("Cloud data applied. Skipping initial push.");
            } else if (pullResult === "EMPTY") {
                // ONLY push if cloud is explicitly empty
                if (Object.keys(window.classesData || {}).length > 0) {
                    console.log("Cloud is empty. Initializing with local data...");
                    this.push();
                }
            } else {
                console.log("Pull error occurred. Aborting initial push to prevent data loss.");
            }
        } else {
            this.stopAutoSync();
        }
    },

    startAutoSync: function () {
        if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
        // 每 5 分鐘檢查一次雲端更新 (Cross-device Sync)
        this.autoSyncInterval = setInterval(() => {
            if (!this.dirty) { // 如果本地沒改變，才去檢查雲端
                this.checkUpdates();
            }
        }, 300000);
        console.log("Auto-sync: Check for updates every 5m.");
    },

    stopAutoSync: function () {
        if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
        this.autoSyncInterval = null;
    },

    // Called when local data changes
    schedPush: function () {
        if (!this.url) {
            console.log("Sync skipped: No URL configured");
            return;
        }
        this.dirty = true;
        this.updateUIStatus('dirty');
        console.log("Scheduled push in 3s...");

        if (this.debouncer) clearTimeout(this.debouncer);
        // Wait 3 seconds of inactivity before pushing
        this.debouncer = setTimeout(() => {
            this.push();
        }, 3000);
    },

    checkUpdates: async function () {
        if (!this.url || this.isSyncing) return;

        try {
            const response = await fetch(this.url + "?action=check");
            if (!response.ok) return;
            const data = await response.json();

            if (data.timestamp && data.timestamp > this.lastServerTimestamp) {
                console.log("Cloud update detected! Pulling new version...");
                this.pull();
            }
        } catch (e) {
            console.warn("Check updates failed:", e);
        }
    },

    push: async function () {
        if (!this.url || this.isSyncing) return;
        this.isSyncing = true;
        this.dirty = false; // Reset dirty flag now. If changes occur during fetch, it will be set to true again.
        this.updateUIStatus('syncing-upload');
        console.log("Starting Push...");

        try {
            // Use window globals to ensure latest data
            const bundle = {
                classesData: window.classesData || (typeof classesData !== 'undefined' ? classesData : {}),
                teacherTimetable: window.teacherTimetable || (typeof teacherTimetable !== 'undefined' ? teacherTimetable : {}),
                periodTimes: window.periodTimes || (typeof periodTimes !== 'undefined' ? periodTimes : []),
                scoreReasons: window.scoreReasons || (typeof scoreReasons !== 'undefined' ? scoreReasons : {}),
                teachingResources: window.teachingResources || (typeof teachingResources !== 'undefined' ? teachingResources : []),
                modules: window.modules || (typeof modules !== 'undefined' ? modules : []),
                textbookLinks: window.textbookLinks || (typeof textbookLinks !== 'undefined' ? textbookLinks : []),
                sysSettings: window.sysSettings || (typeof sysSettings !== 'undefined' ? sysSettings : {}),
                currentClass: window.currentClass || (typeof currentClass !== 'undefined' ? currentClass : ""),
                lastActiveDate: new Date().toDateString()
            };

            const response = await fetch(this.url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(bundle),
                redirect: 'follow',
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) throw new Error(`伺服器回傳錯誤 ${response.status}`);

            const resText = await response.text();
            let resJson;
            try {
                resJson = JSON.parse(resText);
            } catch (e) {
                // If it's valid JSON but wrapped in something else (rare)
                throw new Error("伺服器回傳格式不正確 (JSON 解析失敗)");
            }

            if (resJson.result === 'error') throw new Error(resJson.error);

            this.lastSyncTime = Date.now();
            if (resJson.timestamp) this.lastServerTimestamp = resJson.timestamp;

            this.updateUIStatus('synced');
            console.log("Push completed successfully");

        } catch (e) {
            console.error("Sync Push Error:", e);
            this.updateUIStatus('error');

            let msg = e.message;
            if (msg === 'Failed to fetch') {
                msg = "連線失敗 (Failed to fetch)。\n這可能是因為資料量過大導致 Google 伺服器回應逾時。\n請確認您已按照最新說明更新 GAS 代碼。";
            }
            if (!this.autoSyncInterval) alert("同步失敗：" + msg);
        } finally {
            this.isSyncing = false;
            // If data became dirty during the sync (e.g. another concurrent update), trigger another push
            if (this.dirty) {
                console.log("Data became dirty during push, re-scheduling...");
            }
        }
    },

    pull: async function () {
        if (!this.url) {
            alert('請先設定 Google Apps Script URL');
            return false;
        }
        if (this.isSyncing) return false;

        this.isSyncing = true;
        this.updateUIStatus('syncing-download');

        try {
            const response = await fetch(this.url + "?action=get");
            if (!response.ok) throw new Error('Network response was not ok');

            const raw = await response.json();
            if (raw.timestamp) this.lastServerTimestamp = raw.timestamp;
            console.log("Pulled raw from cloud:", raw);

            let data = raw;
            if (raw.payload) {
                let payloadStr = raw.payload;
                if (typeof payloadStr === 'string' && payloadStr.length > 0) {
                    try {
                        data = JSON.parse(payloadStr);
                    } catch (parseErr) {
                        console.error("Critical: Cloud data is truncated or corrupted.");
                        const pos = parseInt(parseErr.message.match(/\d+/)) || 0;
                        this.updateUIStatus('error');
                        alert(`同步失敗：雲端資料格式損毀 (位置 ${pos})。\n\n這通常是舊版同步造成的資料截斷。請執行以下操作恢復：\n1. 如果您有正確資料的分頁，請在該分頁點擊保存以覆蓋雲端。\n2. 若所有分頁皆無資料，請到試算表刪除「DB_State」分頁後重新整理。`);
                        return "ERROR";
                    }
                } else {
                    data = raw.payload;
                }
            }

            if (data.result === 'error' || raw.result === 'error') {
                console.warn('GAS Server error:', data.error);
                this.updateUIStatus('error');
                return "ERROR";
            }

            if (!data || Object.keys(data).length === 0 || (!data.classesData && !data.scoreReasons)) {
                console.log("Cloud is truly empty.");
                this.updateUIStatus('ready');
                return "EMPTY";
            }

            if (data.classesData || data.scoreReasons) { // Found something meaningful
                // Check for Date Mismatch (New Day Reset)
                const todayStr = new Date().toDateString();
                const cloudDate = data.lastActiveDate;

                if (!cloudDate || cloudDate !== todayStr) {
                    console.log(`Cloud data date (${cloudDate}) != Today (${todayStr}). Resetting attendance...`);
                    Object.values(data.classesData).forEach(cls => {
                        if (cls.students) {
                            Object.values(cls.students).forEach(s => {
                                s.status = 'present';
                                s.note = '';
                            });
                        }
                    });
                } else {
                    console.log("Cloud data is from today. Keeping attendance.");
                }

                // Update Global & Local State via the new injection function
                if (typeof window.applySyncData === 'function') {
                    window.applySyncData(data);
                } else {
                    // Fallback if script.js isn't updated
                    window.classesData = data.classesData;
                    if (data.teacherTimetable) window.teacherTimetable = data.teacherTimetable;
                    if (data.periodTimes) window.periodTimes = data.periodTimes;
                    if (data.scoreReasons) window.scoreReasons = data.scoreReasons;
                    saveData(true);
                }

                this.lastSyncTime = Date.now();
                this.updateUIStatus('synced');
                return "SUCCESS";
            } else {
                this.updateUIStatus('error');
                return "EMPTY";
            }

        } catch (error) {
            console.error('Pull failed:', error);
            this.updateUIStatus('error');
            if (error.message.includes("Unexpected token")) {
                alert('解析失敗：雲端資料格式錯誤。\n可能是因為試算表單一儲存格資料過長被截斷。\n請按照最新說明更新 Google Apps Script 代碼。');
            } else {
                alert('同步失敗：' + error.message);
            }
            return "ERROR";
        } finally {
            this.isSyncing = false;
        }
    },


    updateUIStatus: function (state) {
        const statusEl = document.getElementById('syncStatusIndicator');
        const textEl = document.getElementById('syncStatusText');
        if (!statusEl || !textEl) return;

        console.log(`UI Status Update: ${state}`); // Debug log

        let color = 'bg-slate-500';
        let text = '未設定';

        switch (state) {
            case 'ready':
                color = 'bg-slate-400';
                text = '就緒';
                break;
            case 'dirty':
                color = 'bg-yellow-500';
                text = '等待同步...';
                break;
            case 'syncing-upload':
                color = 'bg-blue-500 animate-pulse';
                text = '上傳中...';
                break;
            case 'syncing-download':
                color = 'bg-purple-500 animate-pulse';
                text = '下載中...';
                break;
            case 'synced':
                color = 'bg-emerald-500';
                text = '已同步';
                break;
            case 'error':
                color = 'bg-red-500';
                text = '同步錯誤';
                break;
            case 'not-configured':
                color = 'bg-slate-700';
                text = '未連線';
                break;
        }

        // statusEl is the dot
        statusEl.className = `w-2.5 h-2.5 rounded-full ${color} shadow-lg`;
        textEl.innerText = text;

        // Update Time
        const timeEl = document.getElementById('lastSyncTime');
        if (timeEl && this.lastSyncTime > 0) {
            const date = new Date(this.lastSyncTime);
            timeEl.innerText = date.toLocaleTimeString();
        }
    }
};

// Expose to global scope explicitly
window.GoogleSync = GoogleSync;
