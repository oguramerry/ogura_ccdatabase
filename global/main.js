
const API_URL = "https://script.google.com/macros/s/AKfycbxCOYEGborjJzpnyd1lG5_MeX3BDmQvjLC-NqN8MpKnr6YRBgcfz962kRFJsiFkb7RXdg/exec";

// --- グローバル変数 ---
let globalData = null;       // 全データ保存用

// テーブル用設定
let currentTableViewMode = "ALL"; // ALL, WIN, LOSE
let currentTableSortKey = "winRate"; // 初期ソートは勝率
let currentTableSortDesc = true;     // true:降順(大きい順), false:昇順

// ダメージグラフ用設定
let currentDamageViewMode = "ALL"; // ALL, WIN, LOSE


// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();

  // 1. テーブル用の切り替えボタン (viewMode)
  const tableRadios = document.querySelectorAll('input[name="viewMode"]');
  tableRadios.forEach(r => {
    r.addEventListener("change", (e) => {
      currentTableViewMode = e.target.value;
      // テーブルだけ再描画（現在のステージデータを使用）
      refreshTableOnly();
    });
  });

  // 2. ダメージグラフ用の切り替えボタン (damageViewMode) ★新規追加
  const dmgRadios = document.querySelectorAll('input[name="damageViewMode"]');
  dmgRadios.forEach(r => {
    r.addEventListener("change", (e) => {
      currentDamageViewMode = e.target.value;
      // グラフだけ再描画
      refreshDamageChartOnly();
    });
  });

  // モーダル閉じる処理
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

    // ステージ選択肢生成
    initStageSelector(data.byStage);

    // 初期描画（全部）
    updateDashboard("ALL");

    // 時間帯グラフ（全体固定）
    renderHourChart(data.byHour);

  } catch (err) {
    console.error("データ取得エラー:", err);
    alert("データの読み込みに失敗しました");
  }
}

// ▼ ステージ選択肢
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

// ▼ 現在のステージデータを取得するヘルパー
function getCurrentStageData() {
  const sel = document.getElementById("stage-selector");
  const stageName = sel ? sel.value : "ALL";
  
  if (stageName === "ALL") {
    return { 
      data: globalData.byJob, 
      total: globalData.meta.total 
    };
  } else {
    const stageInfo = globalData.byStage.find(s => s.stage === stageName);
    return {
      data: globalData.byStageJob.filter(d => d.stage === stageName),
      total: stageInfo ? stageInfo.total : 0
    };
  }
}

// ▼ 全体更新（ステージ変更時など）
function updateDashboard(stageName) {
  const { data, total } = getCurrentStageData();

  // 総観測数
  const displayCount = Math.floor(total / 10);
  const totalEl = document.getElementById("total-matches");
  if (totalEl) totalEl.textContent = `${displayCount} 試合`;

  // 各パーツ描画
  renderJobPieChart(data);
  renderWinRateChart(data);
  
  // ダメージグラフとテーブルは、それぞれの現在のモード設定を使って描画
  renderDamageChart(data); 
  renderJobTable(data, total);
}

// ▼ テーブルだけ更新（ボタン切り替え時）
function refreshTableOnly() {
  const { data, total } = getCurrentStageData();
  renderJobTable(data, total);
}

// ▼ ダメージグラフだけ更新（ボタン切り替え時）
function refreshDamageChartOnly() {
  const { data } = getCurrentStageData();
  renderDamageChart(data);
}


// --- グラフ描画関数 ---

function renderJobPieChart(jobData) {
  resetCanvas("jobPieChart");
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  const topList = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.total, 0);
  
  const labels = topList.map(d => JOB_NAME_JP[d.job] || d.job);
  const values = topList.map(d => Math.floor(d.total / 10)); // ÷10
  
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

  const labels = filtered.map(d => JOB_NAME_JP[d.job] || d.job);
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

