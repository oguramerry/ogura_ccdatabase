/**
 * ランクマ天気予報の描画
 */
function renderWeatherForecast(statsData) {
  const container = document.getElementById("forecastWrapper");
  if (!container || !statsData) return;

  const STAGE_ABBR = {
    "Palaistra": "パラ",
    "Volcanic Heart": "VH",
    "Clockwork Castletown": "からくり",
    "Bayside Battleground": "BB",
    "Cloud Nine": "C9",
    "Red Sands": "サンズ"
  };

  const SLOTS = ["21:00", "22:30", "00:00", "01:30"];
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  
  // 1. 本日から1週間分の日付リストを作成
  const today = new Date();
  if (today.getHours() < 5) today.setDate(today.getDate() - 1); // 5時前なら前日扱い

  let tableHtml = `<table class="forecast-table"><thead><tr><th></th>`;
  
  const targetDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    targetDates.push(d);
    tableHtml += `<th class="forecast-th">${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})</th>`;
  }
  tableHtml += `</tr></thead><tbody>`;

  // 2. 各時間枠の行を生成
  SLOTS.forEach(slot => {
    tableHtml += `<tr><td class="forecast-time-label">${slot}</td>`;
    
    targetDates.forEach(date => {
      // その日時のマップを計算
      const dateTimeStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${slot}`;
      const targetTimeMs = new Date(dateTimeStr).getTime();
      const stageKey = getStageAtTime(targetTimeMs);
      const stageClass = stageKey.replace(/\s+/g, "");
      const stageAbbr = STAGE_ABBR[stageKey] || stageKey;

      // バックオフで勝率データを取得
      const forecast = calculateBackoff(statsData, date.getDay(), slot, stageKey);

      // 表示内容の判定
      let content = "";
      let meta = `l${forecast.level} n=${forecast.total}`;
      
      if (forecast.total === 0) {
        content = `<span class="status-text status-debut">デビュー</span>`;
      } else if (forecast.p > 0.5) {
        const icons = forecast.topJobs.map(job => 
          `<img src="../images/JOB/${job}.png" class="forecast-job-icon" title="${job} (勝率${(forecast.jobRates[job]*100).toFixed(1)}%)">`
        ).join("");
        content = `<div class="forecast-content">${icons}</div>`;
      } else if (forecast.p > 0.45) {
        content = `<span class="status-text status-pupi">プピ</span>`;
      } else if (forecast.p > 0.40) {
        content = `<span class="status-text status-pupi">激プピ</span>`;
      } else {
        content = `<span class="status-text status-retirement">引退</span>`;
      }

      tableHtml += `
        <td class="forecast-cell st-bar-${stageClass}">
          <span class="st-abbr">${stageAbbr}</span>
          <div class="forecast-content">${content}</div>
          <span class="forecast-meta">${meta}</span>
        </td>`;
    });
    tableHtml += `</tr>`;
  });

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
}

/**
 * 特定時刻のステージを CC_CONFIG から算出
 */
function getStageAtTime(timeMs) {
  let diff = timeMs - CC_CONFIG.ANCHOR_EPOCH;
  const totalDuration = CC_CONFIG.CYCLE_MS * CC_CONFIG.ROTATION.length;
  while (diff < 0) diff += totalDuration;
  const totalSlots = Math.floor(diff / CC_CONFIG.CYCLE_MS);
  return CC_CONFIG.ROTATION[totalSlots % CC_CONFIG.ROTATION.length];
}

/**
 * バックオフによる勝率算出エンジン
 */
function calculateBackoff(statsData, w, t, s) {
  const matches = statsData.matches || [];
  const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const targetW = WD[w];

  // 試合データを前処理（5時ルール適用済みの想定）
  const getSlot = (timeStr) => {
    if (!timeStr) return "";
    const h = parseInt(timeStr.split(":")[0], 10);
    const m = parseInt(timeStr.split(":")[1], 10);
    const val = h * 60 + m;
    if (val >= 21 * 60 && val < 22 * 60 + 30) return "21:00";
    if (val >= 22 * 60 + 30 || val < 0) return "22:30"; // 0時跨ぎ考慮
    if (val >= 0 && val < 1 * 60 + 30) return "00:00";
    if (val >= 1 * 60 + 30 && val < 3 * 60) return "01:30";
    return "";
  };

  const levels = [
    { name: 0, filter: m => getWeekday(m) === targetW && getSlot(m.time) === t && m.stage === STAGE_NAME_JP[s] },
    { name: 1, filter: m => getSlot(m.time) === t && m.stage === STAGE_NAME_JP[s] },
    { name: 2, filter: m => getWeekday(m) === targetW && m.stage === STAGE_NAME_JP[s] },
    { name: 3, filter: m => m.stage === STAGE_NAME_JP[s] },
    { name: 4, filter: m => getSlot(m.time) === t },
    { name: 5, filter: m => getWeekday(m) === targetW },
    { name: 6, filter: m => true }
  ];

  for (let lv of levels) {
    const filtered = matches.filter(lv.filter);
    if (filtered.length > 0) {
      const wins = filtered.filter(m => /win|勝利/i.test(m.result) || Number(m.result) > 0).length;
      const total = filtered.length;
      
      // ジョブ別集計
      const jobCounts = {};
      filtered.forEach(m => {
        const j = m.job || m.Job;
        if (!jobCounts[j]) jobCounts[j] = { w: 0, t: 0 };
        jobCounts[j].t++;
        if (/win|勝利/i.test(m.result) || Number(m.result) > 0) jobCounts[j].w++;
      });

      const jobRates = {};
      const jobScores = Object.keys(jobCounts).map(j => {
        const p = jobCounts[j].w / jobCounts[j].t;
        jobRates[j] = p;
        return { job: j, p, score: 2 * p - 1, total: jobCounts[j].t };
      });

      const topJobs = jobScores
        .filter(j => j.p > 0.5)
        .sort((a, b) => b.score - a.score || b.p - a.p || b.total - a.total)
        .slice(0, 3)
        .map(j => j.job);

      return { p: wins / total, total, level: lv.name, topJobs, jobRates };
    }
  }
  return { p: 0, total: 0, level: 6, topJobs: [], jobRates: {} };
}

// 曜日の取得ヘルパー（5時ルール）
function getWeekday(match) {
  const d = new Date(match.date);
  const h = parseInt(match.time.split(":")[0], 10);
  if (h < 5) d.setDate(d.getDate() - 1);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
}
