// main.js 

// --- グローバル変数 ---
let currentViewMode = "ALL";
let globalData = null;

// 集計方法（"avg" or "median"）
let currentStatMethod = "avg";

// レート表示モード（"RAW" / "PER1" / "PER5"）
let currentRateMode = "RAW";

// テーブル用設定
let currentTableViewMode = "ALL";
let currentTableSortKey = "job"; 
let currentTableSortDesc = false;

// ダメージグラフ用設定
let currentDamageViewMode = "ALL";

// 散布図フィルター用設定
let jobFilterState = {}; 
FILTER_GROUPS_DEF.flatMap(g => g.jobs).forEach(j => jobFilterState[j] = true);

let rankFilterState = {};
Object.keys(RANK_META).forEach(r => rankFilterState[r] = true); // デフォルトは全選択

let rawGlobalDataByRank = null;

const STAGE_ORDER = [
"パライストラ",
  "ヴォルカニック・ハート",
  "東方絡繰御殿",
  "ベイサイド・バトルグラウンド",
  "クラウドナイン",
  "レッド・サンズ"
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
  initRankFilter();
  fetchGlobalData();

  const stageSel = document.getElementById("stage-selector");
  if (stageSel) {
    stageSel.addEventListener("change", updateDashboard);
  }

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
    // 表だけを更新し、ダメージグラフには影響させない
    refreshTableOnly();
  });

  // レート表示（通常/1分/5分）切り替え監視
  monitorRadio("rateMode", (val) => {
    currentRateMode = val;
    refreshTableOnly();
  });
  
});

async function fetchGlobalData() {
  try {
    const res = await fetch(`${API_URL}?action=global`);
    const json = await res.json();
    rawGlobalDataByRank = json.dataByRank;
    
    // 全ランクの合計を計算
    window.grandTotal = Object.values(rawGlobalDataByRank).reduce((sum, d) => sum + d.total, 0);

    // 最終更新時刻を表示
    if (json.meta && json.meta.generatedAt) {
      const lastUpdate = new Date(json.meta.generatedAt);
      const targetEl = document.getElementById("last-updated");
      if (targetEl) {
        targetEl.textContent = 
          `${lastUpdate.getMonth() + 1}/${lastUpdate.getDate()} ${lastUpdate.getHours()}:${String(lastUpdate.getMinutes()).padStart(2, '0')}`;
      }
    }

    initRankFilter();
    aggregateAndRender();
  } catch (err) { 
    console.error("データ取得失敗:", err); 
  }
}

function initStageSelector(stages) {
  const sel = document.getElementById("stage-selector");
  if (!sel) return;

  const currentVal = sel.value;
  
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
    opt.textContent = `${jpName} (${s.total.toLocaleString()}件)`;
    
    sel.appendChild(opt);
  });

  if (currentVal) {
    sel.value = currentVal;
  }
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
    // データがない場合は0埋め
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

// テーブル用：RAW / 1分 / 5分 の倍率（分母は MatchTime 秒）
function getRateFactorForTable_(rowObj) {
  if (currentRateMode === "RAW") return 1;

  const mt = getStatValue(rowObj, "MatchTime", currentTableViewMode); // 秒
  if (!mt || mt <= 0) return 0;

  const base = (currentRateMode === "PER5") ? 300 : 60; // 5分=300秒, 1分=60秒
  return base / mt;
}

// テーブル用：項目値（必要ならレート化）
function getTableMetric_(rowObj, metricKey) {
  const raw = getStatValue(rowObj, metricKey, currentTableViewMode);
  if (metricKey === "MatchTime") return raw; // MatchTimeは常にmm:ss表示（レート化しない）
  if (currentRateMode === "RAW") return raw;
  return raw * getRateFactorForTable_(rowObj);
}

function updateDashboard() {
  const { data, hour, total, stageName, dcData } = getCurrentStageData();
  
  const totalEl = document.getElementById("total-obs");
  if (totalEl) {
    totalEl.textContent = total.toLocaleString(); 
  }

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

// ★背景画像更新関数
function updateBackgroundImage(stageName) {
  const bg = document.getElementById("stage-background");
  if (!bg) return;

  if (stageName === "ALL") {
    bg.style.backgroundImage = "none"; 
  } else {
    // マップからファイル名を取得
    const fileName = STAGE_IMAGE_MAP[stageName] || `${stageName}.jpg`;
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
              return `${val}人 (${percentage})`;
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
    return found ? found.total : 0;
  });

  drawSimpleBarChart(
    "hourChart",
    hours.map(h => `${h}時`),
    counts,
    '観測数',
    '#90cdf4'
  );
}

