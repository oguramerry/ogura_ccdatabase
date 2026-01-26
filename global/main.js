
const API_URL = "https://script.google.com/macros/s/AKfycbxCOYEGborjJzpnyd1lG5_MeX3BDmQvjLC-NqN8MpKnr6YRBgcfz962kRFJsiFkb7RXdg/exec";
let currentViewMode = "ALL";
// --- グローバル変数 ---
let globalData = null;

// テーブル用設定
let currentTableViewMode = "ALL";
let currentTableSortKey = "job"; 
let currentTableSortDesc = false;

// ダメージグラフ用設定
let currentDamageViewMode = "ALL";


// ★ジョブの設定（略称対応・指定順・ロール別カラー）
const JOB_META = {
  // --- TANK (Pastel Blue) ---
  "PLD": { order: 1,  role: "tank",   jp: "ナイト" },
  "WAR": { order: 2,  role: "tank",   jp: "戦士" },
  "DRK": { order: 3,  role: "tank",   jp: "暗黒騎士" },
  "GNB": { order: 4,  role: "tank",   jp: "ガンブレイカー" },
  // --- HEALER (Pastel Green) ---
  "WHM": { order: 5,  role: "healer", jp: "白魔道士" },
  "SCH": { order: 6,  role: "healer", jp: "学者" },
  "AST": { order: 7,  role: "healer", jp: "占星術師" },
  "SGE": { order: 8,  role: "healer", jp: "賢者" },
  // --- DPS (Pastel Pink) ---
  "MNK": { order: 9,  role: "dps",    jp: "モンク" },
  "DRG": { order: 10, role: "dps",    jp: "竜騎士" },
  "NIN": { order: 11, role: "dps",    jp: "忍者" },
  "SAM": { order: 12, role: "dps",    jp: "侍" },
  "RPR": { order: 13, role: "dps",    jp: "リーパー" },
  "VPR": { order: 14, role: "dps",    jp: "ヴァイパー" },
  "BRD": { order: 15, role: "dps",    jp: "吟遊詩人" },
  "MCH": { order: 16, role: "dps",    jp: "機工士" },
  "DNC": { order: 17, role: "dps",    jp: "踊り子" },
  "BLM": { order: 18, role: "dps",    jp: "黒魔道士" },
  "SMN": { order: 19, role: "dps",    jp: "召喚士" },
  "RDM": { order: 20, role: "dps",    jp: "赤魔道士" },
  "PCT": { order: 21, role: "dps",    jp: "ピクトマンサー" }
};

const ROLE_COLORS = {
  tank: "#E3F2FD", healer: "#E8F5E9", dps: "#FCE4EC", unknown: "#F5F5F5"
};

// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();
  
  // テーブル・グラフの切替監視
  const monitorRadio = (name, callback) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.addEventListener("change", (e) => callback(e.target.value));
    });
  };

  monitorRadio("viewMode", (val) => { 
    currentTableViewMode = val; 
    refreshTableOnly(); 
  });
  monitorRadio("damageViewMode", (val) => { 
    currentDamageViewMode = val; 
    refreshDamageChartOnly(); 
  });
});

async function fetchGlobalData() {
  try {
    const res = await fetch(`${API_URL}?action=global`);
    globalData = await res.json();
    initStageSelector(globalData.byStage);
    updateDashboard();
  } catch (err) { console.error(err); }
}

function initStageSelector(stages) {
  const sel = document.getElementById("stage-selector");
  if (!sel) return;
  stages.sort((a, b) => a.stage.localeCompare(b.stage)).forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.stage;
    opt.textContent = `${s.stage} (${Math.floor(s.total/10)}試合)`;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", updateDashboard);
}

function getCurrentStageData() {
  const stageName = document.getElementById("stage-selector").value;
  if (stageName === "ALL") {
    return { data: globalData.byJob, hour: globalData.byHour, total: globalData.meta.total };
  }
  return {
    data: globalData.byStageJob.filter(d => d.stage === stageName),
    hour: globalData.byStageHour.filter(d => d.stage === stageName),
    total: globalData.byStage.find(s => s.stage === stageName)?.total || 0
  };
}

