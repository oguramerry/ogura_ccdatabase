// dashboard.js
// 全体の動きを管理する「司令塔」

const GAS_BASE =
  "https://script.google.com/macros/s/" +
  "AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec";

let matchChartInstance = null;
const now = new Date();

// 選択中の日付（初期は今日・JST）
let currentDate = (() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
})();

// グローバル変数
let availableDates = [];
let currentUserForApi = "";
let resultByDate = {}; // 色塗り用データ

// 表示中の年月（カレンダー切り替え用）
let viewYear = now.getFullYear();
let viewMonth = now.getMonth();

// 画面読み込み開始
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("userInput");
  const tabs = document.getElementById("tabButtons");
  const panelInner = document.getElementById("panelInner");

  let statsData = null;
  let activeTab = "main";

  // ■ カレンダー表示更新関数
  const updateCalendarDisplay = () => {
    const titleEl = document.getElementById("calTitle");
    if (titleEl) {
      titleEl.textContent = `${viewYear}年 ${viewMonth + 1}月`;
    }
    buildCalendar(viewYear, viewMonth);
    applyCalendarColors();
  };

  // ■ カレンダー前月ボタン
  document.getElementById("calPrev")?.addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    updateCalendarDisplay();
  });

  // ■ カレンダー翌月ボタン
  document.getElementById("calNext")?.addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    updateCalendarDisplay();
  });

  // ■ render関数 (TabRendererにお任せ！)
  const render = () => {
    if (!panelInner || !statsData) return;

    let html = "";
    if (window.TabRenderer && window.TabRenderer[activeTab]) {
      html = window.TabRenderer[activeTab](statsData);
    } else {
      html = "表示エラー: Rendererが見つかりません";
    }
    panelInner.innerHTML = html;
  };

  // タブ切り替え
  const setActiveTab = (tab) => {
    activeTab = tab;
    render();
  };

  if (tabs) {
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
    });
  }

  // ■ API: Stats受信
  window.handleStatsJsonp = (data) => {
    statsData = data;
    render();

    // 上部のハイライトエリア更新
    const m = data.meta;
    const resultEl = document.getElementById("result");
    if (resultEl) {
      resultEl.textContent =
        `試合数 ${m.total} / 勝率 ${m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-"}`;
    }

    // おすすめエリア更新 (Stage, Job, Hour)
    updateTopRanking("topStageBody", data.byStage, (row) => `${row.stage}`);
    updateTopRanking("topJobBody", data.byJob, (row) => `${JOB_NAME_JP[row.job] ?? row.job}`);
    updateTopRanking("topHourBody", data.byHour, (row) => `${formatHourRange(row.hour)}`);
  };

  // ランキング更新用ヘルパー
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

  // ■ API: Users受信
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

  // ■ API: MatchHistory受信 (グラフ)
  window.handleMatchHistoryJsonp = (data) => {
    const loader = document.getElementById("chartLoading");
    if (loader) loader.classList.remove("active");
    
    if (data.date !== currentDate) return;
    const points = data.points || [];
    const chartData = points.map((p, i) => ({
      x: i, y: p.sum, result: p.result, time: p.time, slot: p.slot, date: data.date
    }));

    const ctx = document.getElementById("matchChart").getContext("2d");
    matchChartInstance.data.datasets[0].data = chartData;
    matchChartInstance.update();
  };

  // ■ API: AvailableDates受信 (カレンダー色塗り)
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

  // グラフ折りたたみ
  const toggle = document.getElementById("graphToggle");
  const content = document.getElementById("graphContent");
  if (toggle && content) {
    toggle.classList.add("active");
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      content.classList.toggle("closed");
    });
  }

  // 初期ロード
  updateCalendarDisplay();
  fetchUsers("");
});

// --- 関数定義 ---

function ensureEmptyChart() {
  const canvas = document.getElementById("matchChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (matchChartInstance) return;

  matchChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: "勝敗グラフ", data: [], parsing: false, borderWidth: 2,
        pointRadius: 4, pointHoverRadius: 6, tension: 0.5, borderColor: "#8297B2",
        segment: {
          borderColor: ctx => {
            const y0 = ctx.p0?.raw?.y;
            const y1 = ctx.p1?.raw?.y;
            return (y0 >= 0 && y1 >= 0) ? "#e7f3ff" : "#fff0f3";
          }
        },
        pointBackgroundColor: ctx => (ctx.raw?.result > 0) ? "#e7f3ff" : "#fff0f3",
        pointBorderColor: ctx => (ctx.raw?.result > 0) ? "#6b8fb3" : "#d68fa8"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "linear", ticks: { stepSize: 1, callback: (v) => Math.round(v) + 1 } },
        y: { beginAtZero: true, grid: { color: (ctx) => ctx.tick?.value === 0 ? "#cbd5e1" : "#f1f5f9" } }
      },
      plugins: { legend: { display: false } }
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
  week.forEach(w => {
    const h = document.createElement("div");
    h.className = "calendar-head";
    h.textContent = w;
    cal.appendChild(h);
  });

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const total = last.getDate();

  for (let i = 0; i < startDay; i++) cal.appendChild(document.createElement("div"));

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
}

function applyCalendarColors() {
  const cells = document.querySelectorAll(".calendar-cell");
  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

// ユーザー入力・更新ボタン監視
document.addEventListener("input", (e) => {
  if (e.target.id === "userInput") {
    const user = e.target.value.trim();
    fetchUsers(user);
    currentUserForApi = user.replace(/\s+/g, "");
    if (!currentUserForApi) return;
    ensureEmptyChart();
    
    // StatsとAvailableDatesを取得
    const old = document.getElementById("jsonpStats");
    if (old) old.remove();
    const s = document.createElement("script");
    s.id = "jsonpStats";
    s.src = `${GAS_BASE}?action=stats&user=${encodeURIComponent(currentUserForApi)}&callback=handleStatsJsonp&_=${Date.now()}`;
    document.body.appendChild(s);
    fetchAvailableDates(currentUserForApi);
  }
});

document.getElementById("refreshBtn")?.addEventListener("click", () => {
  if (!currentUserForApi) return;
  const loader = document.getElementById("chartLoading");
  if (loader) loader.classList.add("active");

  // 全情報を再取得
  const oldStats = document.getElementById("jsonpStats");
  if (oldStats) oldStats.remove();
  const s = document.createElement("script");
  s.id = "jsonpStats";
  s.src = `${GAS_BASE}?action=stats&user=${encodeURIComponent(currentUserForApi)}&callback=handleStatsJsonp&_=${Date.now()}`;
  document.body.appendChild(s);

  fetchAvailableDates(currentUserForApi);
  fetchMatchHistory(currentUserForApi, currentDate);
});
