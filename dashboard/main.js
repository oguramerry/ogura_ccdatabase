// main.js

// ==========================================
// ■ マップローテーション設定 (CC_CONFIG)
//   将来仕様が変わったらここを直すだけ！
// ==========================================
const CC_CONFIG = {
  ANCHOR_EPOCH: 1769094000000, 
  
  // 1サイクルの時間 (90分)
  CYCLE_MS: 90 * 60 * 1000,
  
  // 計算用ローテーション順 (基準日のマップから開始)
ROTATION: [
"Cloud Nine",
"Red Sands",
"Palaistra",
"Volcanic Heart",
"Clockwork Castletown",
"Bayside Battleground"
]
  };

const GAS_BASE = "https://script.google.com/macros/s/AKfycbyqUe1owS384-HR_mirZSmZZxKQdZLrNBIUJL07AzvRmsMR62cgrbR5VcilJBfLRdzpiA/exec";

let matchChartInstance = null;
const now = new Date();

// 今日の日付 (YYYY-MM-DD)
let currentDate = (() => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
})();

let availableDates = [];
let currentUserForApi = "";
let resultByDate = {};
let viewYear = now.getFullYear();
let viewMonth = now.getMonth();

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("userInput");
  const tabs = document.getElementById("tabButtons");
  const clearBtn = document.getElementById("clearInput");
  const panelInner = document.getElementById("panelInner");

  let statsData = null;
  let activeTab = "main";

  // クリアボタンの初期化
  if (clearBtn) clearBtn.style.display = "none";

  let inputTimer = null;

 
// --- inputイベント ---
  input?.addEventListener("input", (e) => {
    const val = e.target.value;
    const user = val.trim();
    currentUserForApi = user.replace(/\s+/g, "");

    // 1. クリアボタンの表示/非表示（即時反映）
    if (clearBtn) {
      clearBtn.style.display = val.length > 0 ? "block" : "none";
    }

    // 進行中のタイマーがあれば一旦止める
    clearTimeout(inputTimer);

    // 2. 入力が「空」になった場合：特急券で即実行！
    if (!currentUserForApi) {
      // 即座に全ユーザーリストを取得し直す（これでプルダウンが復活する）
      fetchUsers(""); 

      // グラフや表示も即座にリセット
      if (matchChartInstance) {
        matchChartInstance.data.datasets[0].data = [];
        matchChartInstance.update();
      }
      const resultEl = document.getElementById("result");
      if (resultEl) resultEl.textContent = "試合数 - / 勝率 -";
      
      return; // ここで処理を終える
    }

    // 3. 文字が入っている場合：0.3秒待ってから検索（タイマーを使用）
    inputTimer = setTimeout(() => {
      fetchUsers(user);
      
      ensureEmptyChart();

      // 統計情報の取得（JSONP）
      const old = document.getElementById("jsonpStats");
      if (old) old.remove();
      const s = document.createElement("script");
      s.id = "jsonpStats";
      s.src = `${GAS_BASE}?action=stats&user=${encodeURIComponent(currentUserForApi)}&callback=handleStatsJsonp&_=${Date.now()}`;
      document.body.appendChild(s);

      fetchAvailableDates(currentUserForApi);
    }, 300); 
  });

  // --- クリアボタンクリック時の動作 ---
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    currentUserForApi = "";
    clearBtn.style.display = "none";
    if (matchChartInstance) {
      matchChartInstance.data.datasets[0].data = [];
      matchChartInstance.update();
    }
    const resultEl = document.getElementById("result");
    if (resultEl) resultEl.textContent = "試合数 - / 勝率 -";
    input.focus();
  });

  // --- カレンダー制御 ---
  const updateCalendarDisplay = () => {
    const titleEl = document.getElementById("calTitle");
    if (titleEl) {
      titleEl.textContent = `${viewYear}年 ${viewMonth + 1}月`;
    }
    buildCalendar(viewYear, viewMonth);
    applyCalendarColors();
  };

  document.getElementById("calPrev")?.addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    updateCalendarDisplay();
  });

  document.getElementById("calNext")?.addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    updateCalendarDisplay();
  });

  // --- タブ制御 ---
