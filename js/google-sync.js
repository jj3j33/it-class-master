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

            // Try to pull first (New Device Scenario)
            console.log("New URL set, attempting pull...");

            // pull handles isSyncing flag, but we should ensure we wait
            await this.pull();

            // If we are here, pull finished (either error or empty). 
            // If it succeeded with data, page would have reloaded.
            // If we have local data, we can now safely push to initialize the cloud.
            if (Object.keys(window.classesData || {}).length > 0) {
                console.log("Pushing local data to initialize cloud...");
                this.push();
            } else {
                console.log("No local data to push. Waiting for user input.");
            }

        } else {
            this.stopAutoSync();
        }
    },

    startAutoSync: function () {
        if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
        this.autoSyncInterval = null;
        console.log("Auto-sync: Upload Only Mode Active.");
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
        // Disabled
        return;
    },

    push: async function () {
        if (!this.url || this.isSyncing) return;
        this.isSyncing = true;
        this.updateUIStatus('syncing-upload');
        console.log("Starting Push...");

        try {
            // Use window globals to ensure latest data
            const bundle = {
                classesData: window.classesData || classesData,
                teacherTimetable: window.teacherTimetable || teacherTimetable,
                periodTimes: window.periodTimes || periodTimes,
                scoreReasons: window.scoreReasons || scoreReasons,
                teachingResources: window.teachingResources || teachingResources,
                modules: window.modules || modules, // Sync Modules Order
                lastActiveDate: new Date().toDateString() // Add Date to Sync
            };

            const response = await fetch(this.url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(bundle)
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);

            const resText = await response.text();
            let resJson;
            try {
                resJson = JSON.parse(resText);
            } catch (e) {
                throw new Error("Server response was not valid JSON. Response: " + resText.substring(0, 100));
            }

            if (resJson.result === 'error') throw new Error(resJson.error);

            this.dirty = false;
            this.lastSyncTime = Date.now();
            if (resJson.timestamp) this.lastServerTimestamp = resJson.timestamp; // Update version

            this.updateUIStatus('synced');
            console.log("Push completed successfully");

        } catch (e) {
            console.error("Sync Push Error:", e);
            this.updateUIStatus('error');
            // Show alert for troubleshooting
            if (e.message.includes("not valid JSON")) {
                alert("上傳失敗：伺服器回傳格式錯誤。\n原因可能是：\n1. Google Apps Script 尚未重新部署 (New Version)。\n2. 權限未設定為「所有人 (Anyone)」。\n\n內容片段: " + e.message);
            } else {
                if (!this.autoSyncInterval) alert("同步失敗：" + e.message);
            }
        } finally {
            this.isSyncing = false;
        }
    },

    pull: async function () {
        if (!this.url) {
            alert('請先設定 Google Apps Script URL');
            return;
        }
        if (this.isSyncing) return;

        this.isSyncing = true;
        this.updateUIStatus('syncing-download');

        try {
            const response = await fetch(this.url + "?action=get");
            if (!response.ok) throw new Error('Network response was not ok');

            const raw = await response.json();
            console.log("Pulled raw:", raw);

            // Handle wrapped response (Support current GAS format)
            let data = raw;
            if (raw.payload && typeof raw.payload === 'object') {
                data = raw.payload;
            }

            // Check if GAS returned an error object
            if (data.result === 'error' || raw.result === 'error') {
                console.warn('GAS Server returned error:', data.error);
                this.updateUIStatus('error');
                return;
            }

            // If empty object or null (first time init), treat as no data
            if (!data || Object.keys(data).length === 0) {
                console.log("Cloud seems empty. Sync ready.");
                this.updateUIStatus('ready');
                return;
            }

            if (data.classesData) {
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

                // Update Global Data
                window.classesData = data.classesData;
                if (data.teacherTimetable) window.teacherTimetable = data.teacherTimetable;
                if (data.periodTimes) window.periodTimes = data.periodTimes;
                if (data.scoreReasons) window.scoreReasons = data.scoreReasons;
                if (data.teachingResources) window.teachingResources = data.teachingResources;
                if (data.modules) window.modules = data.modules; // Load Modules Order

                // Save to local storage without triggering push
                saveData(true);

                this.lastSyncTime = Date.now();
                this.updateUIStatus('synced');
                this.lastSyncTime = Date.now();
                this.updateUIStatus('synced');

                // Refresh UI via global functions
                console.log("Cloud data loaded, refreshing UI...");
                if (typeof window.initClassSelector === 'function') window.initClassSelector();
                if (typeof window.initTimetableEditor === 'function') window.initTimetableEditor();
                if (typeof window.updateTimeAndStatus === 'function') window.updateTimeAndStatus();

                if (window.currentTab === 'resource-detail') {
                    // Do not redirect if user is viewing resource detail
                    if (typeof window.renderResources === 'function') window.renderResources();
                } else {
                    if (typeof window.switchTab === 'function') window.switchTab(window.currentTab || 'dashboard');
                }

                // Optional: Show a subtle notification or just rely on the green status light
                // alert('下載成功！'); // Removed to avoid startup annoyance
            } else {
                console.warn("Received data missing classesData. Is the sheet empty?");
                this.updateUIStatus('error');
            }

        } catch (error) {
            console.error('Pull failed:', error);
            this.updateUIStatus('error');
            alert('同步失敗：' + error.message + '\n請檢查網址是否正確，或權限是否設為「任何人 (Anyone)」。');
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
