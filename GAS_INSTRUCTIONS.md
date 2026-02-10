# Google Sheets Sync Backend Setup

為了啟用「Class Master」與 Google 試算表的同步功能，您需要建立一個 Google Apps Script (GAS) 專案作為後端橋梁。請按照以下步驟操作：

## 步驟 1: 建立試算表與腳本
1. 登入您的 Google 帳號，並[建立一個新的 Google 試算表](https://sheets.new)。
2. 將試算表命名為 **"IT Class Master Database"** (或其他您喜歡的名稱)。
3. 在上方選單中，點選 **「擴充功能」 (Extensions)** > **「Apps Script」**。
4. 這將會開啟一個新的程式碼編輯器視窗。

## 步驟 2: 貼上程式碼
1. 清除編輯器中的所有預設程式碼 (如 `function myFunction() {...}`).
2. 複製下方的完整程式碼，並貼上至編輯器中：

```javascript
/**
 * IT Class Master Sync Backend
 * Handles data synchronization between the web app and Google Sheets.
 */

/**
 * IT Class Master Sync Backend
 * Handles data synchronization between the web app and Google Sheets.
 */


function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_State");
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({timestamp: 0, payload: {}}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var dataStr = sheet.getRange("A1").getValue();
  if (!dataStr) dataStr = "{}";
  
  var tsVal = sheet.getRange("A2").getValue();
  var ts = new Date(tsVal).getTime();
  if (isNaN(ts)) ts = 0;
  
  // 1. Lightweight Check
  if (action == "check") {
    return ContentService.createTextOutput(JSON.stringify({timestamp: ts}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 2. Full Read (Wrapped)
  var output = '{"timestamp":' + ts + ',"payload":' + dataStr + '}';
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      var dataStr = e.postData.contents;
      // Validate JSON
      var data = JSON.parse(dataStr);
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var stateSheet = ss.getSheetByName("DB_State");
      if (!stateSheet) { 
        stateSheet = ss.insertSheet("DB_State"); 
        stateSheet.hideSheet(); 
      }
      
      var now = new Date();
      stateSheet.getRange("A1").setValue(dataStr);
      stateSheet.getRange("A2").setValue(now); // Save Timestamp
      
      // Export Views
      if (data.classesData) {
        updateRosterView(data.classesData);
        updateAttendanceLog(data.classesData);
        updateScoreLog(data.classesData);
        updateConfigView(data);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        result: "success", 
        timestamp: now.getTime()
      })).setMimeType(ContentService.MimeType.JSON);
        
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        result: "error", 
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
    }
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error", 
      error: "Server busy"
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateConfigView(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("View_Config");
  if (!sheet) sheet = ss.insertSheet("View_Config");
  sheet.clear();
  
  var rows = [];
  
  // --- Timetable ---
  rows.push(["[ 課表設定 ]", "", "", "", "", ""]);
  rows.push(["節次", "週一", "週二", "週三", "週四", "週五"]);
  
  if (data.teacherTimetable) {
    for (var i = 1; i <= 8; i++) {
      var week = data.teacherTimetable[i] || ["", "", "", "", ""];
      // Convert simple array or object to array
      var weekArr = [];
      for (var d=0; d<5; d++) weekArr.push(week[d] || "");
      
      var row = ["第 " + i + " 節"].concat(weekArr);
      rows.push(row);
    }
  }
  rows.push(["", "", "", "", "", ""]);
  
  // --- Times ---
  rows.push(["[ 作息時間 ]", "", "", "", "", ""]);
  rows.push(["節次", "開始", "結束", "", "", ""]);
  if (data.periodTimes) {
    data.periodTimes.forEach(function(p) {
      rows.push(["第 " + p.id + " 節", p.start, p.end, "", "", ""]);
    });
  }
  rows.push(["", "", "", "", "", ""]);

  // --- Reasons ---
  rows.push(["[ 加分理由 ]", "[ 扣分理由 ]", "", "", "", ""]);
  var scoreReasons = data.scoreReasons || { positive: [], negative: [] };
  var posList = scoreReasons.positive || [];
  var negList = scoreReasons.negative || [];
  var maxLen = Math.max(posList.length, negList.length);
  
  for (var k = 0; k < maxLen; k++) {
    var pos = posList[k] || "";
    var neg = negList[k] || "";
    rows.push([pos, neg, "", "", "", ""]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 6).setValues(rows);
    sheet.autoResizeColumns(1, 6);
    // Add some color
    sheet.getRange(1, 1, rows.length, 6).setVerticalAlignment("middle");
  }
}

function updateRosterView(classesData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("View_Roster");
  if (!sheet) sheet = ss.insertSheet("View_Roster");
  
  sheet.clear();
  var headers = ["Class", "Seat No", "Name", "Score", "Status", "Note"];
  var rows = [headers];
  
  for (var className in classesData) {
    try {
      var cls = classesData[className];
      var students = cls.students;
      // Sort keys mostly for stability, though SeatNo sort is better
      var sortedKeys = Object.keys(students).sort(function(a,b){
        var sa = students[a], sb = students[b];
        return (parseInt(sa.seatNo)||0) - (parseInt(sb.seatNo)||0);
      });
      
      sortedKeys.forEach(function(key){
        var s = students[key];
        rows.push([className, "'" + s.seatNo, s.name, s.score, translateStatus(s.status), s.note]);
      });
    } catch(e) {}
  }
  
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function updateAttendanceLog(classesData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("View_Attendance_Log");
  if (!sheet) sheet = ss.insertSheet("View_Attendance_Log");
  
  sheet.clear();
  var headers = ["Class", "Date", "Time", "Present", "Absent", "Late", "Details", "Note"];
  var rows = [headers];
  
  // Aggregate all logs
  var allLogs = [];
  for (var className in classesData) {
    var cls = classesData[className];
    if (cls.attendanceLogs && Array.isArray(cls.attendanceLogs)) {
      cls.attendanceLogs.forEach(function(log) {
        log.className = className;
        allLogs.push(log);
      });
    }
  }
  
  // Sort by time descending
  allLogs.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });
  
  allLogs.forEach(function(log) {
    var d = new Date(log.time);
    var dateStr = d.getFullYear() + "/" + (d.getMonth()+1) + "/" + d.getDate();
    var timeStr = d.getHours() + ":" + ("0"+d.getMinutes()).slice(-2);
    
    // Format Details
    var detailsStr = "";
    if (log.details && log.details.length > 0) {
      detailsStr = log.details.map(function(det) {
        var statusLabel = (det.status === 'absent') ? "缺" : "遲";
        var note = det.note ? "(" + det.note + ")" : "";
        return det.seatNo + det.name + " " + statusLabel + note;
      }).join(", ");
    } else {
      detailsStr = "全勤";
    }
    
    rows.push([
      log.className,
      dateStr,
      timeStr,
      log.stats.present,
      log.stats.absent,
      log.stats.late,
      detailsStr,
      log.note || ""
    ]);
  });
  
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e0f2fe");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function updateScoreLog(classesData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("View_Score_Log");
  if (!sheet) sheet = ss.insertSheet("View_Score_Log");
  
  sheet.clear();
  var headers = ["Class", "Date", "Time", "Seat No", "Name", "Action/Reason", "Delta"];
  var rows = [headers];
  
  var allScores = [];
  for (var className in classesData) {
    var cls = classesData[className];
    var students = cls.students;
    for (var key in students) {
      var s = students[key];
      if (s.history && Array.isArray(s.history)) {
        s.history.forEach(function(h) {
          allScores.push({
            className: className,
            seatNo: s.seatNo,
            name: s.name,
            time: h.time,
            reason: h.reason,
            delta: h.delta
          });
        });
      }
    }
  }
  
  // Sort logic: 
  // 1. Time Descending (Newest first)
  // 2. If same time (batch op), Seat No Descending (Larger seat no first)
  allScores.sort(function(a, b) { 
    var timeA = new Date(a.time).getTime();
    var timeB = new Date(b.time).getTime();
    
    if (timeB !== timeA) {
      return timeB - timeA;
    } else {
      // Same time, sort by seat no desc
      var seatA = parseInt(a.seatNo) || 0;
      var seatB = parseInt(b.seatNo) || 0;
      return seatB - seatA;
    }
  });
  
  allScores.forEach(function(item) {
    var d = new Date(item.time);
    var dateStr = d.getFullYear() + "/" + (d.getMonth()+1) + "/" + d.getDate();
    var timeStr = d.getHours() + ":" + ("0"+d.getMinutes()).slice(-2) + ":" + ("0"+d.getSeconds()).slice(-2);
    
    rows.push([
      item.className,
      dateStr,
      timeStr,
      "'" + item.seatNo,
      item.name,
      item.reason,
      item.delta
    ]);
  });
  
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#fff7ed");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function translateStatus(status) {
  if (status === 'present') return "出席";
  if (status === 'absent') return "缺席";
  if (status === 'late') return "遲到";
  return status;
}
```

## 步驟 3: 部署 Web App
1. 點擊右上角的 **「部署」 (Deploy)** 按鈕 > **「新增部署作業」 (New deployment)**。
2. 點選左側的「齒輪」圖示 > 選擇 **「網頁應用程式」 (Web app)**。
3. 設定如下：
   - **說明 (Description)**: `Class Master Sync` (可選)
   - **執行身分 (Execute as)**: **`我` (Me)**  <u style="color:red">重要！</u>
   - **誰可以存取 (Who has access)**: **`所有人` (Anyone)** <u style="color:red">重要！</u>
     *(注意：這允許任何擁有網址的人讀寫此試算表，但對於教學工具通常是方便且可接受的。)*
4. 點擊 **「部署」 (Deploy)**。
5. 第一次部署時，Google 會要求您 **授予存取權 (Authorize access)**。
   - 點擊「授予存取權」。
   - 選擇您的 Google 帳號。
   - 如果出現「Google 尚未驗證這個應用程式」的警告，請點擊 **「進階」 (Advanced)** > **「前往 (您的專案名稱) (不安全)」**，然後點擊「允許」。

## 步驟 4: 完成設定
1. 部署成功後，我們會看到 **「網頁應用程式網址」 (Web App URL)**。
2. 點擊「複製」。
3. 回到 **IT Class Master** 系統。
4. 進入 **「系統設定」** > **「雲端同步設定」**。
5. 將網址貼上並儲存。
6. 系統將會自動嘗試連線並同步資料。
