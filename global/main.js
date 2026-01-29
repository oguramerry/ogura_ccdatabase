// main.js (修正版)

// --- グローバル変数 ---
let currentViewMode = "ALL";
let globalData = null;

// 集計方法（"avg" or "median"）
let currentStatMethod = "avg";

// テーブル用設定
let currentTableViewMode = "ALL";
let currentTableSortKey = "job"; 
let currentTableSortDesc = false;

// ダメージグラフ用設定
let currentDamageViewMode = "ALL";

// 散布図フィルター用設定
let jobFilterState = {}; 
FILTER_GROUPS_DEF.flatMap(g => g.jobs).forEach(j => jobFilterState[j] = true);

const STAGE_ORDER = [
  "Palaistra",                // パライストラ
  "Volcanic Heart",           // ヴォルカニック・ハート
  "Clockwork Castletown", // 東方絡繰御殿
  "Bayside Battleground",     // ベイサイド・バトルグラウンド
  "Cloud Nine",               // クラウドナイン
  "Red Sands"           // レッド・サンズ
];

// --- ★ステージ名と画像ファイル名の対応マップ ---
const STAGE_IMAGE_MAP = {
  "パライストラ": "pala.jpg",
  "ヴォルカニック・ハート": "vol.jpg",
  "クラウドナイン": "cloud.jpg",
  "レッド・サンズ": "red.jpg",
  "東方絡繰御殿": "kara.jpg", 
  "ベイサイド・バトルグラウンド": "bay.jpg",
  // 英語名用
  "Palaistra": "pala.jpg",
  "Volcanic Heart": "vol.jpg",
  "Cloud Nine": "cloud.jpg",
  "Red Sands": "red.jpg",
  "Clockwork Castletown": "kara.jpg",
  "Bayside Battleground": "bay.jpg",
};


// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();

  // 更新ボタン
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (refreshBtn.classList.contains("loading")) return;
      try {
        refreshBtn.classList.add("loading"); 
        await fetchGlobalData();             
      } catch (e) {
        console.error(e);
        alert("データの更新に失敗しました");
      } finally {
        setTimeout(() => { refreshBtn.classList.remove("loading"); }, 500);
      }
    });
  }
  
  // ラジオボタン監視
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

  // 集計方法の切り替え監視
  monitorRadio("statMethod", (val) => {
    currentStatMethod = val;
    // ★修正: 表だけを更新し、ダメージグラフには影響させない
    refreshTableOnly();
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
  sel.innerHTML = '<option value="ALL">全てのステージ</option>';
  
  stages.sort((a, b) => {
    const indexA = STAGE_ORDER.indexOf(a.stage);
    const indexB = STAGE_ORDER.indexOf(b.stage);
    
    // リストにないものは末尾へ
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    
    return indexA - indexB;
  });

  stages.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.stage;
    
    // 日本語名で表示
    const jpName = STAGE_NAME_JP[s.stage] || s.stage;
    opt.textContent = `${jpName} (${Math.floor(s.total/10)}試合)`;
    
    sel.appendChild(opt);
  });
  
  sel.addEventListener("change", updateDashboard);
}

function getCurrentStageData() {
  const stageName = document.getElementById("stage-selector").value;
  let targetDCData = globalData.byDC;
  
  if (stageName === "ALL") {
    return { 
      data: globalData.byJob, 
      hour: globalData.byHour, 
      total: globalData.meta.total, 
      stageName: "ALL",
      dcData: targetDCData
    };
  }
  
// ステージ指定時
  // byStageDCが存在し、かつそのステージのデータがあればそれを使う
  if (globalData.byStageDC && globalData.byStageDC[stageName]) {
    targetDCData = globalData.byStageDC[stageName];
  } else {
    // データがない場合は空っぽのデータを入れるかnullにする（ここでは0埋めデータを想定）
    targetDCData = { "Elemental": 0, "Gaia": 0, "Mana": 0, "Meteor": 0 };
  }
  
  return {
    data: globalData.byStageJob.filter(d => d.stage === stageName),
    hour: globalData.byStageHour.filter(d => d.stage === stageName),
    total: globalData.byStage.find(s => s.stage === stageName)?.total || 0,
    stageName: stageName,
    dcData: targetDCData
  };
}

