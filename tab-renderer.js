// tab-renderer.js

window.TabRenderer = {
  
// ■ Mainタブ（ここを修正！）
  main: (statsData) => {
    // 1. データの準備
    const matches = statsData.matches || []; // GASから受け取った全試合データ
    const m = statsData.meta || {};
    const winRateText = m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-";

    // 2. 日付の計算
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const dStr = String(now.getDate()).padStart(2, "0");
    const todayStr = `${y}-${mo}-${dStr}`; // YYYY-MM-DD

    // シーズン開始日
    const SEASON_START = "2025-12-16"; 

    // 今週の開始日（月曜始まり）
    const d = new Date(todayStr);
    const day = d.getDay(); // 0:Sun, 1:Mon...
    const diff = d.getDate() - (day === 0 ? 6 : day - 1); 
    const wStart = new Date(d.setDate(diff));
    const weekStartStr = `${wStart.getFullYear()}-${String(wStart.getMonth()+1).padStart(2,'0')}-${String(wStart.getDate()).padStart(2,'0')}`;

    // 3. フィルタリング
    const todayMatches = matches.filter(m => m.date === todayStr);
    const weekMatches = matches.filter(m => m.date >= weekStartStr && m.date <= todayStr);
    const seasonMatches = matches.filter(m => m.date >= SEASON_START);

    // 4. 集計関数
    const calc = (list) => {
      const wins = list.filter(m => String(m.result).toLowerCase() === "win" || m.result === "勝利" || Number(m.result) > 0).length;
      const losses = list.filter(m => String(m.result).toLowerCase() === "lose" || m.result === "敗北" || Number(m.result) < 0).length;
      const total = wins + losses;
      const rate = total > 0 ? ((wins / total) * 100).toFixed(1) : "-";
      return { wins, losses, rate };
    };

    const tStat = calc(todayMatches);
    const wStat = calc(weekMatches);
    const sStat = calc(seasonMatches);

    // 5. HTMLを組み立てて返す
    return `
      <div class="summary-cards">
        <div class="summary-card">
          <div class="title">今日の成績</div>
          <div class="score">${tStat.wins}勝 ${tStat.losses}敗</div>
          <div class="rate">勝率: ${tStat.rate}%</div>
        </div>
        <div class="summary-card">
          <div class="title">今週の成績</div>
          <div class="score">${wStat.wins}勝 ${wStat.losses}敗</div>
          <div class="rate">勝率: ${wStat.rate}%</div>
        </div>
        <div class="summary-card">
          <div class="title">シーズン成績</div>
          <div class="score">${sStat.wins}勝 ${sStat.losses}敗</div>
          <div class="rate">勝率: ${sStat.rate}%</div>
        </div>
      </div>

      <div class="stat-card">
        <p class="stat-title">全期間サマリ</p>
        <p class="stat-body">
          試合数 ${m.total ?? "-"}<br>
          勝率 ${winRateText}
        </p>
      </div>
    `;
  },

// ■ Jobタブ: ロール別表示（全ジョブ表示版）
  job: (statsData) => {
    const map = statsData.byJob;
    if (!map) return "job 集計なし";

    const jobStats = {};
    map.forEach(row => {
      jobStats[row.job] = row;
    });

    let html = "";

    Object.keys(JOB_ROLES).forEach(roleKey => {
      const jobsInRole = JOB_ROLES[roleKey];
      const roleName = ROLE_NAME_JP[roleKey];
      const roleClass = "role-" + roleKey.toLowerCase();

      let cardsHtml = "";
      
      jobsInRole.forEach(job => {
        const data = jobStats[job] || { total: 0, winRate: 0 };
        const jobName = JOB_NAME_JP[job] ?? job;
        const winRate = ((data.winRate ?? 0) * 100).toFixed(1);
        const iconPath = `images/JOB/${job}.png`; 
        const emptyClass = data.total === 0 ? "job-card-empty" : "";

        let winRateClass = "";
        let winRateBgClass = "";
        
        if (data.total > 0) { // 試合がある場合のみ判定
          if (data.winRate > 0.5) {
            winRateClass = "text-win-color";  // 50%より大きい
            winRateBgClass = "bg-win-color";
          } else if (data.winRate < 0.5) {
            winRateClass = "text-loss-color"; // 50%より小さい
            winRateBgClass = "bg-loss-color";
          }
        }

cardsHtml += `
    <div class="job-card-item ${emptyClass} ${winRateBgClass}">
      <img src="${iconPath}" class="job-icon-img" alt="${job}" onerror="this.style.display='none'">
      <div class="job-text-meta">
        <span class="job-name-label">${jobName}</span>
        <span class="job-stat-label ${winRateClass}">${winRate}% / ${data.total}試合</span>
      </div>
    </div>
  `;
});

      if (cardsHtml) {
        html += `
          <details class="role-details" open>
            <summary class="role-summary ${roleClass}">${roleName}</summary>
            <div class="job-grid-container">
              ${cardsHtml}
            </div>
          </details>
        `;
      }
    });

    return html || "<div class='stat-card'><p class='stat-body'>表示可能なジョブがありません</p></div>";
  },

// ■ Stageタブ
stage: (statsData) => {
  const STAGE_ORDER = ["Palaistra", "Volcanic Heart", "Clockwork Castletown", "Bayside Battleground", "Cloud Nine", "Red Sands"];
  const STAGE_NAME_MAP = {
    "Palaistra": "パライストラ", "Volcanic Heart": "ヴォルカニック・ハート", "Clockwork Castletown": "東方絡繰御殿",
    "Bayside Battleground": "ベイサイド・バトルグラウンド", "Cloud Nine": "クラウドナイン", "Red Sands": "レッド・サンズ"
  };

  let html = "";
  const mapStats = statsData.byStage || [];

  STAGE_ORDER.forEach(engKey => {
    const jpName = STAGE_NAME_MAP[engKey];
    const row = mapStats.find(r => r.stage === jpName) || { total: 0, winRate: 0 };
    const winRate = row.total > 0 ? (row.winRate * 100).toFixed(1) : "-";
    
    // 勝率による背景色のクラス
    let colorClass = "";
    if (row.total > 0) {
      colorClass = row.winRate > 0.5 ? "bg-win-color" : (row.winRate < 0.5 ? "bg-loss-color" : "");
    }
    
    const safeId = engKey.replace(/\s+/g, "");

    html += `
      <div id="stage-card-${safeId}" class="stage-card-item ${colorClass}">
        <div class="stage-info">
          <div class="stage-name-row">
            <span class="stage-name-text">${jpName}</span>
            <span class="stage-next-start"></span> </div>
          <span class="stage-stat-text">${winRate}% / ${row.total}試合</span>
        </div>
        <div class="stage-badge-area"></div>
      </div>
    `;
  });

  return `
    <div class="stat-card">
      <p class="stat-title">ステージリスト</p>
      <div class="stage-grid-container">${html}</div>
    </div>
  `;
},
// ■ Job × Stageタブ（リボン切り替え版）
jobStage: (statsData) => {
  const STAGES = ["Palaistra", "Volcanic Heart", "Clockwork Castletown", "Bayside Battleground", "Cloud Nine", "Red Sands"];
  
  // ★ ui-parts.js の STAGE_NAME_JP を使うように統一
  let ribbonHtml = STAGES.map(key => {
    const safeId = key.replace(/\s+/g, ""); 
    return `<button class="stage-ribbon-btn btn-${safeId}" data-stage-jp="${STAGE_NAME_JP[key]}">${STAGE_NAME_JP[key]}</button>`;
  }).join("");

  return `
    <div class="stat-card">
      <p class="stat-title">ステージ別詳細</p>
      <div class="stage-selector-ribbon">${ribbonHtml}</div>
      <div id="job-stage-detail-container"></div>
    </div>
  `;
},

// ★ ジョブグリッドを生成するヘルパー（Jobタブのロジックを再利用）
renderJobStageGrid: (stageJpName, statsData) => {
  const allData = statsData.byStageJob || [];
  const stageData = allData.filter(r => r.stage === stageJpName);

  let html = "";
  Object.keys(JOB_ROLES).forEach(roleKey => {
    const jobsInRole = JOB_ROLES[roleKey];
    const roleName = ROLE_NAME_JP[roleKey];
    let cardsHtml = "";

    jobsInRole.forEach(job => {
      const data = stageData.find(r => r.job === job) || { total: 0, winRate: 0 };
      const jobName = JOB_NAME_JP[job] ?? job;
      const winRate = ((data.winRate ?? 0) * 100).toFixed(1);
      const iconPath = `images/JOB/${job}.png`;
      const emptyClass = data.total === 0 ? "job-card-empty" : "";

      let winRateClass = "";
      let winRateBgClass = "";
      if (data.total > 0) {
        if (data.winRate > 0.5) { winRateClass = "text-win-color"; winRateBgClass = "bg-win-color"; }
        else if (data.winRate < 0.5) { winRateClass = "text-loss-color"; winRateBgClass = "bg-loss-color"; }
      }

      cardsHtml += `
        <div class="job-card-item ${emptyClass} ${winRateBgClass}">
          <img src="${iconPath}" class="job-icon-img" alt="${job}" onerror="this.style.display='none'">
          <div class="job-text-meta">
            <span class="job-name-label">${jobName}</span>
            <span class="job-stat-label ${winRateClass}">${winRate}% / ${data.total}試合</span>
          </div>
        </div>
      `;
    });

    html += `
      <p class="stat-title" style="margin-top:12px; font-size:11px;">${roleName}</p>
      <div class="job-grid-container" style="padding:4px;">
        ${cardsHtml}
      </div>
    `;
  });
  return html;
},

  // ■ Timeタブ
time: (statsData) => {
  const arr = statsData.byHour;
  if (!arr || !arr.length) {
    return "時間帯 集計なし";
  }

  return `
    <div class="stat-card">
      <div class="time-filter">
        <button data-wd="all" class="active">all</button>
        <button data-wd="sun">sun</button>
        <button data-wd="mon">mon</button>
        <button data-wd="tue">tue</button>
        <button data-wd="wed">wed</button>
        <button data-wd="thu">thu</button>
        <button data-wd="fri">fri</button>
        <button data-wd="sat">sat</button>
      </div>
      <canvas id="time-chart"></canvas>
    </div>
  `;
}


  
};
