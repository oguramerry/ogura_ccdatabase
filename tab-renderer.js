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
        // データが存在しない場合は、初期値（0試合 / 0%）を使用する
        const data = jobStats[job] || { total: 0, winRate: 0 };
        
        const jobName = JOB_NAME_JP[job] ?? job;
        const winRate = ((data.winRate ?? 0) * 100).toFixed(1);
        const iconPath = `images/JOB/${job}.png`; 

        // 試合数が0のジョブを少し薄く表示したい場合は、クラスを追加して制御
        const emptyClass = data.total === 0 ? "job-card-empty" : "";


cardsHtml += `
  <div class="job-card-item ${emptyClass}">
    <img src="${iconPath}" class="job-icon-img" alt="${job}" onerror="this.style.display='none'">
    <div class="job-text-meta">
      <span class="job-name-label">${jobName}</span>
      <span class="job-stat-label">${winRate}% / ${data.total}試合</span>
    </div>
  </div>
`;
      });

      if (cardsHtml) {
        html += `
          <details class="role-details" open>
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