// --- ★データ取得ヘルパー ---
function getStatValue(dataObj, metricKey, viewMode = "ALL") {
  if (!dataObj) return 0;
  const prefix = (viewMode === "WIN") ? "w_" : (viewMode === "LOSE") ? "l_" : "";
  const method = currentStatMethod; 
  const finalKey = `${prefix}${method}${metricKey}`;
  return dataObj[finalKey] || 0;
}

function updateDashboard() {
  const { data, hour, total, stageName, dcData } = getCurrentStageData();
  
  const totalEl = document.getElementById("total-matches");
  if (totalEl) totalEl.textContent = `${Math.floor(total / 10)} 試合`;

  // 背景画像の更新
  updateBackgroundImage(stageName);
  
if (dcData) {
    renderDCPieChart(dcData);
  }
  
  renderRoleAnalysisChart(data, total);
  renderHourChart(hour);
  renderDamageChart(data);
  renderJobTable(data, total);
  renderJobScatterChart(data, total);
}

// ★背景画像更新関数（パス修正済み）
function updateBackgroundImage(stageName) {
  const bg = document.getElementById("stage-background");
  if (!bg) return;

  if (stageName === "ALL") {
    bg.style.backgroundImage = "none"; 
  } else {
    // マップからファイル名を取得
    const fileName = STAGE_IMAGE_MAP[stageName] || `${stageName}.jpg`;
    // ★修正: フォルダ名を小文字の "stage" に変更
    bg.style.backgroundImage = `url('../images/stage/${fileName}')`;
  }
}

function refreshTableOnly() {
  const { data, total } = getCurrentStageData();
  renderJobTable(data, total);
}

function refreshDamageChartOnly() {
  const { data } = getCurrentStageData();
  renderDamageChart(data);
}

// ★新しい円グラフ描画関数を追加
function renderDCPieChart(dcData) {
  // Canvasのリセット
  resetCanvas("dcPieChart");
  const ctx = document.getElementById("dcPieChart").getContext("2d");
  
  // データの整形
  // dcData は { "Elemental": 100, "Gaia": 80... } のような形式を想定
  const labels = ["Elemental", "Gaia", "Mana", "Meteor"];
  const counts = labels.map(label => dcData[label] || 0);
  
  // 合計数の算出（比率計算用）
  const total = counts.reduce((a, b) => a + b, 0);
  
  // 色配列の作成
  const bgColors = labels.map(label => DC_META[label]?.color || "#ccc");

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: { 
      maintainAspectRatio: false, 
      plugins: { 
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) label += ': ';
              const val = context.parsed;
              const percentage = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
              return `${label}${val}人 (${percentage})`;
            }
          }
        }
      } 
    }
  });
}
function renderRoleAnalysisChart(jobData, totalMatches) {
  resetCanvas("roleAnalysisChart");
  const ctx = document.getElementById("roleAnalysisChart").getContext("2d");

  const MELEE = ["MNK", "DRG", "NIN", "SAM", "RPR", "VPR"];
  const RANGE = ["BRD", "MCH", "DNC"];
  const CASTER = ["BLM", "SMN", "RDM", "PCT"];

  const roles = {
    tank:   { wins: 0, total: 0, label: "タンク",   color: "#63b3ed", bg: "#E3F2FD" },
    healer: { wins: 0, total: 0, label: "ヒーラー", color: "#48bb78", bg: "#E8F5E9" },
    melee:  { wins: 0, total: 0, label: "メレー",   color: "#f56565", bg: "#FED7D7" },
    range:  { wins: 0, total: 0, label: "レンジ",   color: "#ed8936", bg: "#FEEBC8" },
    caster: { wins: 0, total: 0, label: "キャスター", color: "#9f7aea", bg: "#E9D8FD" }
  };

  jobData.forEach(d => {
    const meta = JOB_META[d.job];
    const r = meta?.role;

    if (r === "tank") {
      roles.tank.wins += d.wins; roles.tank.total += d.total;
    } else if (r === "healer") {
      roles.healer.wins += d.wins; roles.healer.total += d.total;
    } else if (r === "dps") {
      if (MELEE.includes(d.job)) { roles.melee.wins += d.wins; roles.melee.total += d.total; }
      else if (RANGE.includes(d.job)) { roles.range.wins += d.wins; roles.range.total += d.total; }
      else if (CASTER.includes(d.job)) { roles.caster.wins += d.wins; roles.caster.total += d.total; }
    }
  });

  const labels = Object.values(roles).map(r => r.label);
  const winRates = Object.values(roles).map(r => r.total ? Number((r.wins / r.total * 100).toFixed(1)) : 0);
  const pickRates = Object.values(roles).map(r => totalMatches ? Number((r.total / totalMatches * 100).toFixed(1)) : 0);
  const bgColors = Object.values(roles).map(r => r.bg);
  const borderColors = Object.values(roles).map(r => r.color);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: '平均勝率 (%)', data: winRates, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 2, borderRadius: 8, yAxisID: 'yWin', order: 2 },
        { label: '人口比率 (%)', data: pickRates, type: 'line', borderColor: '#4a5568', borderWidth: 3, fill: false, yAxisID: 'yPop', order: 1 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        yWin: { beginAtZero: true, max: 100, position: 'left', title: { display: true, text: '勝率 (%)' } },
        yPop: { beginAtZero: true, max: 100, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '人口比率 (%)' } }
      },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderHourChart(hourData) {
  const hours = Array.from({length: 24}, (_, i) => i);
  const counts = hours.map(h => {
    const found = hourData.find(d => Number(d.hour) === h);
    return found ? Math.floor(found.total / 10) : 0;
  });

  drawSimpleBarChart(
    "hourChart",
    hours.map(h => `${h}時`),
    counts,
    '試合数',
    '#90cdf4'
  );
}