const render = () => {
  if (!panelInner || !statsData) return;
  let html = "";
  if (window.TabRenderer && window.TabRenderer[activeTab]) {
    html = window.TabRenderer[activeTab](statsData);
  }
  panelInner.innerHTML = html;

    if (activeTab === "time") {
    drawTimeChart(statsData);
  }

  // Job*Stageタブの時だけの特別処理
  if (activeTab === "jobStage") {
    const ribbon = panelInner.querySelector('.stage-selector-ribbon');
    const container = document.getElementById('job-stage-detail-container');
    
    ribbon?.addEventListener('click', (e) => {
      const btn = e.target.closest('.stage-ribbon-btn');
      if (!btn) return;

      // ボタンの見た目（active）を切り替え
      ribbon.querySelectorAll('.stage-ribbon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 中身のグリッドを生成して表示
      const stageJp = btn.dataset.stageJp;
      container.innerHTML = window.TabRenderer.renderJobStageGrid(stageJp, statsData);
    });

// 最初に「現在開催中ステージ」を選択状態にする
const schedule = getMapSchedule();
const keyNoSpace = (schedule?.currentKey || "").replace(/\s+/g, "");
const btnNow = keyNoSpace
  ? ribbon?.querySelector(`.stage-ribbon-btn.btn-${keyNoSpace}`)
  : null;

// 見つからなければ保険で先頭を選ぶ
(btnNow || ribbon?.querySelector(".stage-ribbon-btn"))?.click();

  }


  
  // ★Stageタブの時だけ強調表示とタイマーを開始する
  if (activeTab === "stage") {
    updateMapHighlight();
  }
};

  const setActiveTab = (tab) => {
    activeTab = tab;
    render();
  };

  if (tabs) {
tabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;

  // 見た目のactiveを切り替え
  tabs.querySelectorAll("button[data-tab]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  setActiveTab(btn.dataset.tab);
  }

  // --- JSONP コールバック関数群 ---
  window.handleStatsJsonp = (data) => {
    statsData = data;
    render();

    if (window.WeatherForecast) {
      WeatherForecast.render(data);
    }
    
    const m = data.meta;
    const resultEl = document.getElementById("result");
    if (resultEl) {
      resultEl.textContent =
        `試合数 ${m.total} / 勝率 ${m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-"}`;
    }
    // ランキング更新：ジョブ名は ui-parts.js の JOB_NAME_JP を使う
    updateTopRanking("topStageBody", data.byStage, (row) => `${row.stage}`);
    updateTopRanking("topJobBody", data.byJob, (row) => `${JOB_NAME_JP[row.job] ?? row.job}`);
    updateTopRanking("topHourBody", data.byHour, (row) => `${formatHourRange(row.hour)}`);
  };

  const updateTopRanking = (id, dataList, nameFn) => {
    const el = document.getElementById(id);
    if (el && dataList && dataList.length) {
      const ranking = dataList
        .filter(row => (row.total ?? 0) >= 5)
        .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
        .slice(0, 3);
      el.innerHTML = ranking.map((row, i) =>
        `${i + 1}位 ${nameFn(row)} 勝率 ${((row.winRate ?? 0) * 100).toFixed(1)}%（${row.total}試合）`
      ).join("<br>");
    }
  };

  window.handleUsersJsonp = (data) => {
    const list = document.getElementById("userList");
    if (!list) return;
    list.innerHTML = "";
    const users = data.users || [];
    for (const u of users) {
      const opt = document.createElement("option");
      opt.value = formatCharacterName(u);
      list.appendChild(opt);
    }
  };

  window.handleMatchHistoryJsonp = (data) => {
    console.log("届いたデータの中身:", data);
    const loader = document.getElementById("chartLoading");
    if (loader) loader.classList.remove("active");
    if (data.date !== currentDate) return;
    const points = data.points || [];

    const chartData = [];
    if (points.length > 0) {
      chartData.push({ x: 0, y: 0, isStart: true });
      points.forEach((p, i) => {
        chartData.push({
          x: i + 1,
          y: p.sum,
          result: p.result,
          time: p.time,
          job: p.job || p.Job || "",
          stage: p.stage || p.Stage || "",
          date: data.date
        });
      });
    }

    ensureEmptyChart();
    const ctx = document.getElementById("matchChart").getContext("2d");
    matchChartInstance.data.datasets[0].data = chartData;
    matchChartInstance.update();
  };

  window.handleAvailableDatesJsonp = (data) => {
    availableDates = [];
    const keys = Object.keys(resultByDate);
    for (const k of keys) delete resultByDate[k];
    const results = data.results || [];
    results.forEach(item => {
      availableDates.push(item.date);
      resultByDate[item.date] = { status: item.status, score: item.score };
    });
    updateCalendarDisplay();
    if (availableDates.includes(currentDate)) {
      fetchMatchHistory(currentUserForApi, currentDate);
    } else if (matchChartInstance) {
      matchChartInstance.data.datasets[0].data = [];
      matchChartInstance.update();
    }
  };

  // --- アコーディオン制御 ---
  const toggle = document.getElementById("graphToggle");
  const content = document.getElementById("graphContent");
  if (toggle && content) {
    toggle.classList.add("active");
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      content.classList.toggle("closed");
    });
  }

  // --- 初期化処理 ---
  updateCalendarDisplay();
  fetchUsers("");

  // 更新ボタン
  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    if (!currentUserForApi) return;
    const loader = document.getElementById("chartLoading");
    if (loader) loader.classList.add("active");
    const oldStats = document.getElementById("jsonpStats");
    if (oldStats) oldStats.remove();
    const s = document.createElement("script");
    s.id = "jsonpStats";
    s.src = `${GAS_BASE}?action=stats&user=${encodeURIComponent(currentUserForApi)}&callback=handleStatsJsonp&_=${Date.now()}`;
    document.body.appendChild(s);
    fetchAvailableDates(currentUserForApi);
    fetchMatchHistory(currentUserForApi, currentDate);
  });
});

