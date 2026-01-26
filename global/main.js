
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
          yAxisID: 'yWin', // 左側の軸を使用
          order: 2
        },
        {
          label: '人口比率 (%)',
          data: pickRates,
          type: 'line', // 人口比率だけ折れ線にする
          borderColor: '#4a5568',
          borderWidth: 3,
          fill: false,
          yAxisID: 'yPop', // 右側の軸を使用
          order: 1
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

  const label =
    (l === "全体") ? "全体" :
    (l === "勝利") ? "勝利" :
    (l === "敗北") ? "敗北" : l;

  if (l !== "全体" && ((l === "勝利" && d.wins === 0) || (l === "敗北" && d.losses === 0))) {
    return `<tr class="${c}"><td>${label}</td><td colspan="7">データなし</td></tr>`;
  }

  return `<tr class="${c}"><td>${label}</td><td>${fmt2(pk("avgK"))}</td><td>${fmt2(pk("avgD"))}</td><td>${fmt2(pk("avgA"))}</td><td style="color:#d69e2e">${fmt(pk("avgDamage"))}</td><td style="color:#e53e3e">${fmt(pk("avgTaken"))}</td><td style="color:#38a169">${fmt(pk("avgHeal"))}</td><td style="color:#718096">${fmtT(pk("avgTime"))}</td></tr>`;
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


// --- ジョブ別 散布図（バブル） ---

let jobScatterChartInstance = null;
const JOB_ICON_CACHE = new Map(); // jobKey -> { img, promise, canvas }

function roleToLabel(role) {
  if (role === "tank") return "タンク";
  if (role === "healer") return "ヒーラー";
  if (role === "dps") return "DPS";
  return "不明";
}

function loadJobIcon(jobKey) {
  if (JOB_ICON_CACHE.has(jobKey)) return JOB_ICON_CACHE.get(jobKey).promise;

  const img = new Image();
  img.src = `../images/JOB/${jobKey}.png`;

  const promise = new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });

  JOB_ICON_CACHE.set(jobKey, { img, promise, canvas: null });
  return promise;
}

function getJobIconCanvas(jobKey) {
  const ent = JOB_ICON_CACHE.get(jobKey);
  if (!ent || !ent.img) return null;
  if (ent.canvas) return ent.canvas;

  const size = 52;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");

  const role = JOB_META[jobKey]?.role || "unknown";
  const ring =
    role === "tank" ? "#63b3ed" :
    role === "healer" ? "#48bb78" :
    role === "dps" ? "#f687b3" : "#a0aec0";

  // ふわっと白背景 + ロール色リング
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.stroke();

  // アイコン（丸くクリップ）
  const pad = 8;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(ent.img, pad, pad, size - pad * 2, size - pad * 2);
  ctx.restore();

  ent.canvas = c;
  return c;
}

function getOrCreateJobScatterTooltip(chart) {
  const parent = chart.canvas.parentNode;
  let el = parent.querySelector(".job-scatter-tooltip");
  if (el) return el;

  el = document.createElement("div");
  el.className = "job-scatter-tooltip";
  el.style.position = "absolute";
  el.style.pointerEvents = "none";
  el.style.opacity = "0";
  el.style.transition = "opacity 0.12s ease, transform 0.12s ease";
  el.style.transform = "translateY(4px)";
  el.style.background = "rgba(255,255,255,0.96)";
  el.style.border = "1px solid rgba(226,232,240,0.9)";
  el.style.borderRadius = "14px";
  el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.10)";
  el.style.padding = "10px 12px";
  el.style.fontFamily = '"Kiwi Maru", serif';
  el.style.color = "#455A64";
  el.style.zIndex = "10";
  parent.appendChild(el);
  return el;
}

