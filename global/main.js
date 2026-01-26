// ★ご自身のGASのURLであることを確認してください
const API_URL = "https://script.google.com/macros/s/AKfycbxCOYEGborjJzpnyd1lG5_MeX3BDmQvjLC-NqN8MpKnr6YRBgcfz962kRFJsiFkb7RXdg/exec";

// --- グローバル変数 ---
let globalData = null;

// テーブル用設定
let currentTableViewMode = "ALL";
let currentTableSortKey = "job"; // 初期はジョブ順にしておきます
let currentTableSortDesc = false; // 初期は「上から順（昇順）」

// ダメージグラフ用設定
let currentDamageViewMode = "ALL";


// ★ジョブの設定（並び順・ロール色・日本語名）
// キーは英語名（データに合わせています）
const JOB_META = {
  // --- TANK (Pastel Blue) ---
  "Paladin":      { order: 1,  role: "tank", jp: "ナイト" },
  "Warrior":      { order: 2,  role: "tank", jp: "戦士" },
  "Dark Knight":  { order: 3,  role: "tank", jp: "暗黒騎士" },
  "Gunbreaker":   { order: 4,  role: "tank", jp: "ガンブレイカー" },
  // --- HEALER (Pastel Green) ---
  "White Mage":   { order: 5,  role: "healer", jp: "白魔道士" },
  "Scholar":      { order: 6,  role: "healer", jp: "学者" },
  "Astrologian":  { order: 7,  role: "healer", jp: "占星術師" },
  "Sage":         { order: 8,  role: "healer", jp: "賢者" },
  // --- DPS (Pastel Pink) ---
  "Monk":         { order: 9,  role: "dps", jp: "モンク" },
  "Dragoon":      { order: 10, role: "dps", jp: "竜騎士" },
  "Ninja":        { order: 11, role: "dps", jp: "忍者" },
  "Samurai":      { order: 12, role: "dps", jp: "侍" },
  "Reaper":       { order: 13, role: "dps", jp: "リーパー" },
  "Viper":        { order: 14, role: "dps", jp: "ヴァイパー" },
  "Bard":         { order: 15, role: "dps", jp: "吟遊詩人" },
  "Machinist":    { order: 16, role: "dps", jp: "機工士" },
  "Dancer":       { order: 17, role: "dps", jp: "踊り子" },
  "Black Mage":   { order: 18, role: "dps", jp: "黒魔道士" },
  "Summoner":     { order: 19, role: "dps", jp: "召喚士" },
  "Red Mage":     { order: 20, role: "dps", jp: "赤魔道士" },
  "Pictomancer":  { order: 21, role: "dps", jp: "ピクトマンサー" }
};

// ロールごとの背景色
const ROLE_COLORS = {
  tank:   "#E3F2FD", // パステルブルー
  healer: "#E8F5E9", // パステルグリーン
  dps:    "#FCE4EC", // パステルピンク
  unknown:"#F5F5F5"  // その他（グレー）
};


// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();

  // テーブル切り替えボタン
  const tableRadios = document.querySelectorAll('input[name="viewMode"]');
  tableRadios.forEach(r => {
    r.addEventListener("change", (e) => {
      currentTableViewMode = e.target.value;
      refreshTableOnly();
    });
  });

  // グラフ切り替えボタン
  const dmgRadios = document.querySelectorAll('input[name="damageViewMode"]');
  dmgRadios.forEach(r => {
    r.addEventListener("change", (e) => {
      currentDamageViewMode = e.target.value;
      refreshDamageChartOnly();
    });
  });

  // モーダル閉じる
  const modal = document.getElementById("job-detail-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "job-detail-modal") closeModal();
    });
  }
});

async function fetchGlobalData() {
  try {
    const res = await fetch(`${API_URL}?action=global`);
    const data = await res.json();
    globalData = data;

    initStageSelector(data.byStage);
    updateDashboard("ALL");
    renderHourChart(data.byHour);

  } catch (err) {
    console.error("データ取得エラー:", err);
    alert("データの読み込みに失敗しました");
  }
}

function initStageSelector(stages) {
  const sel = document.getElementById("stage-selector");
  if (!sel) return;
  stages.sort((a, b) => a.stage.localeCompare(b.stage));
  stages.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.stage;
    opt.textContent = `${s.stage} (${Math.floor(s.total/10)}試合)`;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", (e) => updateDashboard(e.target.value));
}

function getCurrentStageData() {
  const sel = document.getElementById("stage-selector");
  const stageName = sel ? sel.value : "ALL";
  
  if (stageName === "ALL") {
    return { data: globalData.byJob, total: globalData.meta.total };
  } else {
    const stageInfo = globalData.byStage.find(s => s.stage === stageName);
    return {
      data: globalData.byStageJob.filter(d => d.stage === stageName),
      total: stageInfo ? stageInfo.total : 0
    };
  }
}

