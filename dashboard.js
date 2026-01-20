// dashboard.js

const GAS_BASE =
  "https://script.google.com/macros/s/" +
  "AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec";

let matchChartInstance = null;
const now = new Date();

let currentDate = (() => {
  const now = new Date();
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
  const panelInner = document.getElementById("panelInner");

  let statsData = null;
  let activeTab = "main";

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

  window.handleStatsJsonp = (data) => {
    statsData = data;
    render();
    const m = data.meta;
    const resultEl = document.getElementById("result");
    if (resultEl) {
      resultEl.textContent =
        `試合数 ${m.total} / 勝率 ${m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-"}`;
    }
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
          slot: p.slot,
          date: data.date
        });
      });
    }

    // グラフが初期化されているか確認
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

  const toggle = document.getElementById("graphToggle");
  const content = document.getElementById("graphContent");
  if (toggle && content) {
    toggle.classList.add("active");
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      content.classList.toggle("closed");
    });
  }

  updateCalendarDisplay();
  fetchUsers("");

  // 入力監視（タイマー付き）
  let inputTimer = null;
  input?.addEventListener("input", (e) => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      const user = e.target.value.trim();
      fetchUsers(user);
      currentUserForApi = user.replace(/\s+/g, "");
      if (!currentUserForApi) return;
      ensureEmptyChart();
      
      const old = document.getElementById("jsonpStats");
      if (old) old.remove();
      const s = document.createElement("script");
      s.id = "jsonpStats";
      s.src = `${GAS_BASE}?action=stats&user=${encodeURIComponent(currentUserForApi)}&callback=handleStatsJsonp&_=${Date.now()}`;
      document.body.appendChild(s);
      fetchAvailableDates(currentUserForApi);
    }, 500); // 0.5秒間入力が止まったら通信するよ
  });
});

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
  borderWidth: 3, 
  pointRadius: ctx => ctx.raw?.isStart ? 0 : 5,
  pointHitRadius: ctx => ctx.raw?.isStart ? 0 : 10,
  pointHoverRadius: 7,
  tension: 0.5,
  borderColor: "#8297B2",
  pointBackgroundColor: ctx => (ctx.raw?.result > 0) ? "#6b8fb3" : "#d68fa8",
  pointBorderColor: ctx => (ctx.raw?.result > 0) ? "#6b8fb3" : "#d68fa8",
  
  segment: {
    borderColor: ctx => {
      const y0 = ctx.p0?.raw?.y;
      const y1 = ctx.p1?.raw?.y;
      
      // 0以上のエリアは濃いパステルブルー、それ以外は濃いピンク
      return (y0 >= 0 && y1 >= 0) ? "#6b8fb3" : "#d68fa8";
    }
  }
}]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "linear",
          ticks: {
            stepSize: 1,
            callback: (v) => {
              const i = Math.round(v);
              if (i === 0) return "0"; 
              return i;
            }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            callback: (value) => Number.isInteger(value) ? value : ""
          },
          grid: {
            color: (ctx) => ctx.tick?.value === 0 ? "#cbd5e1" : "#f1f5f9",
            lineWidth: (ctx) => ctx.tick?.value === 0 ? 2 : 1
          }
        }
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