function jobScatterExternalTooltip(context) {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateJobScatterTooltip(chart);

  if (!tooltip || tooltip.opacity === 0) {
    tooltipEl.style.opacity = "0";
    tooltipEl.style.transform = "translateY(4px)";
    return;
  }

  const dp = tooltip.dataPoints && tooltip.dataPoints[0];
  const raw = dp && dp.raw;
  if (!raw) return;

  const jobKey = raw.jobKey;
  const meta = JOB_META[jobKey] || {};
  const role = meta.role || "unknown";
  const roleBg = ROLE_COLORS[role] || ROLE_COLORS.unknown;

  const jp = meta.jp || jobKey;
  const winRate = Number(raw.winRate || 0).toFixed(1);
  const pickRate = Number(raw.pickRate || 0).toFixed(1);
  const matches = raw.matches || 0;

  tooltipEl.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center;">
      <img src="../images/JOB/${jobKey}.png" style="width:34px;height:34px;border-radius:12px;background:#fff;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" />
      <div>
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="font-size:0.98rem; font-weight:600;">${jp}</div>
          <div style="font-size:0.75rem; padding:2px 8px; border-radius:999px; background:${roleBg}; color:#546E7A;">
            ${roleToLabel(role)}
          </div>
        </div>
        <div style="margin-top:6px; font-size:0.85rem; color:#546E7A; line-height:1.45;">
          勝率 ${winRate}%　使用率 ${pickRate}%<br>
          試合数 ${matches}
        </div>
      </div>
    </div>
  `;

  const cw = chart.canvas.width;
  const ch = chart.canvas.height;

  // 右下に出す（はみ出しは内側に寄せる）
  let x = tooltip.caretX + 14;
  let y = tooltip.caretY + 14;

  tooltipEl.style.left = "0px";
  tooltipEl.style.top = "0px";
  tooltipEl.style.opacity = "1";

  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;

  x = Math.max(8, Math.min(x, cw - tw - 8));
  y = Math.max(8, Math.min(y, ch - th - 8));

  tooltipEl.style.left = x + "px";
  tooltipEl.style.top = y + "px";
  tooltipEl.style.opacity = "1";
  tooltipEl.style.transform = "translateY(0px)";
}

function renderJobScatterChart(jobData, totalMatches) {
  const canvas = document.getElementById("jobScatterChart");
  const iconContainer = document.getElementById("job-scatter-icons");
  if (!canvas || !iconContainer) return;

  iconContainer.innerHTML = "";

  const points = jobData
    .filter(d => d.total > 0 && JOB_META[d.job])
    .map(d => {
      const matches = Math.max(1, Math.floor(d.total / 10));
      const winRate = d.total ? (d.wins / d.total) * 100 : 0;
      const pickRate = totalMatches ? (d.total / totalMatches) * 100 : 0;
      const role = JOB_META[d.job]?.role || "unknown";
      
      // ロールごとの色定義
      const bg = ROLE_COLORS[role] || "#F5F5F5";
      const border = 
        role === "tank" ? "#63b3ed" : 
        role === "healer" ? "#48bb78" : 
        role === "dps" ? "#f687b3" : "#a0aec0";

      return { 
        jobKey: d.job, matches, winRate, pickRate, role,
        backgroundColor: bg,
        borderColor: border
      };
    })
    .sort((a, b) => (JOB_META[a.jobKey]?.order || 99) - (JOB_META[b.jobKey]?.order || 99));

  if (!points.length) return;

  resetCanvas("jobScatterChart");
  const ctx = document.getElementById("jobScatterChart").getContext("2d");

  if (jobScatterChartInstance) {
    try { jobScatterChartInstance.destroy(); } catch (_) {}
  }

  // 強調表示（ターゲット以外を薄くする）ためのヘルパー
  const updateStyles = (hoveredIndex) => {
    const ds = jobScatterChartInstance.data.datasets[0];
    if (hoveredIndex === null) {
      ds.backgroundColor = points.map(p => p.backgroundColor);
      ds.borderColor = points.map(p => p.borderColor);
    } else {
      // ターゲット以外を透明度 0.15 (15%) くらいにする
      ds.backgroundColor = points.map((p, i) => i === hoveredIndex ? p.backgroundColor : p.backgroundColor + "26");
      ds.borderColor = points.map((p, i) => i === hoveredIndex ? p.borderColor : p.borderColor + "26");
    }
    jobScatterChartInstance.update("none");
  };

  jobScatterChartInstance = new Chart(ctx, {
    type: "bubble",
    data: {
      datasets: [{
        label: "jobs",
        data: points.map(p => ({ x: p.pickRate, y: p.winRate, r: 9, ...p })),
        backgroundColor: points.map(p => p.backgroundColor), // 点の中の色
        borderColor: points.map(p => p.borderColor),     // 点の枠線
        borderWidth: 2,
        hoverRadius: (ctx) => ctx.raw.r + 5,
        hoverBorderWidth: 3
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: jobScatterExternalTooltip }
      },
      scales: {
        x: { 
          beginAtZero: true, 
          title: { display: true, text: "使用率 (%)" },
          suggestedMax: Math.max(...points.map(p => p.pickRate)) * 1.15
        },
        y: { 
          title: { display: true, text: "勝率 (%)" },
          suggestedMin: Math.min(...points.map(p => p.winRate)) - 3,
          suggestedMax: Math.max(...points.map(p => p.winRate)) + 3
        }
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements && elements.length ? "pointer" : "default";
      },
      onClick: (_evt, elements, chart) => {
        if (!elements || !elements.length) return;
        const raw = chart.data.datasets[0].data[elements[0].index];
        if (raw && raw.jobKey) openModal(raw.jobKey);
      }
    }
  });

  // 3. ロール・区分別のアイコン一覧を生成
  groups.forEach(group => {
    const groupPoints = points.filter(p => group.jobs.includes(p.jobKey));
    if (groupPoints.length === 0) return;

    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:2px 0;";

    const label = document.createElement("span");
    label.textContent = group.label;
    label.style.cssText = "font-size:0.7rem; font-weight:bold; color:#94A3B8; min-width:55px; border-right:2px solid #E2E8F0; margin-right:4px;";
    row.appendChild(label);

    const iconsDiv = document.createElement("div");
    iconsDiv.style.cssText = "display:flex; gap:6px; flex-wrap:wrap;";

    groupPoints.forEach(p => {
      const globalIndex = points.findIndex(point => point.jobKey === p.jobKey);
      
      const img = document.createElement("img");
      img.src = `../images/JOB/${p.jobKey}.png`;
      img.style.cssText = `width:32px; height:32px; cursor:pointer; border-radius:6px; border:2px solid ${p.borderColor}; transition:0.2s; background:${p.backgroundColor}; padding:2px;`;
      
      img.onmouseenter = () => {
        img.style.transform = "scale(1.25) translateY(-2px)";
        img.style.boxShadow = `0 4px 12px ${p.borderColor}88`;
        updateStyles(globalIndex);
        jobScatterChartInstance.tooltip.setActiveElements([{ datasetIndex: 0, index: globalIndex }], { x: 0, y: 0 });
      };
      img.onmouseleave = () => {
        img.style.transform = "scale(1)";
        img.style.boxShadow = "none";
        updateStyles(null);
        jobScatterChartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
      };
      img.onclick = () => openModal(p.jobKey);
      iconsDiv.appendChild(img);
    });

    row.appendChild(iconsDiv);
    iconContainer.appendChild(row);
  });
}

const _updateDashboardOriginal = updateDashboard;
updateDashboard = function () {
  _updateDashboardOriginal();
  const { data, total } = getCurrentStageData();
  renderJobScatterChart(data, total);
};