function renderDamageChart(jobData) {
  // ★修正: ここでは「平均(avg)」を強制的に使用する
  // (テーブル側のトグルに関係なく平均与ダメを表示するため)
  const metric = "Damage";
  const method = "avg"; // 固定
  
  const prefix = (currentDamageViewMode === "WIN") ? "w_" : (currentDamageViewMode === "LOSE") ? "l_" : "";
  const key = `${prefix}${method}${metric}`;
  
  const filtered = jobData
    .filter(d => d.total >= 1)
    .map(d => ({ 
      ...d, 
      _val: d[key] || 0 
    }))
    .sort((a, b) => b._val - a._val);

  const labels = filtered.map(d => JOB_META[d.job]?.jp || d.job);
  const data = filtered.map(d => Math.round(d._val));

  drawSimpleBarChart(
    "damageChart",
    labels,
    data,
    '平均与ダメ',
    '#f6ad55'
  );
}

function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  
  const val = (d, key) => getStatValue(d, key, currentTableViewMode);

  let list = jobData.map(d => {
    const meta = JOB_META[d.job] || {};
    return {
      name: meta.jp || d.job, jobKey: d.job, sortOrder: meta.order || 999, role: meta.role || "unknown",
      winRate: d.total ? (d.wins / d.total) * 100 : 0,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      
      statK: val(d, "K"),
      statD: val(d, "D"),
      statA: val(d, "A"),
      statDmg: val(d, "Damage"),
      statTaken: val(d, "Taken"),
      statHeal: val(d, "Heal"),
      statTime: val(d, "Time"),          
      statMatchTime: val(d, "MatchTime") 
    };
  });

  list.sort((a, b) => {
    let keyA, keyB;
    if (currentTableSortKey === "job") return (currentTableSortDesc ? b.sortOrder - a.sortOrder : a.sortOrder - b.sortOrder);
    
    const map = {
      "winRate": "winRate", "pickRate": "pickRate",
      "K": "statK", "D": "statD", "A": "statA",
      "Damage": "statDmg", "Taken": "statTaken", "Heal": "statHeal",
      "Time": "statTime", "MatchTime": "statMatchTime"
    };
    
    const prop = map[currentTableSortKey] || currentTableSortKey;
    return currentTableSortDesc ? (b[prop] - a[prop]) : (a[prop] - b[prop]);
  });
  
  tbody.innerHTML = "";
  list.forEach(d => {
    const tr = document.createElement("tr");
    const fmt = (n) => Math.round(n).toLocaleString();
    const fmt2 = (n) => n.toFixed(2);
    const fmtT = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
    
    tr.innerHTML = `
      <td style="text-align:left;"><span class="clickable-job" onclick="openModal('${d.jobKey}')" style="background-color:${ROLE_COLORS[d.role]}; padding:6px 14px; border-radius:20px; color:#546E7A; font-weight:bold;">${d.name}</span></td>
      <td class="${d.winRate >= 50 ? 'rate-high' : 'rate-low'}">${d.winRate.toFixed(1)}%</td>
      <td>${d.pickRate.toFixed(1)}%</td>
      <td>${fmt2(d.statK)}</td>
      <td>${fmt2(d.statD)}</td>
      <td>${fmt2(d.statA)}</td>
      <td style="font-weight:bold; color:#d69e2e;">${fmt(d.statDmg)}</td>
      <td style="font-weight:bold; color:#e53e3e;">${fmt(d.statTaken)}</td>
      <td style="font-weight:bold; color:#38a169;">${fmt(d.statHeal)}</td>
      <td style="font-weight:bold; color:#718096;">${fmtT(d.statTime)}</td>
      <td style="font-weight:bold; color:#607D8B;">${fmtT(d.statMatchTime)}</td> `;
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

// --- モーダル ---
function openModal(jobKey) {
  const { data } = getCurrentStageData();
  const d = data.find(j => j.job === jobKey);
  if (!d) return;
  document.getElementById("modal-job-name").textContent = (JOB_META[d.job]?.jp || d.job) + " の詳細データ";
  
  const fmt = (n) => Math.round(n).toLocaleString();
  const fmt2 = (n) => n.toFixed(2);
  const fmtT = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  
  const method = currentStatMethod; 
  
  const makeR = (l, c, viewModePrefix) => {
     const getKey = (k) => `${viewModePrefix}${method}${k}`;
     const val = (k) => d[getKey(k)] || 0;
     
     const label = (l === "全体") ? "全体" : (l === "勝利") ? "勝利" : (l === "敗北") ? "敗北" : l;
     
     if (l !== "全体" && ((l === "勝利" && d.wins === 0) || (l === "敗北" && d.losses === 0))) {
       return `<tr class="${c}"><td>${label}</td><td colspan="8">データなし</td></tr>`;
     }
     
     return `
      <tr class="${c}">
        <td>${label}</td>
        <td>${fmt2(val("K"))}</td>
        <td>${fmt2(val("D"))}</td>
        <td>${fmt2(val("A"))}</td>
        <td style="color:#d69e2e">${fmt(val("Damage"))}</td>
        <td style="color:#e53e3e">${fmt(val("Taken"))}</td>
        <td style="color:#38a169">${fmt(val("Heal"))}</td>
        <td style="color:#718096">${fmtT(val("Time"))}</td>
        <td style="color:#607D8B">${fmtT(val("MatchTime"))}</td> </tr>`;
  };

  document.getElementById("modal-stats-body").innerHTML = 
    makeR("全体", "row-all", "") + 
    makeR("勝利", "row-win", "w_") + 
    makeR("敗北", "row-lose", "l_");
    
  document.getElementById("job-detail-modal").style.display = "flex";
}

function closeModal() { document.getElementById("job-detail-modal").style.display = "none"; }
function resetCanvas(id) {
  const old = document.getElementById(id); if (!old) return;
  const parent = old.parentElement; old.remove();
  const n = document.createElement("canvas"); n.id = id; parent.appendChild(n);
}

// --- 散布図フィルター機能 ---
let jobScatterChartInstance = null;
const JOB_ICON_CACHE = new Map();

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
  return JOB_ICON_CACHE.get(jobKey)?.canvas;
}

function getOrCreateJobScatterTooltip(chart) {
  const parent = chart.canvas.parentNode;
  let el = parent.querySelector(".job-scatter-tooltip");
  if (el) return el;
  el = document.createElement("div");
  el.className = "job-scatter-tooltip";
  el.style.cssText = "position:absolute; pointer-events:none; opacity:0; transition:opacity 0.12s ease, transform 0.12s ease; transform:translateY(4px); background:rgba(255,255,255,0.96); border:1px solid rgba(226,232,240,0.9); border-radius:14px; box-shadow:0 10px 25px rgba(0,0,0,0.10); padding:10px 12px; font-family:'Kiwi Maru',serif; color:#455A64; z-index:10;";
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
          勝率 ${winRate}%<br>使用率 ${pickRate}%<br>使用回数 ${matches}
        </div>
      </div>
    </div>`;

  const cw = chart.canvas.width;
  const ch = chart.canvas.height;
  let x = tooltip.caretX + 14;
  let y = tooltip.caretY + 14;
  tooltipEl.style.left = "0px"; tooltipEl.style.top = "0px"; tooltipEl.style.opacity = "1";
  const tw = tooltipEl.offsetWidth; const th = tooltipEl.offsetHeight;
  x = Math.max(8, Math.min(x, cw - tw - 8));
  y = Math.max(8, Math.min(y, ch - th - 8));
  tooltipEl.style.left = x + "px"; tooltipEl.style.top = y + "px";
  tooltipEl.style.transform = "translateY(0px)";
}

function createResizedIcon(img, size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return c;
}

function createFadedIcon(sourceCanvas) {
  const c = document.createElement('canvas');
  c.width = sourceCanvas.width; c.height = sourceCanvas.height;
  const ctx = c.getContext('2d');
  ctx.globalAlpha = 0.2; 
  ctx.filter = "grayscale(100%)"; 
  ctx.drawImage(sourceCanvas, 0, 0);
  return c;
}

function toggleSingleJob(jobKey) {
  jobFilterState[jobKey] = !jobFilterState[jobKey];
  refreshScatterAndIcons();
}

function toggleRoleGroup(jobs) {
  const hasOff = jobs.some(j => !jobFilterState[j]);
  const newState = hasOff;
  jobs.forEach(j => jobFilterState[j] = newState);
  refreshScatterAndIcons();
}

function toggleAllJobs(newState) {
  Object.keys(jobFilterState).forEach(k => jobFilterState[k] = newState);
  refreshScatterAndIcons();
}

function refreshScatterAndIcons() {
  const { data, total } = getCurrentStageData();
  renderJobScatterChart(data, total);
}

function renderJobScatterChart(jobData, totalMatches) {
  const ICON_SIZE = 40; 
  const canvas = document.getElementById("jobScatterChart");
  const iconContainer = document.getElementById("job-scatter-icons");
  if (!canvas || !iconContainer) return;

  const activePoints = jobData
    .filter(d => d.total > 0 && JOB_META[d.job])
    .filter(d => jobFilterState[d.job]) 
    .map(d => {
      const winRate = d.total ? (d.wins / d.total) * 100 : 0;
      const pickRate = totalMatches ? (d.total / totalMatches) * 100 : 0;
      const role = JOB_META[d.job]?.role || "unknown";
      const bg = ROLE_COLORS[role] || "#F5F5F5";
      const border = 
        role === "tank" ? "#63b3ed" : 
        role === "healer" ? "#48bb78" : 
        role === "dps" ? "#f687b3" : "#a0aec0";
      return { 
        jobKey: d.job, matches: d.total, winRate, pickRate, role,
        backgroundColor: bg, borderColor: border
      };
    })
    .sort((a, b) => (JOB_META[a.jobKey]?.order || 99) - (JOB_META[b.jobKey]?.order || 99));

  const allJobKeys = jobData.map(d => d.job).filter(j => JOB_META[j]);

  Promise.all(allJobKeys.map(j => loadJobIcon(j))).then((loadedImages) => {
    
    const iconAssets = {};
    allJobKeys.forEach((key, i) => {
      const img = loadedImages[i];
      if (img) {
        const resized = createResizedIcon(img, ICON_SIZE);
        const faded = createFadedIcon(resized);
        iconAssets[key] = { normal: resized, faded: faded };
      }
    });

    resetCanvas("jobScatterChart");
    const ctx = document.getElementById("jobScatterChart").getContext("2d");
    if (jobScatterChartInstance) { try { jobScatterChartInstance.destroy(); } catch (_) {} }

    jobScatterChartInstance = new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: [{
          label: "jobs",
          data: activePoints.map(p => ({ x: p.pickRate, y: p.winRate, r: ICON_SIZE / 2, ...p })),
          pointStyle: activePoints.map(p => iconAssets[p.jobKey]?.normal), 
          borderWidth: 0,
          borderColor: 'transparent',
          hoverRadius: ICON_SIZE / 2 + 2, 
          hoverBorderWidth: 0
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
            suggestedMax: 15 
          },
          y: { 
            title: { display: true, text: "勝率 (%)" },
            suggestedMin: 35, 
            suggestedMax: 65 
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = (elements && elements.length) ? "pointer" : "default";
        },
        onClick: (_evt, elements, chart) => {
          if (!elements || !elements.length) return;
          const raw = chart.data.datasets[0].data[elements[0].index];
          if (raw && raw.jobKey) openModal(raw.jobKey);
        }
      }
    });

    iconContainer.innerHTML = "";
    iconContainer.style.cssText = "display:flex; gap:30px; justify-content:center; align-items:flex-start; flex-wrap:wrap;";

    const createGroupRow = (group) => {
      const groupJobKeys = group.jobs;
      if (!groupJobKeys.some(j => iconAssets[j])) return null;

      const row = document.createElement("div");
      row.style.cssText = "display:flex; align-items:center; gap:12px; margin-bottom:12px;";

      const label = document.createElement("span");
      label.textContent = group.label;
      label.title = "クリックで一括切替";
      label.style.cssText = "font-size:0.75rem; font-weight:bold; color:#64748b; min-width:55px; border-right:2px solid #cbd5e1; margin-right:4px; cursor:pointer; user-select:none;";
      label.onclick = () => toggleRoleGroup(groupJobKeys);
      label.onmouseenter = () => label.style.color = "#334155";
      label.onmouseleave = () => label.style.color = "#64748b";
      row.appendChild(label);

      const iconsDiv = document.createElement("div");
      iconsDiv.style.cssText = "display:flex; gap:6px; flex-wrap:wrap;";

      groupJobKeys.forEach(key => {
        if (!iconAssets[key]) return;
        
        const isON = jobFilterState[key]; 
        const img = document.createElement("img");
        img.src = `../images/JOB/${key}.png`;
        
        const baseStyle = `width:32px; height:32px; cursor:pointer; border-radius:6px; transition:0.2s; padding:2px;`;
        if (isON) {
           const role = JOB_META[key]?.role || "unknown";
           const borderCol = 
             role === "tank" ? "#63b3ed" : 
             role === "healer" ? "#48bb78" : 
             role === "dps" ? "#f687b3" : "#a0aec0";
           img.style.cssText = baseStyle + `border:2px solid ${borderCol}; background:#fff; opacity:1; filter:none; transform:scale(1); box-shadow:0 1px 3px rgba(0,0,0,0.1);`;
        } else {
           img.style.cssText = baseStyle + `border:2px solid #e2e8f0; background:transparent; opacity:0.4; filter:grayscale(100%); transform:scale(0.9);`;
        }

        img.onclick = () => toggleSingleJob(key);
        iconsDiv.appendChild(img);
      });
      
      row.appendChild(iconsDiv);
      return row;
    };

    const leftCol = document.createElement("div");
    leftCol.style.cssText = "display:flex; flex-direction:column;";
    const rightCol = document.createElement("div");
    rightCol.style.cssText = "display:flex; flex-direction:column;";

    const tRow = createGroupRow(FILTER_GROUPS_DEF[0]); 
    const hRow = createGroupRow(FILTER_GROUPS_DEF[1]); 
    if(tRow) leftCol.appendChild(tRow);
    if(hRow) leftCol.appendChild(hRow);

    const rightTop = document.createElement("div");
    rightTop.style.cssText = "display:flex; gap:20px; flex-wrap:wrap;";
    const mRow = createGroupRow(FILTER_GROUPS_DEF[2]); 
    const rRow = createGroupRow(FILTER_GROUPS_DEF[3]); 
    if(mRow) rightTop.appendChild(mRow);
    if(rRow) rightTop.appendChild(rRow);
    rightCol.appendChild(rightTop);

    const cRow = createGroupRow(FILTER_GROUPS_DEF[4]); 
    if(cRow) rightCol.appendChild(cRow);

    iconContainer.appendChild(leftCol);
    iconContainer.appendChild(rightCol);
  });
}

function drawSimpleBarChart(canvasId, labels, data, labelText, color) {
  resetCanvas(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: data,
        backgroundColor: color,
        borderRadius: 4
      }]
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 4, bottom: 4 } },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