function updateDashboard() {
  const { data, hour, total } = getCurrentStageData();
  const totalEl = document.getElementById("total-matches");
  if (totalEl) totalEl.textContent = `${Math.floor(total / 10)} 試合`;
  
  renderJobPieChart(data);
  renderRoleAnalysisChart(data,total);
  renderHourChart(hour);
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

// --- グラフ描画関数 ---

function renderJobPieChart(jobData) {
  resetCanvas("jobPieChart");
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  const topList = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.total, 0);
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [...topList.map(d => JOB_META[d.job]?.jp || d.job), ...(otherTotal > 0 ? ["その他"] : [])],
      datasets: [{
        data: [...topList.map(d => Math.floor(d.total / 10)), ...(otherTotal > 0 ? [Math.floor(otherTotal / 10)] : [])],
        backgroundColor: ['#63b3ed', '#4fd1c5', '#f6e05e', '#f687b3', '#9f7aea', '#ed8936', '#a0aec0', '#48bb78', '#cbd5e0'],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });
}

function renderRoleAnalysisChart(jobData, totalMatches) {
  resetCanvas("roleAnalysisChart");
  const ctx = document.getElementById("roleAnalysisChart").getContext("2d");

  // ロール別の集計
  const roles = {
    tank:   { wins: 0, total: 0, label: "タンク", color: "#63b3ed", bg: "#E3F2FD" },
    healer: { wins: 0, total: 0, label: "ヒーラー", color: "#48bb78", bg: "#E8F5E9" },
    dps:    { wins: 0, total: 0, label: "DPS", color: "#f687b3", bg: "#FCE4EC" }
  };

  jobData.forEach(d => {
    const r = JOB_META[d.job]?.role;
    if (roles[r]) {
      roles[r].wins += d.wins;
      roles[r].total += d.total;
    }
  });

  const labels = Object.values(roles).map(r => r.label);
const winRates = Object.values(roles).map(r => r.total ? Number((r.wins / r.total * 100).toFixed(1)) : 0);
const pickRates = Object.values(roles).map(r => totalMatches ? Number((r.total / totalMatches * 100).toFixed(1)) : 0);


  

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '平均勝率 (%)',
          data: winRates,
          backgroundColor: Object.values(roles).map(r => r.bg),
          borderColor: Object.values(roles).map(r => r.color),
          borderWidth: 2,
          borderRadius: 8,
          yAxisID: 'yWin' // 左側の軸を使用
        },
        {
          label: '人口比率 (%)',
          data: pickRates,
          type: 'line', // 人口比率だけ折れ線にする
          borderColor: '#4a5568',
          borderWidth: 3,
          fill: false,
          yAxisID: 'yPop' // 右側の軸を使用
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        yWin: {
          beginAtZero: true,
          max: 100,
          position: 'left',
          title: { display: true, text: '勝率 (%)' }
        },
        yPop: {
          beginAtZero: true,
          max: 100,
          position: 'right',
          grid: { drawOnChartArea: false }, // グリッド線が重ならないようにする
          title: { display: true, text: '人口比率 (%)' }
        }
      },
      plugins: {
        legend: { position: 'bottom' } // 凡例を表示して指標を明確にする
      }
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
      datasets: [{ label: '試合数', data: counts, backgroundColor: '#90cdf4', borderRadius: 4 }]
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
}

function renderDamageChart(jobData) {
  resetCanvas("damageChart");
  const ctx = document.getElementById("damageChart").getContext("2d");
  const key = (currentDamageViewMode === "WIN") ? "w_avgDamage" : (currentDamageViewMode === "LOSE") ? "l_avgDamage" : "avgDamage";
  const filtered = jobData.filter(d => d.total >= 1).map(d => ({ ...d, _val: d[key] || 0 })).sort((a, b) => b._val - a._val);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: filtered.map(d => JOB_META[d.job]?.jp || d.job),
      datasets: [{ label: '平均与ダメ', data: filtered.map(d => Math.round(d._val)), backgroundColor: '#f6ad55', borderRadius: 4 }]
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
}