function renderDamageChart(jobData) {
  // ▼▼▼ 設定部分 ▼▼▼
  const chartTitle = "平均DPM";
  const barColor = "#FC8181"; // 攻撃的なパステルレッド

  const method = "avg"; // 平均値を使用
  
  // ▼▼▼ データ計算部分 ▼▼▼
  const filtered = jobData
    .filter(d => d.total >= 1)
    .map(d => {
      // 勝ち/負け/全体の切り替えに対応
      const prefix = (currentDamageViewMode === "WIN") ? "w_" : (currentDamageViewMode === "LOSE") ? "l_" : "";
      
      // ダメージと試合時間(秒)を取得
      const dmgVal = d[`${prefix}${method}Damage`] || 0;
      const timeVal = d[`${prefix}${method}MatchTime`] || 0;

      // 時間を「分」に変換（0秒の場合はエラー回避で1とする）
      const minutes = (timeVal > 0) ? timeVal / 60 : 1;
      
      // DPM = ダメージ ÷ 分
      const dpm = dmgVal / minutes;

      return { 
        ...d, 
        _val: dpm 
      };
    })
    .sort((a, b) => b._val - a._val); // 高い順に並び替え

  const labels = filtered.map(d => JOB_META[d.job]?.jp || d.job);
  
  // 整数に丸めて表示
  const data = filtered.map(d => Math.round(d._val));

  // グラフ描画
  drawSimpleBarChart(
    "damageChart",
    labels,
    data,
    chartTitle,
    barColor
  );
  
  // カードの見出し(h2)も自動で書き換える
  const titleEl = document.querySelector("#damageChart").closest(".chart-card").querySelector("h2");
  if(titleEl) titleEl.innerText = chartTitle;
}