// --- 以下、関数定義 ---

// --- マップスケジュール計算 ---
function getMapSchedule() {
  const nowMs = new Date().getTime();
  let diff = nowMs - CC_CONFIG.ANCHOR_EPOCH;
  
  const totalDuration = CC_CONFIG.CYCLE_MS * CC_CONFIG.ROTATION.length;
  while (diff < 0) diff += totalDuration;

  const totalSlots = Math.floor(diff / CC_CONFIG.CYCLE_MS);
  const currentIdx = totalSlots % CC_CONFIG.ROTATION.length;
  const nextIdx = (currentIdx + 1) % CC_CONFIG.ROTATION.length;

  return {
    currentKey: CC_CONFIG.ROTATION[currentIdx],
    nextKey: CC_CONFIG.ROTATION[nextIdx],
    nextSwitchTime: CC_CONFIG.ANCHOR_EPOCH + ((totalSlots + 1) * CC_CONFIG.CYCLE_MS)
  };
}

// --- 画面の強調表示更新 ---
function updateMapHighlight() {
  const schedule = getMapSchedule();
  const nextTimes = getAllStageNextTimes();

  const toId = (key) => "stage-card-" + key.replace(/\s+/g, "");

  // 全カードをループして表示を更新
  nextTimes.forEach(item => {
    const el = document.getElementById(toId(item.key));
    if (!el) return;

    // 1. 時間の更新
    const timeEl = el.querySelector('.stage-next-start');
    if (timeEl) timeEl.textContent = item.timeStr;

    // 2. クラスとバッジのリセット
    el.classList.remove('current-map', 'next-map');
    const badgeArea = el.querySelector('.stage-badge-area');
    if (badgeArea) badgeArea.innerHTML = "";

    // 3. 「現在」と「次」の強調
    if (item.key === schedule.currentKey) {
      el.classList.add('current-map');
      if (badgeArea) badgeArea.innerHTML = `<span class="badge-now">NOW</span>`;
    } else if (item.key === schedule.nextKey) {
      el.classList.add('next-map');
      if (badgeArea) badgeArea.innerHTML = `<span class="badge-next">NEXT</span>`;
    }
  });

  // 次回ローテーションの2秒後に自動更新を予約
const delay = Math.max(0, schedule.nextSwitchTime - Date.now());
setTimeout(updateMapHighlight, delay);
}