function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  const pK = (k) => (currentTableViewMode === "WIN") ? "w_" + k : (currentTableViewMode === "LOSE") ? "l_" + k : k;

  let list = jobData.map(d => {
    const meta = JOB_META[d.job] || {};
    return {
      name: meta.jp || d.job, jobKey: d.job, sortOrder: meta.order || 999, role: meta.role || "unknown",
      winRate: (d.wins / d.total) * 100,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      avgK: d[pK("avgK")] || 0, avgD: d[pK("avgD")] || 0, avgA: d[pK("avgA")] || 0,
      avgDmg: d[pK("avgDamage")] || 0, avgTaken: d[pK("avgTaken")] || 0,
      avgHeal: d[pK("avgHeal")] || 0, avgTime: d[pK("avgTime")] || 0
    };
  });

  list.sort((a, b) => (currentTableSortKey === "job") ? 
    (currentTableSortDesc ? b.sortOrder - a.sortOrder : a.sortOrder - b.sortOrder) :
    (currentTableSortDesc ? b[currentTableSortKey] - a[currentTableSortKey] : a[currentTableSortKey] - b[currentTableSortKey]));

  tbody.innerHTML = "";
  list.forEach(d => {
    const tr = document.createElement("tr");
    const fmt = (n) => Math.round(n).toLocaleString();
    const fmtT = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
    tr.innerHTML = `
      <td style="text-align:left;"><span class="clickable-job" onclick="openModal('${d.jobKey}')" style="background-color:${ROLE_COLORS[d.role]}; padding:6px 14px; border-radius:20px; color:#546E7A; font-weight:bold;">${d.name}</span></td>
      <td class="${d.winRate >= 50 ? 'rate-high' : 'rate-low'}">${d.winRate.toFixed(1)}%</td>
      <td>${d.pickRate.toFixed(1)}%</td>
      <td>${d.avgK.toFixed(2)}</td><td>${d.avgD.toFixed(2)}</td><td>${d.avgA.toFixed(2)}</td>
      <td style="font-weight:bold; color:#d69e2e;">${fmt(d.avgDmg)}</td>
      <td style="font-weight:bold; color:#e53e3e;">${fmt(d.avgTaken)}</td>
      <td style="font-weight:bold; color:#38a169;">${fmt(d.avgHeal)}</td>
      <td style="font-weight:bold; color:#718096;">${fmtT(d.avgTime)}</td>
    `;
    tbody.appendChild(tr);
  });

  ths.forEach(th => {
    const newTh = th.cloneNode(true); th.parentNode.replaceChild(newTh, th);
    if (newTh.dataset.key === currentTableSortKey) newTh.style.backgroundColor = "#B3E5FC";
    newTh.addEventListener("click", () => {
      if (currentTableSortKey === newTh.dataset.key) currentTableSortDesc = !currentTableSortDesc;
      else { currentTableSortKey = newTh.dataset.key; currentTableSortDesc = (newTh.dataset.key !== "job"); }
      refreshTableOnly();
    });
  });
}

// --- モーダル・補助関数 ---

function openModal(jobKey) {
  const { data } = getCurrentStageData();
  const d = data.find(j => j.job === jobKey);
  if (!d) return;
  document.getElementById("modal-job-name").textContent = (JOB_META[d.job]?.jp || d.job) + " の平均詳細データ";
  const fmt = (n) => Math.round(n).toLocaleString();
  const fmt2 = (n) => n.toFixed(2);
  const fmtT = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  const makeR = (l, c, p) => {
    const pk = (k) => d[p + k] || d[k] || 0;
    if (l !== "全体" && ((l === "勝利" && d.wins === 0) || (l === "敗北" && d.losses === 0))) return `<tr class="${c}"><td>${l}</td><td colspan="7">データなし</td></tr>`;
    return `<tr class="${c}"><td>${l === "全体" ? "" : l}</td><td>${fmt2(pk("avgK"))}</td><td>${fmt2(pk("avgD"))}</td><td>${fmt2(pk("avgA"))}</td><td style="color:#d69e2e">${fmt(pk("avgDamage"))}</td><td style="color:#e53e3e">${fmt(pk("avgTaken"))}</td><td style="color:#38a169">${fmt(pk("avgHeal"))}</td><td style="color:#718096">${fmtT(pk("avgTime"))}</td></tr>`;
  };
  document.getElementById("modal-stats-body").innerHTML = makeR("全体", "row-all", "") + makeR("勝利", "row-win", "w_") + makeR("敗北", "row-lose", "l_");
  document.getElementById("job-detail-modal").style.display = "flex";
}

function closeModal() { document.getElementById("job-detail-modal").style.display = "none"; }
function resetCanvas(id) {
  const old = document.getElementById(id); if (!old) return;
  const parent = old.parentElement; old.remove();
  const n = document.createElement("canvas"); n.id = id; parent.appendChild(n);
}
