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

// tab-renderer.js の job 関数内の修正（後半部分）

      if (cardsHtml) {
        // ★ roleKey（TANK, HEALER等）を小文字にしてクラス名に追加
        const roleClass = `role-${roleKey.toLowerCase()}`; 

        html += `
          <details class="role-details ${roleClass}" open>
            <summary class="role-summary">${roleName}</summary>
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
    const map = statsData.byStage;
    if (!map) return "stage 集計なし";

    // 5試合以上でフィルタ
    const ranking = map
      .filter(row => (row.total ?? 0) >= 5)
      .slice()
      .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
      .slice(0, 6);

    const listHtml = ranking.map((row, i) =>
      `${i + 1}位：${row.stage}（${((row.winRate ?? 0) * 100).toFixed(1)}% / ${row.total}試合）`
    ).join("<br>");

    return `
      <div class="stat-card">
        <p class="stat-title">ステージ勝率ランキング</p>
        <p class="stat-body">${listHtml}</p>
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
    // 曜日の配列（タグ生成用）
    const days = ["All", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    // 曜日タグのHTML
    const tagsHtml = days.map((day, i) => `
      <span class="day-tag" data-day-index="${i === 0 ? 'all' : i - 1}">${day}</span>
    `).join("");

    return `
      <div class="stat-card">
        <p class="stat-title">時間帯別勝率（累計）</p>
        <div class="time-chart-container">
          <canvas id="timeWinRateChart"></canvas>
        </div>
      </div>
      
      <div class="day-filter-container">
        <p class="stat-sub-title">曜日別フィルタ</p>
        <div class="day-tags">
          ${tagsHtml}
        </div>
      </div>

      <div id="timeDetailArea">
        </div>
    `;
  }
  
};