function ensureEmptyChart() {
  const canvas = document.getElementById("matchChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (matchChartInstance) return;

  matchChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: "勝敗グラフ",
        data: [],
        parsing: false,
        borderWidth: 2,
        pointRadius: ctx => ctx.raw?.isStart ? 0 : 5,
        pointHoverRadius: 7,
        pointBorderWidth: 0,

        borderColor: "#8297B2",
        pointBackgroundColor: ctx => (ctx.raw?.result > 0) ? "#a5c9ed" : "#f2c2d4",
        pointBorderColor: ctx => (ctx.raw?.result > 0) ? "#a5c9ed" : "#f2c2d4",

        segment: {
          borderColor: ctx => {
            const y0 = ctx.p0?.raw?.y;
            const y1 = ctx.p1?.raw?.y;
            return (y0 >= 0 && y1 >= 0) ? "#b8d9f7" : "#f7d7e3";
          }
        },
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "linear", ticks: { stepSize: 1 } },
        y: {
          beginAtZero: true,
ticks: {
            stepSize: 5,
            callback: (v) => (v === 0 ? "±0" : v)
          },
          grid: {
            color: (ctx) => ctx.tick?.value === 0 ? "#cbd5e1" : "#f1f5f9",
            lineWidth: (ctx) => ctx.tick?.value === 0 ? 2 : 1
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#4a5568",
          bodyColor: "#4a5568",
          bodyFont: { family: "Kiwi Maru", size: 12 },
          borderColor: "#d1dce8",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          displayColors: false,
          callbacks: {
            title: () => "",
            label: (ctx) => {
              const d = ctx.raw;
              if (d.isStart) return "スタート";

              const score = d.y > 0 ? `+${d.y}` : d.y;
              const jobName = (d.job && JOB_NAME_JP[d.job]) ? JOB_NAME_JP[d.job] : (d.job || "なし");
              const stageName = (d.stage && STAGE_NAME_JP[d.stage]) ? STAGE_NAME_JP[d.stage] : (d.stage || "なし");

              // --- 日付の補正処理 ---
              let displayDate = d.date; 
              if (d.date && d.time) {
                const hour = parseInt(d.time.split(":")[0], 10);
                if (hour < 5) {
                  const parts = d.date.split("-");
                  const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                  dt.setDate(dt.getDate() + 1); 
                  const y = dt.getFullYear();
                  const m = String(dt.getMonth() + 1).padStart(2, "0");
                  const day = String(dt.getDate()).padStart(2, "0");
                  displayDate = `${y}-${m}-${day}`;
                }
              }
              const yyDate = displayDate ? displayDate.slice(2) : ""; 
              
              return [
                `試合日時: ${yyDate} ${d.time} (${score})`,
                `通算: ${d.x}戦目`,
                `使用ジョブ: ${jobName}`,
                `ステージ: ${stageName}`
              ];
            }
          }
        }
      }
    }
  });
}

function fetchMatchHistory(user, dateStr) {
  const loader = document.getElementById("chartLoading");
  if (loader) loader.classList.add("active");
  const old = document.getElementById("jsonpHistory");
  if (old) old.remove();
  const script = document.createElement("script");
  script.id = "jsonpHistory";
  script.src = `${GAS_BASE}?action=matchhistory&user=${encodeURIComponent(user)}&date=${encodeURIComponent(dateStr)}&callback=handleMatchHistoryJsonp&_=${Date.now()}`;
  document.body.appendChild(script);
}

function fetchAvailableDates(user) {
  const old = document.getElementById("jsonpAvailableDates");
  if (old) old.remove();
  const s = document.createElement("script");
  s.id = "jsonpAvailableDates";
  s.src = `${GAS_BASE}?action=availabledates&user=${encodeURIComponent(user)}&callback=handleAvailableDatesJsonp&_=${Date.now()}`;
  document.body.appendChild(s);
}