function updateDashboard(stageName) {
  const { data, total } = getCurrentStageData();
  const displayCount = Math.floor(total / 10);
  const totalEl = document.getElementById("total-matches");
  if (totalEl) totalEl.textContent = `${displayCount} 試合`;

  renderJobPieChart(data);
  renderWinRateChart(data);
  renderDamageChart(data); 
  renderJobTable(data, total);
}

function refreshTableOnly() {
  const { data, total } = getCurrentStageData();
  renderJobTable(data, total);
}

function refreshDamageChartOnly() {
  const { data } = getCurrentStageData();
  renderDamageChart(data);
}


// --- グラフ描画 ---

function renderJobPieChart(jobData) {
  resetCanvas("jobPieChart");
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  const topList = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.total, 0);
  
  const getJpName = (key) => JOB_META[key]?.jp || key; // 辞書から名前取得

  const labels = topList.map(d => getJpName(d.job));
  const values = topList.map(d => Math.floor(d.total / 10));
  
  if (otherTotal > 0) {
    labels.push("その他");
    values.push(Math.floor(otherTotal / 10));
  }

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#63b3ed', '#4fd1c5', '#f6e05e', '#f687b3', 
          '#9f7aea', '#ed8936', '#a0aec0', '#48bb78', '#cbd5e0'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });
}

function renderWinRateChart(jobData) {
  resetCanvas("jobWinRateChart");
  const ctx = document.getElementById("jobWinRateChart").getContext("2d");

  const filtered = jobData
    .filter(d => d.total >= 1)
    .sort((a, b) => (b.wins / b.total) - (a.wins / a.total));

  const getJpName = (key) => JOB_META[key]?.jp || key;
  const labels = filtered.map(d => getJpName(d.job));
  const rates = filtered.map(d => ((d.wins / d.total) * 100).toFixed(1));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '勝率 (%)',
        data: rates,
        backgroundColor: rates.map(r => r >= 50 ? '#68d391' : '#fc8181'),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, max: 100 } }
    }
  });
}

