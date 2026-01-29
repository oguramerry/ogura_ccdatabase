// forecast.js
// Ver 3.0: 週次カレンダー対応、ナビゲーション、過去/現在の強調、デビュー判定修正

window.WeatherForecast = {
  // 状態管理：現在表示している週の「日曜日」を保持
  currentWeekStart: null,
  statsDataCache: null,

  // ステージ設定
  STAGE_INFO: {
    "Palaistra": { jp: "パライストラ", abbr: "パラ", class: "Palaistra" },
    "Volcanic Heart": { jp: "ヴォルカニック・ハート", abbr: "VH", class: "VolcanicHeart" },
    "Clockwork Castletown": { jp: "東方絡繰御殿", abbr: "からくり", class: "ClockworkCastletown" },
    "Bayside Battleground": { jp: "ベイサイド・バトルグラウンド", abbr: "BB", class: "BaysideBattleground" },
    "Cloud Nine": { jp: "クラウドナイン", abbr: "C9", class: "CloudNine" },
    "Red Sands": { jp: "レッド・サンズ", abbr: "サンズ", class: "RedSands" }
  },

  // 初期化＆描画
  render: function(statsData) {
    this.statsDataCache = statsData;
    const wrapper = document.getElementById("forecastWrapper");
    if (!wrapper || !statsData) return;

    // 初回のみ現在の週（日曜日始まり）を計算してセット
    if (!this.currentWeekStart) {
      this.resetToCurrentWeek();
      this.setupNavigation(); // ボタンのイベントリスナー設定
    }

    this.updateView();
  },

  // 今週にリセット
  resetToCurrentWeek: function() {
    const now = new Date();
    // 5時ルール：今の時間が深夜なら、実質「昨日」の続き
    if (now.getHours() < 5) now.setDate(now.getDate() - 1);
    
    // その週の日曜日を算出
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day);
    // 時刻を0:00に正規化
    this.currentWeekStart = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
  },

  // ナビゲーションボタンの設定
  setupNavigation: function() {
    document.getElementById("prevWeekBtn")?.addEventListener("click", () => {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
      this.updateView();
    });
    document.getElementById("nextWeekBtn")?.addEventListener("click", () => {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      this.updateView();
    });
    document.getElementById("currentWeekBtn")?.addEventListener("click", () => {
      this.resetToCurrentWeek();
      this.updateView();
    });
  },

  // 描画更新のメイン処理
  updateView: function() {
    const wrapper = document.getElementById("forecastWrapper");
    const label = document.getElementById("forecastRangeLabel");
    if (!this.statsDataCache || !this.currentWeekStart) return;

    const SLOTS = ["21:00", "22:30", "00:00", "01:30"];
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    
    // 表示用の日付リスト（日～土）生成
    const targetDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.currentWeekStart);
      d.setDate(this.currentWeekStart.getDate() + i);
      targetDates.push(d);
    }

    // ラベル更新 (MM/DD ～ MM/DD)
    const endDay = targetDates[6];
    if (label) {
      label.textContent = `${targetDates[0].getMonth() + 1}/${targetDates[0].getDate()} ～ ${endDay.getMonth() + 1}/${endDay.getDate()}`;
    }

    // HTML生成
    let html = `<table class="forecast-table"><thead><tr><th></th>`;
    targetDates.forEach(d => {
      html += `<th class="forecast-th">${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})</th>`;
    });
    html += `</tr></thead><tbody>`;

    const now = new Date(); // 現在時刻（過去・未来判定用）

    SLOTS.forEach(slot => {
      html += `<tr><td class="forecast-time-label">${slot}</td>`;
      
      targetDates.forEach(date => {
        // --- 1. 時刻とマップの計算 ---
        const [h, m] = slot.split(":").map(Number);
        
        // 物理的な開始時刻
        const startDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
        // 00:00以降は翌日扱い
        if (h < 5) startDateTime.setDate(startDateTime.getDate() + 1);

        // 終了時刻（90分後）
        const endDateTime = new Date(startDateTime.getTime() + 90 * 60000);

        // --- 2. 過去・現在・未来の判定クラス ---
        let timeClass = "";
        if (now >= endDateTime) {
          timeClass = "is-past"; // 終了済み
        } else if (now >= startDateTime && now < endDateTime) {
          timeClass = "is-now";  // 開催中
        }

        // --- 3. 予報データの取得 ---
        const stageKey = this.getStageAtTime(startDateTime.getTime());
        const info = this.STAGE_INFO[stageKey] || { jp: stageKey, abbr: stageKey, class: "unknown" };
        
        // バックオフ計算
        // date.getDay() は「5時区切りの曜日」として正しいものを渡す
        const res = this.calculateBackoff(this.statsDataCache, date.getDay(), slot, stageKey);

        // --- 4. コンテンツ生成 ---
        let innerHTML = "";
        if (res.total === 0) {
          innerHTML = `<span class="status-text status-debut">デビュー</span>`;
        } else if (res.p > 0.5) {
          const icons = res.topJobs.map(job => 
            `<img src="../images/JOB/${job}.png" class="forecast-job-icon" title="${job} (勝率${(res.jobRates[job]*100).toFixed(1)}%)">`
          ).join("");
          innerHTML = `${icons}`; 
        } else if (res.p > 0.45) {
          innerHTML = `<span class="status-text status-pupi">プピ</span>`;
        } else if (res.p > 0.40) {
          innerHTML = `<span class="status-text status-gekipupi">激プピ</span>`;
        } else {
          innerHTML = `<span class="status-text status-retirement">引退</span>`;
        }

        html += `
          <td class="forecast-cell st-bar-${info.class} ${timeClass}">
            <span class="st-abbr">${info.abbr}</span>
            <div class="forecast-content">${innerHTML}</div>
          </td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    wrapper.innerHTML = html;
  },

  getStageAtTime: function(timeMs) {
    let diff = timeMs - CC_CONFIG.ANCHOR_EPOCH;
    const totalDuration = CC_CONFIG.CYCLE_MS * CC_CONFIG.ROTATION.length;
    while (diff < 0) diff += totalDuration;
    const totalSlots = Math.floor(diff / CC_CONFIG.CYCLE_MS);
    return CC_CONFIG.ROTATION[totalSlots % CC_CONFIG.ROTATION.length];
  },

  calculateBackoff: function(statsData, wIdx, t, sKey) {
    const matches = statsData.matches || [];
    const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const targetW = WD[wIdx]; 
    const targetS_EN = sKey;
    const targetS_JP = this.STAGE_INFO[sKey] ? this.STAGE_INFO[sKey].jp : sKey;

    const getSlot = (timeStr) => {
      if (!timeStr) return "";
      const [h, m] = timeStr.split(":").map(Number);
      const val = h * 60 + m; 
      if (val >= 21 * 60 && val < 22 * 60 + 30) return "21:00";
      if (val >= 22 * 60 + 30 && val < 24 * 60) return "22:30"; 
      if (val >= 0 && val < 1 * 60 + 30) return "00:00";
      if (val >= 1 * 60 + 30 && val < 3 * 60) return "01:30";
      return "";
    };

    const getMatchWDay = (m) => {
      if (!m.date || !m.time) return "";
      const parts = m.date.split("-");
      const y = parseInt(parts[0], 10);
      const mon = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(y, mon, day);
      const h = parseInt(m.time.split(":")[0], 10);
      if (h < 5) d.setDate(d.getDate() - 1);
      return WD[d.getDay()];
    };

    const isStageMatch = (m) => {
      const st = m.stage || m.Stage;
      if (!st) return false;
      return st === targetS_EN || st === targetS_JP;
    };

    const levels = [
      { lv: 0, f: m => getMatchWDay(m) === targetW && getSlot(m.time) === t && isStageMatch(m) },
      { lv: 1, f: m => getSlot(m.time) === t && isStageMatch(m) },
      { lv: 2, f: m => getMatchWDay(m) === targetW && isStageMatch(m) },
      { lv: 3, f: m => isStageMatch(m) },
      { lv: 4, f: m => getSlot(m.time) === t },
      { lv: 5, f: m => getMatchWDay(m) === targetW },
      // ★修正：Level 6 (全体データ) を削除
      // ここを削除することで、特定の条件に合致するデータがない場合は
      // 素直に「データなし(Debut)」として扱われるようになる。
    ];

    for (let layer of levels) {
      const filtered = matches.filter(layer.f);
      if (filtered.length > 0) {
        const wins = filtered.filter(m => /win|勝利/i.test(m.result) || Number(m.result) > 0).length;
        const total = filtered.length;
        
        const jobMap = {};
        filtered.forEach(m => {
          const j = m.job || m.Job; 
          if (!j) return;
          if (!jobMap[j]) jobMap[j] = { w: 0, t: 0 };
          jobMap[j].t++;
          if (/win|勝利/i.test(m.result) || Number(m.result) > 0) jobMap[j].w++;
        });

        const jobRates = {};
        const jobScores = Object.keys(jobMap).map(j => {
          const p = jobMap[j].w / jobMap[j].t;
          jobRates[j] = p;
          return { job: j, p, score: 2 * p - 1, n: jobMap[j].t };
        });

        const topJobs = jobScores
          .filter(j => j.p > 0.5)
          .sort((a, b) => b.score - a.score || b.p - a.p || b.n - a.n)
          .slice(0, 3)
          .map(j => j.job);

        return { p: wins / total, total, level: layer.lv, topJobs, jobRates };
      }
    }
    
    return { p: 0, total: 0, level: 6, topJobs: [], jobRates: {} };
  }
};
