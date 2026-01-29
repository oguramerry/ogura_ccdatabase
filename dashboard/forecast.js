// forecast.js

const WeatherForecast = {
  // ステージ設定（略称とCSSクラス用のキー）
  STAGE_MAP: {
    "Palaistra": { abbr: "パラ", class: "Palaistra" },
    "Volcanic Heart": { abbr: "VH", class: "VolcanicHeart" },
    "Clockwork Castletown": { abbr: "からくり", class: "ClockworkCastletown" },
    "Bayside Battleground": { abbr: "BB", class: "BaysideBattleground" },
    "Cloud Nine": { abbr: "C9", class: "CloudNine" },
    "Red Sands": { abbr: "サンズ", class: "RedSands" }
  },

  // 描画のメイン関数
  render: function(statsData) {
    const wrapper = document.getElementById("forecastWrapper");
    if (!wrapper || !statsData) return;

    const SLOTS = ["21:00", "22:30", "00:00", "01:30"];
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    
    // 5時ルールに基づいた「今日」の基準日
    const today = new Date();
    if (today.getHours() < 5) today.setDate(today.getDate() - 1);

    let html = `<table class="forecast-table"><thead><tr><th></th>`;
    const targetDates = [];

    // ヘッダー（7日分の日付）
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      targetDates.push(new Date(d));
      html += `<th class="forecast-th">${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})</th>`;
    }
    html += `</tr></thead><tbody>`;

    // 行（時間スロット）の生成
    SLOTS.forEach(slot => {
      html += `<tr><td class="forecast-time-label">${slot}</td>`;
      
      targetDates.forEach(date => {
        // スロット開始日時のタイムスタンプ計算
        const [h, m] = slot.split(":").map(Number);
        const targetDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
        
        // ステージ計算
        const stageKey = this.getStageAtTime(targetDateTime.getTime());
        const stageInfo = this.STAGE_MAP[stageKey] || { abbr: stageKey, class: "unknown" };

        // バックオフ計算
        const res = this.calculateBackoff(statsData, date.getDay(), slot, stageKey);

        // 表示判定
        let content = "";
        if (res.total === 0) {
          content = `<span class="status-text status-debut">デビュー</span>`;
        } else if (res.p > 0.5) {
          const icons = res.topJobs.map(job => 
            `<img src="../images/JOB/${job}.png" class="forecast-job-icon" title="${job} (勝率${(res.jobRates[job]*100).toFixed(1)}%)">`
          ).join("");
          content = `<div class="forecast-content">${icons}</div>`;
        } else if (res.p > 0.45) {
          content = `<span class="status-text status-pupi">プピ</span>`;
        } else if (res.p > 0.40) {
          content = `<span class="status-text status-pupi">激プピ</span>`;
        } else {
          content = `<span class="status-text status-retirement">引退</span>`;
        }

        html += `
          <td class="forecast-cell st-bar-${stageInfo.class}">
            <span class="st-abbr">${stageInfo.abbr}</span>
            <div class="forecast-content">${content}</div>
            <span class="forecast-meta">l${res.level} n=${res.total}</span>
          </td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    wrapper.innerHTML = html;
  },

  // 90分サイクルに基づくステージ算出
  getStageAtTime: function(timeMs) {
    let diff = timeMs - CC_CONFIG.ANCHOR_EPOCH;
    const totalDuration = CC_CONFIG.CYCLE_MS * CC_CONFIG.ROTATION.length;
    while (diff < 0) diff += totalDuration;
    const totalSlots = Math.floor(diff / CC_CONFIG.CYCLE_MS);
    return CC_CONFIG.ROTATION[totalSlots % CC_CONFIG.ROTATION.length];
  },

  // バックオフ勝率計算エンジン
  calculateBackoff: function(statsData, wIdx, t, sKey) {
    const matches = statsData.matches || [];
    const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const targetW = WD[wIdx];
    const targetS = STAGE_NAME_JP[sKey];

    const getSlot = (timeStr) => {
      if (!timeStr) return "";
      const [h, m] = timeStr.split(":").map(Number);
      const val = h * 60 + m;
      if (val >= 21 * 60 && val < 22 * 60 + 30) return "21:00";
      if (val >= 22 * 60 + 30 || val < 24 * 60) return "22:30"; // 24時まで
      if (val >= 0 && val < 1 * 60 + 30) return "00:00";
      if (val >= 1 * 60 + 30 && val < 3 * 60) return "01:30";
      return "";
    };

    const getMatchWDay = (m) => {
      const d = new Date(m.date);
      const h = parseInt(m.time.split(":")[0], 10);
      if (h < 5) d.setDate(d.getDate() - 1);
      return WD[d.getDay()];
    };

    const levels = [
      { lv: 0, f: m => getMatchWDay(m) === targetW && getSlot(m.time) === t && m.stage === targetS },
      { lv: 1, f: m => getSlot(m.time) === t && m.stage === targetS },
      { lv: 2, f: m => getMatchWDay(m) === targetW && m.stage === targetS },
      { lv: 3, f: m => m.stage === targetS },
      { lv: 4, f: m => getSlot(m.time) === t },
      { lv: 5, f: m => getMatchWDay(m) === targetW },
      { lv: 6, f: m => true }
    ];

    for (let layer of levels) {
      const filtered = matches.filter(layer.f);
      if (filtered.length > 0) {
        const wins = filtered.filter(m => /win|勝利/i.test(m.result) || Number(m.result) > 0).length;
        const total = filtered.length;
        
        // ジョブ別集計
        const jobMap = {};
        filtered.forEach(m => {
          const j = m.job || m.Job;
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