function renderHourChart(hourData) {
  resetCanvas("hourChart");
  const ctx = document.getElementById("hourChart").getContext("2d");
  
  const hours = Array.from({length: 24}, (_, i) => i);
  const counts = hours.map(h => {
    const found = hourData.find(d => Number(d.hour) === h);
    return found ? Math.floor(found.total / 10) : 0;
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.map(h => `${h}時`),
      datasets: [{
        label: '観測された試合数',
        data: counts,
        backgroundColor: '#90cdf4',
        borderRadius: 4
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderDamageChart(jobData) {
  resetCanvas("damageChart");
  const ctx = document.getElementById("damageChart").getContext("2d");

  const getKey = () => {
    if (currentDamageViewMode === "WIN") return "w_avgDamage";
    if (currentDamageViewMode === "LOSE") return "l_avgDamage";
    return "avgDamage";
  };
  
  const getVal = (d) => {
    const key = getKey();
    if (typeof d[key] === "number") return d[key];
    if (key === "avgDamage") return d.total ? (Number(d.sumDamage)||0)/d.total : 0;
    return 0; 
  };

  const filtered = jobData
    .filter(d => d.total >= 1)
    .map(d => ({ ...d, _val: getVal(d) }))
    .sort((a, b) => b._val - a._val);

  const getJpName = (key) => JOB_META[key]?.jp || key;
  const labels = filtered.map(d => getJpName(d.job));
  const data = filtered.map(d => Math.round(d._val));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: `平均与ダメージ (${currentDamageViewMode === "ALL" ? "全体" : currentDamageViewMode === "WIN" ? "勝ち" : "負け"})`,
        data: data,
        backgroundColor: '#f6ad55',
        borderRadius: 4
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// --- テーブル描画（デザイン＆ソート強化版） ---
function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  if (!tbody) return;

  let list = jobData.map(d => {
    const p = (key) => {
      if (currentTableViewMode === "WIN") return d["w_" + key] || 0;
      if (currentTableViewMode === "LOSE") return d["l_" + key] || 0;
      return d[key] || 0; 
    };

    // 辞書から名前や順序を取得
    const meta = JOB_META[d.job] || {}; 
    const jpName = meta.jp || d.job;
    const sortOrder = meta.order || 999; // 未定義は後ろへ
    const role = meta.role || "unknown";

    return {
      name: jpName,
      jobKey: d.job,
      sortOrder: sortOrder, // ソート用
      role: role,           // 色付け用
      
      winRate: (d.wins / d.total) * 100,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      
      avgK: p("avgK"),
      avgD: p("avgD"),
      avgA: p("avgA"),
      avgDmg: p("avgDamage"),
      avgTaken: p("avgTaken"),
      avgHeal: p("avgHeal"),
      avgTime: p("avgTime"),

      raw: d
    };
  });

  // ★ソート処理
  list.sort((a, b) => {
    // ジョブ順のときだけ特殊処理（指定された順番を使う）
    if (currentTableSortKey === "job") {
      const valA = a.sortOrder;
      const valB = b.sortOrder;
      return currentTableSortDesc ? (valB - valA) : (valA - valB);
    }

    // それ以外（勝率やダメージなど）
    const valA = a[currentTableSortKey];
    const valB = b[currentTableSortKey];
    return currentTableSortDesc ? (valB - valA) : (valA - valB);
  });

  tbody.innerHTML = "";
  list.forEach(d => {
    const tr = document.createElement("tr");
    const winClass = d.winRate >= 50 ? "rate-high" : "rate-low";
    const fmt = (n) => Math.round(n).toLocaleString();
    const fmtTime = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ★ロールごとの背景色を取得
    const badgeColor = ROLE_COLORS[d.role] || "#eee";

    tr.innerHTML = `
      <td style="text-align:left;">
        <span class="clickable-job" 
              onclick="openModal('${d.jobKey}')"
              style="
                background-color: ${badgeColor};
                padding: 6px 14px;
                border-radius: 20px;
                display: inline-block;
                color: #546E7A;
                font-weight: bold;
                text-decoration: none;
                transition: transform 0.1s;
              "
              onmouseover="this.style.transform='scale(1.05)'" 
              onmouseout="this.style.transform='scale(1)'">
          ${d.name}
        </span>
      </td>
      <td class="${winClass}">${d.winRate.toFixed(1)}%</td>
      <td>${d.pickRate.toFixed(1)}%</td>
      <td>${d.avgK.toFixed(2)}</td>
      <td>${d.avgD.toFixed(2)}</td>
      <td>${d.avgA.toFixed(2)}</td>
      <td style="font-weight:bold; color:#d69e2e;">${fmt(d.avgDmg)}</td>
      <td style="font-weight:bold; color:#e53e3e;">${fmt(d.avgTaken)}</td>
      <td style="font-weight:bold; color:#38a169;">${fmt(d.avgHeal)}</td>
      <td style="font-weight:bold; color:#718096;">${fmtTime(d.avgTime)}</td>
    `;
    tbody.appendChild(tr);
  });
  
  // ヘッダーのソート機能
  ths.forEach(th => {
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
    
    // ソート中の列に色をつける
    if (newTh.dataset.key === currentTableSortKey) {
      newTh.style.backgroundColor = "#B3E5FC"; 
    } else {
      newTh.style.backgroundColor = ""; // リセット
    }

    newTh.addEventListener("click", () => {
      const key = newTh.dataset.key;
      if (!key) return;

      if (currentTableSortKey === key) {
        currentTableSortDesc = !currentTableSortDesc;
      } else {
        currentTableSortKey = key;
        // ジョブ名以外の数値データは、基本「大きい順（降順）」が見やすい
        // ジョブ名は「指定順（昇順）」が見やすい
        currentTableSortDesc = (key !== "job");
      }
      refreshTableOnly();
    });
  });
}


// --- モーダル ---

function openModal(jobKey) {
  const { data } = getCurrentStageData();
  const d = data.find(j => j.job === jobKey);
  if (!d) return;

  const jpName = JOB_META[d.job]?.jp || d.job;
  const nameEl = document.getElementById("modal-job-name");
  if (nameEl) nameEl.textContent = jpName + " の平均詳細データ";

  const fmt = (n) => Math.round(n).toLocaleString();
  const fmt2 = (n) => n.toFixed(2);
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const makeRow = (label, cls, prefix) => {
    const p = (key) => d[prefix + key] || d[key] || 0; 
    
    if (label === "勝利" && d.wins === 0) return `<tr class="${cls}"><td>${label}</td><td colspan="7">データなし</td></tr>`;
    if (label === "敗北" && d.losses === 0) return `<tr class="${cls}"><td>${label}</td><td colspan="7">データなし</td></tr>`;

    return `
      <tr class="${cls}">
        <td>${label === "全体" ? "" : label}</td>
        <td>${fmt2(p("avgK"))}</td>
        <td>${fmt2(p("avgD"))}</td>
        <td>${fmt2(p("avgA"))}</td>
        <td style="color:#d69e2e">${fmt(p("avgDamage"))}</td>
        <td style="color:#e53e3e">${fmt(p("avgTaken"))}</td>
        <td style="color:#38a169">${fmt(p("avgHeal"))}</td>
        <td style="color:#718096">${fmtTime(p("avgTime"))}</td>
      </tr>
    `;
  };

  const html = 
    makeRow("全体", "row-all", "") +
    makeRow("勝利", "row-win", "w_") +
    makeRow("敗北", "row-lose", "l_");

  const bodyEl = document.getElementById("modal-stats-body");
  if (bodyEl) bodyEl.innerHTML = html;

  const modal = document.getElementById("job-detail-modal");
  if (modal) modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("job-detail-modal");
  if (modal) modal.style.display = "none";
}

function resetCanvas(id) {
  const oldCanv = document.getElementById(id);
  if (!oldCanv) return;
  const container = oldCanv.parentElement;
  oldCanv.remove();
  const newCanv = document.createElement("canvas");
  newCanv.id = id;
  container.appendChild(newCanv);
}
