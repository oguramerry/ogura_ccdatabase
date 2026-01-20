// tab-renderer.js
// タブごとの表示内容を作る「描画担当」

window.TabRenderer = {
  
  // ■ Mainタブ: サマリ
  main: (statsData) => {
    const m = statsData.meta || {};
    const winRateText = m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-";
    
    // ここに将来、KDAや最大連勝数などを追加できます
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


  // ■ Jobタブ: ロール別折りたたみ表示
  job: (statsData) => {
    const map = statsData.byJob;
    if (!map) return "job 集計なし";

    // データを探しやすいように { "PLD": {winRate:..., total:...}, ... } の形に変換
    const jobStats = {};
    map.forEach(row => {
      jobStats[row.job] = row;
    });

    let html = "";

    // 定義したロール順(TANK, HEALER...)にループ
    // ※JOB_ROLESはui-parts.jsで定義済み
    Object.keys(JOB_ROLES).forEach(roleKey => {
      const jobsInRole = JOB_ROLES[roleKey];
      const roleName = ROLE_NAME_JP[roleKey];

      // このロールに含まれるジョブのカードHTMLを作る
      let cardsHtml = "";
      
      jobsInRole.forEach(job => {
        const data = jobStats[job];
        // データがないジョブも表示するなら if (data) のチェックを外す
        // 今回は「データがある場合のみ」表示
        if (data && data.total > 0) {
          const jobName = JOB_NAME_JP[job] ?? job;
          const winRate = ((data.winRate ?? 0) * 100).toFixed(1);
          
          
          // 例: imgフォルダにある場合 -> src="img/${job}.png"
          const iconPath = `images/JOB/${job}.png`; 

          cardsHtml += `
            <div class="job-card-item">
              <img src="${iconPath}" class="job-icon-img" alt="${job}" onerror="this.style.display='none'">
              <span class="job-name-label">${jobName}</span>
              <span class="job-stat-label">${winRate}% / ${data.total}試合</span>
            </div>
          `;
        }
      });

      // そのロールに1つでもデータがあれば、アコーディオンを追加
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

    if (!html) return "<div class='stat-card'><p class='stat-body'>データがありません</p></div>";

    return html;
  },

  // ■ Stageタブ
  stage: (statsData) => {
    const map = statsData.byStage;
    if (!map) return "stage 集計なし";

    const ranking = map
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