function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  
  // レート化を含む取得（テーブル専用）
  const val = (d, key) => getTableMetric_(d, key);

  let list = jobData.map(d => {
    const meta = JOB_META[d.job] || {};

    // 現在のモードに合わせて表示する件数(N)を切り替える
    let currentCount = d.total;
    if (currentTableViewMode === "WIN") currentCount = d.wins;
    else if (currentTableViewMode === "LOSE") currentCount = d.losses;

    return {
      name: meta.jp || d.job, 
      jobKey: d.job, 
      sortOrder: meta.order || 999, 
      role: meta.role || "unknown",
      
      count: currentCount,
      
      winRate: d.total ? (d.wins / d.total) * 100 : 0,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      
      statK: val(d, "K"),
      statD: val(d, "D"),
      statA: val(d, "A"),
      statDmg: val(d, "Damage"),
      statTaken: val(d, "Taken"),
      statHeal: val(d, "Heal"),
      statTime: val(d, "Time"),
      statMatchTime: getStatValue(d, "MatchTime", currentTableViewMode) // MatchTimeは常に生の秒
    };
  });

  list.sort((a, b) => {
    if (currentTableSortKey === "job") {
      return (currentTableSortDesc ? b.sortOrder - a.sortOrder : a.sortOrder - b.sortOrder);
    }
    
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

  const fmt2 = (n) => Number(n || 0).toFixed(2);
  const fmtInt = (n) => Math.round(Number(n || 0)).toLocaleString();
  const fmtT = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  const isRate = (currentRateMode !== "RAW");

  list.forEach(d => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td style="text-align:left;">
        <span class="clickable-job" onclick="openModal('${d.jobKey}')" style="background-color:${ROLE_COLORS[d.role]}; padding:6px 14px; border-radius:20px; color:#546E7A; font-weight:bold;">
          ${d.name} <span style="font-size:0.85em; font-weight:normal; opacity:0.8;">(${d.count})</span>
        </span>
      </td>
      
      <td class="${d.winRate >= 50 ? 'rate-high' : 'rate-low'}">${d.winRate.toFixed(1)}%</td>
      <td>${d.pickRate.toFixed(1)}%</td>
      <td>${fmt2(d.statK)}</td>
      <td>${fmt2(d.statD)}</td>
      <td>${fmt2(d.statA)}</td>
      <td style="font-weight:bold; color:#d69e2e;">${isRate ? fmt2(d.statDmg) : fmtInt(d.statDmg)}</td>
      <td style="font-weight:bold; color:#e53e3e;">${isRate ? fmt2(d.statTaken) : fmtInt(d.statTaken)}</td>
      <td style="font-weight:bold; color:#38a169;">${isRate ? fmt2(d.statHeal) : fmtInt(d.statHeal)}</td>
      <td style="font-weight:bold; color:#718096;">${isRate ? fmt2(d.statTime) : fmtT(d.statTime)}</td>
      <td style="font-weight:bold; color:#607D8B;">${fmtT(d.statMatchTime)}</td>
    `;
    tbody.appendChild(tr);
  });

  ths.forEach(th => {
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);

    // 1. 古い矢印（▲や▼）があれば消して元の名前に戻す
    newTh.textContent = newTh.textContent.replace(/[▲▼]/g, '');

    // 2. 現在選択中の列なら色＋矢印
    if (newTh.dataset.key === currentTableSortKey) {
      newTh.style.backgroundColor = "#B3E5FC";
      const arrow = currentTableSortDesc ? " ▼" : " ▲"; 
      newTh.textContent += arrow;
    } else {
      newTh.style.backgroundColor = "";
    }

    newTh.addEventListener("click", () => {
      // 同じ列なら反転、違う列なら切り替え
      if (currentTableSortKey === newTh.dataset.key) {
         currentTableSortDesc = !currentTableSortDesc;
      } else { 
         currentTableSortKey = newTh.dataset.key; 
         // ジョブ以外は「降順(true)」からスタート
         currentTableSortDesc = (newTh.dataset.key !== "job"); 
      }
      refreshTableOnly();
    });
  });
  
}

// --- モーダル（レート表示対応版） ---
function openModal(jobKey) {
  const { data } = getCurrentStageData();
  const d = data.find(j => j.job === jobKey);
  if (!d) return;

  document.getElementById("modal-job-name").textContent = (JOB_META[d.job]?.jp || d.job) + " の詳細データ";
  
  const fmtInt = (n) => Math.round(Number(n || 0)).toLocaleString();
  const fmt2 = (n) => Number(n || 0).toFixed(2);
  const fmtT = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  
  const method = currentStatMethod; 
  const isRate = (currentRateMode !== "RAW");

  const makeR = (labelTitle, rowClass, viewModePrefix) => {
    const getRaw = (k) => d[`${viewModePrefix}${method}${k}`] || 0;

    // この行（全体/勝利/敗北）ごとのMatchTimeと件数を取得
    const rawMT = getRaw("MatchTime");
    const count = (viewModePrefix === "w_") ? d.wins : (viewModePrefix === "l_") ? d.losses : d.total;

    // データがない場合は「データなし」を表示
    if (count === 0) {
      return `<tr class="${rowClass}"><td>${labelTitle}</td><td colspan="8">データなし</td></tr>`;
    }

    // 各行のMatchTimeに合わせて倍率を計算
    let factor = 1;
    if (isRate && rawMT > 0) {
      const base = (currentRateMode === "PER5") ? 300 : 60;
      factor = base / rawMT;
    }

    const getVal = (k) => {
      const raw = getRaw(k);
      return (k === "MatchTime") ? raw : raw * factor;
    };

    return `
      <tr class="${rowClass}">
        <td>${labelTitle}</td>
        <td>${fmt2(getVal("K"))}</td>
        <td>${fmt2(getVal("D"))}</td>
        <td>${fmt2(getVal("A"))}</td>
        <td style="color:#d69e2e">${isRate ? fmt2(getVal("Damage")) : fmtInt(getVal("Damage"))}</td>
        <td style="color:#e53e3e">${isRate ? fmt2(getVal("Taken")) : fmtInt(getVal("Taken"))}</td>
        <td style="color:#38a169">${isRate ? fmt2(getVal("Heal")) : fmtInt(getVal("Heal"))}</td>
        <td style="color:#718096">${isRate ? fmt2(getVal("Time")) : fmtT(getVal("Time"))}</td>
        <td style="color:#607D8B">${fmtT(getRaw("MatchTime"))}</td>
      </tr>`;
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

        // スタイル定義
        const baseStyle = `width:32px; height:32px; cursor:pointer; border-radius:6px; transition:0.2s; padding:2px;`;
       
        if (isON) {
          // ONの状態
          const role = JOB_META[key]?.role || "unknown";
          const borderCol = 
            role === "tank" ? "#63b3ed" : 
            role === "healer" ? "#48bb78" : 
            role === "dps" ? "#f687b3" : "#a0aec0";
          img.style.cssText = baseStyle + `border:2px solid ${borderCol}; background:#fff; opacity:1; filter:none; transform:scale(1); box-shadow:0 1px 3px rgba(0,0,0,0.1);`;
        } else {
          // OFFの状態
          img.style.cssText = baseStyle + `border:2px solid #e2e8f0; background:transparent; opacity:0.4; filter:grayscale(100%); transform:scale(0.9);`;
        }

        img.onclick = () => toggleSingleJob(key);

        if (isON) { 
          // マウスが乗った時
          img.onmouseenter = () => {
            if (!jobScatterChartInstance) return;
            
            const dataset = jobScatterChartInstance.data.datasets[0];
            const dataIndex = activePoints.findIndex(p => p.jobKey === key);

            dataset.pointStyle = activePoints.map(p => {
              return p.jobKey === key ? iconAssets[p.jobKey].normal : iconAssets[p.jobKey].faded;
            });
            dataset.radius = activePoints.map(p => {
              return p.jobKey === key ? (ICON_SIZE / 2) + 5 : (ICON_SIZE / 2);
            });

            if (dataIndex >= 0) {
              jobScatterChartInstance.tooltip.setActiveElements([{ datasetIndex: 0, index: dataIndex }]);
              jobScatterChartInstance.setActiveElements([{ datasetIndex: 0, index: dataIndex }]);
            }

            jobScatterChartInstance.update();
          };

          // マウスが離れた時
          img.onmouseleave = () => {
            if (!jobScatterChartInstance) return;

            const dataset = jobScatterChartInstance.data.datasets[0];

            dataset.pointStyle = activePoints.map(p => iconAssets[p.jobKey].normal);
            dataset.radius = ICON_SIZE / 2;

            jobScatterChartInstance.tooltip.setActiveElements([], {x: 0, y: 0});
            jobScatterChartInstance.setActiveElements([]);

            jobScatterChartInstance.update();
          };
        }
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

// ★ランクフィルターのUI（ボタン）を生成する関数
function initRankFilter() {
  const container = document.getElementById("rank-selector-container");
  if (!container) return;

  container.innerHTML = "";

  // 一括操作ボタン
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex; gap:5px; margin-right:10px; border-right:2px solid #e2e8f0; padding-right:10px;";
  const createAllBtn = (label, state) => {
    const btn = document.createElement("button");
    btn.className = "rank-btn";
    btn.style.cssText = "font-size:0.7rem; padding:2px 8px;";
    btn.textContent = label;
    btn.onclick = () => {
      Object.keys(rankFilterState).forEach(k => rankFilterState[k] = state);
      initRankFilter();
      aggregateAndRender();
    };
    return btn;
  };
  controls.appendChild(createAllBtn("ALL ON", true));
  controls.appendChild(createAllBtn("ALL OFF", false));
  container.appendChild(controls);

  // 各ランクボタンの生成
  Object.keys(RANK_META).forEach(key => {
    const btn = document.createElement("button");
    btn.className = `rank-btn ${rankFilterState[key] ? 'active' : ''}`;
    
    // アイコン画像の追加
    const icon = document.createElement("img");
    icon.src = `img/${RANK_META[key].img}`;
    icon.style.cssText = "width:20px; height:20px; vertical-align:middle; margin-right:5px;";
    
    // OFFの時は画像を白黒にする
    if (!rankFilterState[key]) {
      icon.style.filter = "grayscale(100%) opacity(0.6)";
      btn.style.background = "#f1f5f9";
    } else {
      const [c1, c2] = RANK_META[key].colors;
      btn.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    }

    btn.appendChild(icon);

    const text = document.createElement("span");
    text.style.textShadow = `
-0.4px -0.4px 0 #fff,
   0.4px -0.4px 0 #fff,
  -0.4px  0.4px 0 #fff,
   0.4px  0.4px 0 #fff,
   0px  -0.4px 0 #fff,
   0px   0.4px 0 #fff,
  -0.4px  0px  0 #fff,
   0.4px  0px  0 #fff
`;

    text.textContent = RANK_META[key].label;
    btn.appendChild(text);

    btn.onclick = () => {
      rankFilterState[key] = !rankFilterState[key];
      initRankFilter();
      aggregateAndRender();
    };
    container.appendChild(btn);
  });
}

// 選択されたランクのデータを合算して描画する
function aggregateAndRender() {
  if (!rawGlobalDataByRank) return;

  const selected = Object.keys(rankFilterState).filter(k => rankFilterState[k]);
  
  // 1. 合算用の空の箱（テンプレート）を用意
  const merged = {
    meta: { total: 0, wins: 0, losses: 0 },
    byJob: {},
    byStageJob: {},
    byHour: {},
    byStageHour: {}, // ★ここがステージ別時間の箱
    byDC: { "Elemental": 0, "Gaia": 0, "Mana": 0, "Meteor": 0 },
    byStageDC: {}
  };

  // 2. 選ばれた各ランクのデータをループで全部足していく
  selected.forEach(rank => {
    const rd = rawGlobalDataByRank[rank];
    if (!rd) return;

    merged.meta.total += rd.total;
    merged.meta.wins += rd.wins;
    merged.meta.losses += rd.losses;

    // DC分布の合算
    Object.keys(rd.byDC).forEach(dc => merged.byDC[dc] += rd.byDC[dc]);
    
    // ステージ別DCの合算
    Object.keys(rd.byStageDC).forEach(stage => {
      if (!merged.byStageDC[stage]) merged.byStageDC[stage] = { "Elemental": 0, "Gaia": 0, "Mana": 0, "Meteor": 0 };
      Object.keys(rd.byStageDC[stage]).forEach(dc => merged.byStageDC[stage][dc] += rd.byStageDC[stage][dc]);
    });

    // 時間帯（全体）の合算
    Object.keys(rd.byHour).forEach(h => {
      if (!merged.byHour[h]) merged.byHour[h] = { total: 0, wins: 0 };
      merged.byHour[h].total += rd.byHour[h].total;
      merged.byHour[h].wins += rd.byHour[h].wins;
    });

    // ステージ別時間の合算
    if (rd.byStageHour) {
      Object.keys(rd.byStageHour).forEach(shKey => {
        if (!merged.byStageHour[shKey]) merged.byStageHour[shKey] = { total: 0, wins: 0 };
        merged.byStageHour[shKey].total += rd.byStageHour[shKey].total;
        merged.byStageHour[shKey].wins += rd.byStageHour[shKey].wins;
      });
    }

    // ジョブ・ステージジョブの合算（中央値用配列含む）
    mergeSubtotals_(merged.byJob, rd.byJob);
    mergeSubtotals_(merged.byStageJob, rd.byStage);
  });

  // --- 統計カードの更新 ---
  const totalObs = merged.meta.total;
  if (document.getElementById("total-obs")) {
    document.getElementById("total-obs").textContent = totalObs.toLocaleString();
  }
  if (document.getElementById("data-coverage") && window.grandTotal > 0) {
    const coverage = ((totalObs / window.grandTotal) * 100).toFixed(1);
    document.getElementById("data-coverage").textContent = `${coverage}%`;
  }

  // 3. 合算した生データを、グラフや表で使える形式（globalData）に変換
  globalData = {
    meta: { ...merged.meta, winRate: merged.meta.total ? merged.meta.wins / merged.meta.total : 0 },
    byDC: merged.byDC,
    byStageDC: merged.byStageDC,
    byJob: finalizeStats_(merged.byJob),
    byStageJob: finalizeStats_(merged.byStageJob, true),
    byHour: Object.keys(merged.byHour).map(h => ({ 
      hour: Number(h), 
      total: merged.byHour[h].total, 
      winRate: merged.byHour[h].total ? merged.byHour[h].wins / merged.byHour[h].total : 0 
    })),
    // ステージ別時間の配列化
    byStageHour: Object.keys(merged.byStageHour).map(key => {
      const [stage, hour] = key.split("\t");
      const dd = merged.byStageHour[key];
      return { stage, hour: Number(hour), total: dd.total, winRate: dd.total ? dd.wins / dd.total : 0 };
    }),
    byStage: calculateStageTotals_(merged.byStageJob)
  };

  // 4. 画面を更新
  updateDashboard();
  if (globalData && globalData.byStage) {
    initStageSelector(globalData.byStage);
  }
}


// --- 補助関数：オブジェクトの合算 ---
function mergeSubtotals_(target, source) {
  Object.keys(source).forEach(key => {
    if (!target[key]) target[key] = createEmptyMergeObj_();
    const t = target[key];
    const s = source[key];

    // 全体の基本数
    t.total += s.total; t.wins += s.wins; t.losses += s.losses;
    
    // 全体の小計
    t.sumK += s.sumK; t.sumD += s.sumD; t.sumA += s.sumA;
    t.sumDmg += s.sumDmg; t.sumTaken += s.sumTaken; t.sumHeal += s.sumHeal;
    t.sumTime += s.sumTime; t.sumMatchTime += s.sumMatchTime;

    const metrics = ["K", "D", "A", "Dmg", "Taken", "Heal", "Time", "MatchTime"];
    metrics.forEach(m => {
      t[`w${m}`] += (s[`w${m}`] || 0);
      t[`l${m}`] += (s[`l${m}`] || 0);
    });

    metrics.forEach(k => {
      t[`arr${k}`] = t[`arr${k}`].concat(s[`arr${k}`] || []);
      t[`w_arr${k}`] = t[`w_arr${k}`].concat(s[`w_arr${k}`] || []);
      t[`l_arr${k}`] = t[`l_arr${k}`].concat(s[`l_arr${k}`] || []);
    });
  });
}

// --- 補助関数：最終的な統計値を算出（平均・中央値） ---
function finalizeStats_(map, isStageJob = false) {
  return Object.keys(map).map(key => {
    const p = map[key];
    const div = (s, n) => n ? s / n : 0;
    
    const res = {
      total: p.total, wins: p.wins, losses: p.losses,
      winRate: div(p.wins, p.total),
      // --- 平均値 ---
      avgK: div(p.sumK, p.total), avgD: div(p.sumD, p.total), avgA: div(p.sumA, p.total),
      avgDamage: div(p.sumDmg, p.total), avgTaken: div(p.sumTaken, p.total),
      avgHeal: div(p.sumHeal, p.total), avgTime: div(p.sumTime, p.total),
      avgMatchTime: div(p.sumMatchTime, p.total),
    };

    // --- 中央値の計算を一気に回す ---
    const metrics = [
      { k: "K", target: "K" }, { k: "D", target: "D" }, { k: "A", target: "A" },
      { k: "Dmg", target: "Damage" }, { k: "Taken", target: "Taken" },
      { k: "Heal", target: "Heal" }, { k: "Time", target: "Time" },
      { k: "MatchTime", target: "MatchTime" }
    ];

    metrics.forEach(m => {
      res[`median${m.target}`] = jsCalcMedian(p[`arr${m.k}`]);
      res[`w_median${m.target}`] = jsCalcMedian(p[`w_arr${m.k}`]);
      res[`l_median${m.target}`] = jsCalcMedian(p[`l_arr${m.k}`]);
      
      // 勝ち・負けの「平均」もテーブルで使うからここで計算
      res[`w_avg${m.target}`] = div(p[`w${m.k}`], p.wins);
      res[`l_avg${m.target}`] = div(p[`l${m.k}`], p.losses);
    });

    if (isStageJob) {
      const [stage, job] = key.split("\t");
      res.stage = stage; res.job = job;
    } else {
      res.job = key;
    }
    return res;
  });
}

function jsCalcMedian(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function createEmptyMergeObj_() {
  const obj = {
    total: 0, wins: 0, losses: 0,
    sumK: 0, sumD: 0, sumA: 0, sumDmg: 0, sumTaken: 0, sumHeal: 0, sumTime: 0, sumMatchTime: 0,
    wK: 0, wD: 0, wA: 0, wDmg: 0, wTaken: 0, wHeal: 0, wTime: 0, wMatchTime: 0,
    lK: 0, lD: 0, lA: 0, lDmg: 0, lTaken: 0, lHeal: 0, lTime: 0, lMatchTime: 0
  };
  const keys = ["K", "D", "A", "Dmg", "Taken", "Heal", "Time", "MatchTime"];
  keys.forEach(k => {
    obj[`arr${k}`] = [];
    obj[`w_arr${k}`] = [];
    obj[`l_arr${k}`] = [];
  });
  return obj;
}

function calculateStageTotals_(stageJobMap) {
  const sMap = {};
  Object.keys(stageJobMap).forEach(key => {
    const stage = key.split("\t")[0];
    if (!sMap[stage]) sMap[stage] = { stage, total: 0, wins: 0 };
    sMap[stage].total += stageJobMap[key].total;
    sMap[stage].wins += stageJobMap[key].wins;
  });
  return Object.values(sMap);
}