function fetchUsers(qText) {
  const q = encodeURIComponent(String(qText || "").replace(/\s+/g, ""));
  const oldUsers = document.getElementById("jsonpUsers");
  if (oldUsers) oldUsers.remove();
  const su = document.createElement("script");
  su.id = "jsonpUsers";
  su.src = `${GAS_BASE}?action=users&q=${q}&callback=handleUsersJsonp&_=${Date.now()}`;
  document.body.appendChild(su);
}

function buildCalendar(year, month) {
  const cal = document.getElementById("calendar");
  if (!cal) return;
  cal.innerHTML = "";
  const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  week.forEach((w,i) => {
    const h = document.createElement("div");
    h.className = `calendar-head day-${i}`;
    h.textContent = w;
    cal.appendChild(h);
  });

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const total = last.getDate();

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty";
    cal.appendChild(empty);
  }

  for (let d = 1; d <= total; d++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cell.dataset.date = dateStr;
    cell.addEventListener("click", () => {
      if (!availableDates.includes(cell.dataset.date)) return;
      currentDate = cell.dataset.date;
      applyCalendarColors();
      if (!currentUserForApi) return;
      fetchMatchHistory(currentUserForApi, currentDate);
    });
    cal.appendChild(cell);
  }

  const totalCellsSoFar = startDay + total;
  const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty";
    cal.appendChild(empty);
  }
}

function applyCalendarColors() {
  const cells = document.querySelectorAll(".calendar-cell");
  const today = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  cells.forEach(cell => {
    const d = cell.dataset.date;
    if (!d) return;
    cell.classList.remove("today", "selected", "nodata", "win", "loss", "draw");
    const dayNum = parseInt(d.split("-")[2], 10);
    let innerHTML = `<span class="cal-date">${dayNum}</span>`;
    if (availableDates.includes(d)) {
      const data = resultByDate[d];
      if (data.status === 1) cell.classList.add("win");
      else if (data.status === -1) cell.classList.add("loss");
      else cell.classList.add("draw");
      const scoreText = `${data.score > 0 ? "+" : ""}${data.score}`;
      const textClass = data.status === 1 ? "text-win" : (data.status === -1 ? "text-loss" : "text-draw");
      innerHTML += `<span class="cal-score ${textClass}">${scoreText}</span>`;
    } else {
      cell.classList.add("nodata");
    }
    cell.innerHTML = innerHTML;
    if (d === today) cell.classList.add("today");
    if (d === currentDate) cell.classList.add("selected");
  });
}

function getAllStageNextTimes() {
  const nowMs = Date.now();
  const diff = nowMs - CC_CONFIG.ANCHOR_EPOCH;
  const currentSlotCount = Math.floor(diff / CC_CONFIG.CYCLE_MS);
  const currentSlotStartTime = CC_CONFIG.ANCHOR_EPOCH + (currentSlotCount * CC_CONFIG.CYCLE_MS);
  const currentIdx = currentSlotCount % CC_CONFIG.ROTATION.length;

  return CC_CONFIG.ROTATION.map((key, i) => {
    // 現在のマップから見て、何スロット後かを算出
    let offset = (i - currentIdx + CC_CONFIG.ROTATION.length) % CC_CONFIG.ROTATION.length;
    
    // そのスロットの開始と終了を計算
    const targetStartTime = currentSlotStartTime + (offset * CC_CONFIG.CYCLE_MS);
    const targetEndTime = targetStartTime + CC_CONFIG.CYCLE_MS;
    
    const dStart = new Date(targetStartTime);
    const dEnd = new Date(targetEndTime);
    
    // HH:mm 形式に整える
    const startStr = `${String(dStart.getHours()).padStart(2, '0')}:${String(dStart.getMinutes()).padStart(2, '0')}`;
    const endStr = `${String(dEnd.getHours()).padStart(2, '0')}:${String(dEnd.getMinutes()).padStart(2, '0')}`;
    
    return {
      key: key,
      timeStr: `${startStr}～${endStr}`
    };
  });
}


