// tab-renderer.js

window.TabRenderer = {
  
  // ■ Mainタブ
  main: (statsData) => {
    const m = statsData.meta || {};
    const winRateText = m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-";
    return `
      <div class="stat-card">
        <p class="stat-title">サマリ</p>
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

  // ■ Job × Stageタブ
  jobStage: (statsData) => {
    const arr = statsData.byStageJob;
    if (!arr || !arr.length) return "job*stage 集計なし";

    const ranking = arr
      .filter(row => (row.total ?? 0) >= 5)
      .slice()
      .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
      .slice(0, 10);

    const listHtml = ranking.map((row, i) => {
      const jobJp = JOB_NAME_JP[row.job] ?? row.job;
      const wr = ((row.winRate ?? 0) * 100).toFixed(1);
      return `${i + 1}位：${jobJp} × ${row.stage}（${wr}% / ${row.total}試合）`;
    }).join("<br>");

    return `
      <div class="stat-card">
        <p class="stat-title">ジョブ × ステージ top10（勝率）</p>
        <p class="stat-body">${listHtml}</p>
      </div>
    `;
  },

  // ■ Timeタブ
  time: (statsData) => {
    const arr = statsData.byHour;
    if (!arr || !arr.length) return "時間帯 集計なし";

    const ranking = arr
      .filter(row => (row.total ?? 0) >= 5)
      .slice()
      .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
      .slice(0, 5);

    const listHtml = ranking.map((row, i) => {
      const wr = ((row.winRate ?? 0) * 100).toFixed(1);
      return `${i + 1}位：${formatHourRange(row.hour)}（${wr}% / ${row.total}試合）`;
    }).join("<br>");

    return `
      <div class="stat-card">
        <p class="stat-title">時間帯 top5（勝率）</p>
        <p class="stat-body">${listHtml}</p>
      </div>
    `;
  }
};