// ★ダメージチャート（独立モード対応）
function renderDamageChart(jobData) {
  resetCanvas("damageChart");
  const ctx = document.getElementById("damageChart").getContext("2d");

  // 現在のグラフ用モード設定(currentDamageViewMode)を使用
  const getKey = () => {
    if (currentDamageViewMode === "WIN") return "w_avgDamage";
    if (currentDamageViewMode === "LOSE") return "l_avgDamage";
    return "avgDamage";
  };
  
  const getVal = (d) => {
    const key = getKey();
    if (typeof d[key] === "number") return d[key];
    // 全体のときだけ計算による補完
    if (key === "avgDamage") return d.total ? (Number(d.sumDamage)||0)/d.total : 0;
    return 0; 
  };

  const filtered = jobData
    .filter(d => d.total >= 1)
    .map(d => ({ ...d, _val: getVal(d) }))
    .sort((a, b) => b._val - a._val);

  const labels = filtered.map(d => JOB_NAME_JP[d.job] || d.job);
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

// --- テーブル描画（ソート維持・モーダル連携あり） ---
function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  if (!tbody) return;

  // データ整形
  let list = jobData.map(d => {
    // 現在のテーブル用モード設定(currentTableViewMode)を使用
    const p = (key) => {
      if (currentTableViewMode === "WIN") return d["w_" + key] || 0;
      if (currentTableViewMode === "LOSE") return d["l_" + key] || 0;
      return d[key] || 0; 
    };

    return {
      name: JOB_NAME_JP[d.job] || d.job,
      jobKey: d.job,
      winRate: (d.wins / d.total) * 100,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      
      avgK: p("avgK"),
      avgD: p("avgD"),
      avgA: p("avgA"),
      avgDmg: p("avgDamage"),
      avgTaken: p("avgTaken"),
      avgHeal: p("avgHeal"),
      avgTime: p("avgTime"), // 時間

      raw: d
    };
  });

  // ★ソート処理（グローバル変数 currentTableSortKey を使う！）
  list.sort((a, b) => {
    const valA = a[currentTableSortKey];
    const valB = b[currentTableSortKey];

    // ジョブ名は文字列比較
    if (currentTableSortKey === "job") {
      const cmp = a.name.localeCompare(b.name);
      return currentTableSortDesc ? cmp * -1 : cmp; // 逆順対応
    }

    // 数値比較
    return currentTableSortDesc ? (valB - valA) : (valA - valB);
  });

  // 描画
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

    tr.innerHTML = `
      <td style="text-align:left; font-weight:500;" class="clickable-job" onclick="openModal('${d.jobKey}')">
        ${d.name} <span style="font-size:0.8em; color:#718096;">❐</span>
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
  
  // ヘッダーのクリックイベント（再描画しても重複しないようにクローン置換）
  ths.forEach(th => {
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
    
    // 現在ソート中の列なら目印をつけるなどしても良い（今回は省略）
    if (newTh.dataset.key === currentTableSortKey) {
      newTh.style.backgroundColor = currentTableSortDesc ? "#B3E5FC" : "#E1F5FE"; // 色でわかるように
    }

    newTh.addEventListener("click", () => {
      const key = newTh.dataset.key;
      if (!key) return;

      // 同じキーなら昇順・降順を反転、違うキーなら降順リセット
      if (currentTableSortKey === key) {
        currentTableSortDesc = !currentTableSortDesc;
      } else {
        currentTableSortKey = key;
        currentTableSortDesc = true; // 基本は大きい順が見やすい
      }
      
      // 再描画（データは変えずソートだけ適用）
      refreshTableOnly();
    });
  });
}


// --- モーダル処理 ---

function openModal(jobKey) {
  const { data } = getCurrentStageData(); // 現在のステージデータから検索
  const d = data.find(j => j.job === jobKey);
  if (!d) return;

  const nameEl = document.getElementById("modal-job-name");
  if (nameEl) nameEl.textContent = (JOB_NAME_JP[d.job] || d.job) + " の平均詳細データ";

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
        <td>${label === "全体" ? "" : label}</td> <td>${fmt2(p("avgK"))}</td>
        <td>${fmt2(p("avgD"))}</td>
        <td>${fmt2(p("avgA"))}</td>
        <td style="color:#d69e2e">${fmt(p("avgDamage"))}</td>
        <td style="color:#e53e3e">${fmt(p("avgTaken"))}</td>
        <td style="color:#38a169">${fmt(p("avgHeal"))}</td>
        <td style="color:#718096">${fmtTime(p("avgTime"))}</td>
      </tr>
    `;
  };

  // モーダル内は「全体(空欄)」「勝利」「敗北」の順
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
