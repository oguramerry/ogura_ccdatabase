
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

  // ★ここに追加: 更新ボタンのイベントリスナー
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      // 連打防止：すでにロード中なら何もしない
      if (refreshBtn.classList.contains("loading")) return;

try {
        refreshBtn.classList.add("loading"); // くるくる開始
        await fetchGlobalData();             // データ再取得
      } catch (e) {
        console.error("更新に失敗しました", e);
        alert("データの更新に失敗しました");
      } finally {
        // 少し余韻を持たせてから止める（0.5秒後）
        setTimeout(() => {
          refreshBtn.classList.remove("loading");
        }, 500);
      }
    });
  }
  
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
  
  // 表示用：10で割って試合数とする
  if (totalEl) totalEl.textContent = `${Math.floor(total / 10)} 試合`;
  
  // renderJobPieChart に total（分母）を渡す
  renderJobPieChart(data, total);
  
  renderRoleAnalysisChart(data, total);
  renderHourChart(hour);
  renderDamageChart(data);
  renderJobTable(data, total);
  
  // 散布図の更新
  renderJobScatterChart(data, total);
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
function renderJobPieChart(jobData, totalPlayers) {
  resetCanvas("jobPieChart");
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  
  // 多い順にソート
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  
  // 上位8ジョブ ＋ その他 にまとめる
  const topList = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.total, 0);
  
  // ★計算ロジック変更：人数(total) から 使用率(%) を算出
  // totalPlayers が 0 の場合はエラー回避で 0 を返す
  const toRate = (val) => totalPlayers > 0 ? ((val / totalPlayers) * 100).toFixed(1) : 0;

  // データ配列を作成（中身はパーセンテージの数値になる）
  const chartValues = [
    ...topList.map(d => toRate(d.total)),
    ...(otherTotal > 0 ? [toRate(otherTotal)] : [])
  ];

  // ラベル配列を作成
  const chartLabels = [
    ...topList.map(d => JOB_META[d.job]?.jp || d.job),
    ...(otherTotal > 0 ? ["その他"] : [])
  ];
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartValues, // ここに％が入る
        backgroundColor: ['#63b3ed', '#4fd1c5', '#f6e05e', '#f687b3', '#9f7aea', '#ed8936', '#a0aec0', '#48bb78', '#cbd5e0'],
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
            // ツールチップに「%」を付けて分かりやすくする
            label: function(context) {
              let label = context.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed !== null) {
                label += context.parsed + '%';
              }
              return label;
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

  // 1. DPSの内訳定義
  const MELEE = ["MNK", "DRG", "NIN", "SAM", "RPR", "VPR"];
  const RANGE = ["BRD", "MCH", "DNC"];
  const CASTER = ["BLM", "SMN", "RDM", "PCT"];

  // 2. 集計用ボックスの作成（5区分）
  // bg: 棒グラフの背景色, color: 棒グラフの枠線色
  const roles = {
    tank:   { wins: 0, total: 0, label: "タンク",   color: "#63b3ed", bg: "#E3F2FD" },
    healer: { wins: 0, total: 0, label: "ヒーラー", color: "#48bb78", bg: "#E8F5E9" },
    melee:  { wins: 0, total: 0, label: "メレー",   color: "#f56565", bg: "#FED7D7" },
    range:  { wins: 0, total: 0, label: "レンジ",   color: "#ed8936", bg: "#FEEBC8" },
    caster: { wins: 0, total: 0, label: "キャスター", color: "#9f7aea", bg: "#E9D8FD" }
  };

  // 3. データの振り分け
  jobData.forEach(d => {
    const meta = JOB_META[d.job];
    const r = meta?.role; // "tank", "healer", "dps"

    if (r === "tank") {
      roles.tank.wins += d.wins;
      roles.tank.total += d.total;
    } else if (r === "healer") {
      roles.healer.wins += d.wins;
      roles.healer.total += d.total;
    } else if (r === "dps") {
      // DPSの場合はジョブ名でさらに細かく分類
      if (MELEE.includes(d.job)) {
        roles.melee.wins += d.wins;
        roles.melee.total += d.total;
      } else if (RANGE.includes(d.job)) {
        roles.range.wins += d.wins;
        roles.range.total += d.total;
      } else if (CASTER.includes(d.job)) {
        roles.caster.wins += d.wins;
        roles.caster.total += d.total;
      }
    }
  });

  // 4. チャート用データ生成
  const labels = Object.values(roles).map(r => r.label);
  const winRates = Object.values(roles).map(r => r.total ? Number((r.wins / r.total * 100).toFixed(1)) : 0);
  const pickRates = Object.values(roles).map(r => totalMatches ? Number((r.total / totalMatches * 100).toFixed(1)) : 0);
  const bgColors = Object.values(roles).map(r => r.bg);
  const borderColors = Object.values(roles).map(r => r.color);

  // 5. 描画
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '平均勝率 (%)',
          data: winRates,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 8,
          yAxisID: 'yWin',
          order: 2
        },
        {
          label: '人口比率 (%)',
          data: pickRates,
          type: 'line', // 人口比率は折れ線で表示
          borderColor: '#4a5568',
          borderWidth: 3,
          fill: false,
          yAxisID: 'yPop',
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
          grid: { drawOnChartArea: false },
          title: { display: true, text: '人口比率 (%)' }
        }
      },
      plugins: {
        legend: { position: 'bottom' }
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
勝率 ${winRate}%　<br>
使用率 ${pickRate}%<br>
          使用回数 ${matches}
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


// --- ヘルパー関数：画像を強制的に指定サイズにリサイズする ---
function createResizedIcon(img, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  // 画像を指定サイズに縮小して描画
  ctx.drawImage(img, 0, 0, size, size);
  return c;
}

// --- ヘルパー関数：半透明のアイコンを生成する ---
function createFadedIcon(sourceCanvas) {
  const c = document.createElement('canvas');
  c.width = sourceCanvas.width;
  c.height = sourceCanvas.height;
  const ctx = c.getContext('2d');
  ctx.globalAlpha = 0.15; // 薄さの調整
  ctx.drawImage(sourceCanvas, 0, 0);
  return c;
}

// --- メイン関数：散布図の描画（アイコン配置変更版） ---
function renderJobScatterChart(jobData, totalMatches) {
  // ★アイコンのサイズ（直径 px）
  const ICON_SIZE = 50; 

  // グループ定義（キーで呼び出せるようにオブジェクト化）
  const groupsData = {
    TANK:   { label: "TANK",   jobs: ["PLD", "WAR", "DRK", "GNB"] },
    HEALER: { label: "HEALER", jobs: ["WHM", "SCH", "AST", "SGE"] },
    MELEE:  { label: "MELEE",  jobs: ["MNK", "DRG", "NIN", "SAM", "RPR", "VPR"] },
    RANGE:  { label: "RANGE",  jobs: ["BRD", "MCH", "DNC"] },
    CASTER: { label: "CASTER", jobs: ["BLM", "SMN", "RDM", "PCT"] }
  };

  const canvas = document.getElementById("jobScatterChart");
  const iconContainer = document.getElementById("job-scatter-icons");
  if (!canvas || !iconContainer) return;

  // コンテナの初期化（レイアウト用のスタイル適用）
  iconContainer.innerHTML = "";
  iconContainer.style.display = "flex";
  iconContainer.style.gap = "30px";           // 左カラムと右カラムの間隔
  iconContainer.style.justifyContent = "center";
  iconContainer.style.alignItems = "flex-start"; // 上揃え
  iconContainer.style.flexWrap = "wrap";      // 画面が狭いときは折り返す

  const points = jobData
    .filter(d => d.total > 0 && JOB_META[d.job])
    .map(d => {
      const matches = d.total; 
      const winRate = d.total ? (d.wins / d.total) * 100 : 0;
      const pickRate = totalMatches ? (d.total / totalMatches) * 100 : 0;
      const role = JOB_META[d.job]?.role || "unknown";
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

  Promise.all(points.map(p => loadJobIcon(p.jobKey))).then((loadedImages) => {
    
    // アイコン画像の準備
    const iconAssets = {};
    points.forEach((p, i) => {
      const img = loadedImages[i];
      if (img) {
        const resized = createResizedIcon(img, ICON_SIZE);
        const faded = createFadedIcon(resized);
        iconAssets[p.jobKey] = { normal: resized, faded: faded };
      }
    });

    // チャートの描画（リセット＆再作成）
    resetCanvas("jobScatterChart");
    const ctx = document.getElementById("jobScatterChart").getContext("2d");

    if (jobScatterChartInstance) {
      try { jobScatterChartInstance.destroy(); } catch (_) {}
    }

    let lastHoveredIndex = null;
    
    // ホバー時のスタイル更新関数
    const updateStyles = (hoveredIndex) => {
      if (lastHoveredIndex === hoveredIndex) return;
      lastHoveredIndex = hoveredIndex;
      const ds = jobScatterChartInstance.data.datasets[0];
      if (hoveredIndex === null) {
        ds.pointStyle = points.map(p => iconAssets[p.jobKey]?.normal);
      } else {
        ds.pointStyle = points.map((p, i) => {
          return i === hoveredIndex ? iconAssets[p.jobKey]?.normal : iconAssets[p.jobKey]?.faded;
        });
      }
      jobScatterChartInstance.update("none");
    };

    // チャート本体の生成
    jobScatterChartInstance = new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: [{
          label: "jobs",
          data: points.map(p => ({ x: p.pickRate, y: p.winRate, r: ICON_SIZE / 2, ...p })),
          pointStyle: points.map(p => iconAssets[p.jobKey]?.normal),
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
            suggestedMax: Math.max(...points.map(p => p.pickRate)) * 1.15
          },
          y: { 
            title: { display: true, text: "勝率 (%)" },
            suggestedMin: Math.min(...points.map(p => p.winRate)) - 5,
            suggestedMax: Math.max(...points.map(p => p.winRate)) + 5
          }
        },
        onHover: (evt, elements) => {
          const activeIndex = (elements && elements.length) ? elements[0].index : null;
          updateStyles(activeIndex);
          evt.native.target.style.cursor = activeIndex !== null ? "pointer" : "default";
        },
        onClick: (_evt, elements, chart) => {
          if (!elements || !elements.length) return;
          const raw = chart.data.datasets[0].data[elements[0].index];
          if (raw && raw.jobKey) openModal(raw.jobKey);
        }
      }
    });

    // --- アイコン一覧のレイアウト生成 ---

    // ヘルパー: 1つのグループ（例：TANK行）のHTML要素を作る関数
    const createGroupRow = (group) => {
      const groupPoints = points.filter(p => group.jobs.includes(p.jobKey));
      if (groupPoints.length === 0) return null;

      const row = document.createElement("div");
      // 各行のデザイン
      row.style.cssText = "display:flex; align-items:center; gap:12px; margin-bottom:12px;";

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
          if(jobScatterChartInstance) jobScatterChartInstance.tooltip.setActiveElements([{ datasetIndex: 0, index: globalIndex }], { x: 0, y: 0 });
        };
        img.onmouseleave = () => {
          img.style.transform = "scale(1)";
          img.style.boxShadow = "none";
          updateStyles(null);
          if(jobScatterChartInstance) jobScatterChartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
        };
        img.onclick = () => openModal(p.jobKey);
        iconsDiv.appendChild(img);
      });
      row.appendChild(iconsDiv);
      return row;
    };

    // 1. 左カラムを作る（TANK, HEALER）
    const leftCol = document.createElement("div");
    leftCol.style.display = "flex";
    leftCol.style.flexDirection = "column";

    const tankRow = createGroupRow(groupsData.TANK);
    if(tankRow) leftCol.appendChild(tankRow);

    const healerRow = createGroupRow(groupsData.HEALER);
    if(healerRow) leftCol.appendChild(healerRow);


    // 2. 右カラムを作る
    const rightCol = document.createElement("div");
    rightCol.style.display = "flex";
    rightCol.style.flexDirection = "column";

    // 2-a. 右上の段（MELEE と RANGE を横に並べる）
    const rightTopRow = document.createElement("div");
    rightTopRow.style.display = "flex";
    rightTopRow.style.gap = "20px"; // メレーとレンジの間隔
    rightTopRow.style.flexWrap = "wrap";

    const meleeRow = createGroupRow(groupsData.MELEE);
    if(meleeRow) rightTopRow.appendChild(meleeRow);

    const rangeRow = createGroupRow(groupsData.RANGE);
    if(rangeRow) rightTopRow.appendChild(rangeRow);

    rightCol.appendChild(rightTopRow);

    // 2-b. 右下の段（CASTER）※メレーの下に配置
    const casterRow = createGroupRow(groupsData.CASTER);
    if(casterRow) rightCol.appendChild(casterRow);


    // コンテナに追加
    iconContainer.appendChild(leftCol);
    iconContainer.appendChild(rightCol);

  });
}