function drawTimeChart(statsData, weekday = "all") {
  const canvas = document.getElementById("time-chart");
  if (!canvas) return;

  // フィルタボタン
  const buttons = document.querySelectorAll(".time-filter button");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wd === weekday);
    btn.onclick = () => drawTimeChart(statsData, btn.dataset.wd);
  });

  const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const normalizeWday = (w) => {
    if (w == null) return "";
    const s = String(w).trim().toLowerCase();
    if (!s) return "";

    // 0-6 の数字対応（0=sun想定）
    if (/^\d+$/.test(s)) return WD[Number(s)] ?? "";

    // "Sun" / "Sunday" / "sun" みたいなの対応
    const s3 = s.slice(0, 3);
    if (WD.includes(s3)) return s3;

    // もし日本語が来ても一応拾う
    const jp = { "日": "sun", "月": "mon", "火": "tue", "水": "wed", "木": "thu", "金": "fri", "土": "sat" };
    if (jp[s]) return jp[s];

    return s;
  };

  let src = [];
  if (weekday === "all") {
    src = statsData.byHour || [];
  } else {
    const target = String(weekday).toLowerCase();
    src = (statsData.byHourWeekday || []).filter(r => normalizeWday(r.weekday) === target);
  }

  if (window.timeChartInstance) {
    window.timeChartInstance.destroy();
  }

  const winRates = Array(24).fill(null);
  const gameCounts = Array(24).fill(0);

  for (const r of src) {
    if (r.hour >= 0 && r.hour <= 23) {
      winRates[r.hour] = r.winRate != null ? r.winRate * 100 : null;

      const t = r.total ?? r.matches ?? r.count ?? r.n ?? r.games ?? r.gameCount ?? 0;
      const n = typeof t === "number" ? t : Number(t) || 0;
      gameCounts[r.hour] = n;
    }
  }

  const ctx = canvas.getContext("2d");
const nowHour = new Date().getHours();
  
  window.timeChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [...Array(24)].map((_, i) => i),


datasets: [{
  label: "勝率",
  data: winRates,
  backgroundColor: (ctx) => {
    const v = ctx.raw;
    if (v == null || !Number.isFinite(v)) return "rgba(0,0,0,0)";
    if (v === 50) return "#cbd5e1";
    return v > 50 ? "#a5c9ed" : "#f2c2d4";
  },
  borderWidth: (ctx) => {
    return ctx.dataIndex === nowHour ? 2 : 0;
  },
  borderColor: (ctx) => {
    return ctx.dataIndex === nowHour ? "#1f2937" : "rgba(0,0,0,0)";
  }
}]

    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => {
              const h = items?.[0]?.dataIndex ?? 0;
              const pad2 = (n) => String(n).padStart(2, "0");
              return `■.${pad2(h)}:00～${pad2(h)}:59`;
            },
            label: (item) => {
              const h = item?.dataIndex ?? 0;
              const count = gameCounts[h] ?? 0;
              const v = item?.parsed?.y;
              const rateText = (v == null || !Number.isFinite(v)) ? "-" : (v.toFixed(1) + "%");
              return [
                `■.試合数:${count}`,
                `■.勝率:${rateText}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: "category",
          ticks: {
            display: true,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 50,
            callback: (v) => v + "%"
          }
        }
      }
    }
  });
}


function drawXAxisLabels(chart) {
  // ★ 修正箇所：chart.scales.x が存在するかチェックする
  if (!chart || !chart.scales || !chart.scales.x) return;

  const ctx = chart.ctx;
  const xScale = chart.scales.x;
  const y = xScale.bottom + 14;

  ctx.save();
  ctx.fillStyle = "#6b7280"; // 既存の軸色に合わせて調整
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "12px sans-serif";

  for (let i = 0; i <= 23; i++) {
    const x = xScale.getPixelForValue(i);
    // xが取得できない場合（スケール外など）の考慮
    if (x !== undefined) {
      ctx.fillText(i, x, y);
    }
  }

  // 最後の 24
  const lastIdx = 23;
  const x23 = xScale.getPixelForValue(lastIdx);
  const x22 = xScale.getPixelForValue(lastIdx - 1);
  if (x23 !== undefined && x22 !== undefined) {
    const x24 = x23 + (x23 - x22);
    ctx.fillText(24, x24, y);
  }

  ctx.restore();
}
