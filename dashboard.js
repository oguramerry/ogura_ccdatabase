// dashboard.js

const GAS_BASE =
  "https://script.google.com/macros/s/AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec";

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
  const clearBtn = document.getElementById("clearInput");
  const panelInner = document.getElementById("panelInner");

  let statsData = null;
  let activeTab = "main";

  input?.addEventListener("input", () => {
    if (input.value.length > 0) {
      clearBtn.style.display = "block";
    } else {
      clearBtn.style.display = "none";
    }
  });

  // クリアボタンが押された時の処理
  clearBtn.addEventListener("click", () => {
    input.value = "";              // 入力を空にする
    currentUserForApi = "";        // API用のユーザー名を空にする
    clearBtn.style.display = "none"; // ボタンを隠す
    
    // 画面の表示をリセットする
    if (matchChartInstance) {
      matchChartInstance.data.datasets[0].data = [];
      matchChartInstance.update(); // グラフを空にする
    }
    
    const resultEl = document.getElementById("result");
    if (resultEl) resultEl.textContent = "試合数 - / 勝率 -"; // サマリをリセット
    
    input.focus(); // すぐに再入力できるようにカーソルを合わせる
  });

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

  // タブ切り替え：17:00時点のシンプルさに🕒機能を統合
  let setActiveTab = (tab) => {
    activeTab = tab;
    render();

    // 🕒タブが選ばれた時のグラフ描画処理
    if (tab === "time" && statsData) {
      setTimeout(() => {
        renderTimeChart(statsData.byHour); 
        setupDayFilter();
      }, 0);
    }
  };

  const setupDayFilter = () => {
    const container = document.querySelector(".day-tags");
    if (!container) return;

    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener("click", (e) => {
      const tag = e.target.closest(".day-tag");
      if (!tag) return;

      document.querySelectorAll(".day-tag").forEach(t => t.classList.remove("active"));
      tag.classList.add("active");

      const selectedDay = tag.dataset.day;

      if (selectedDay === "all") {
        renderTimeChart(statsData.byHour);
      } else {
        const filtered = (statsData.byDayHour || []).filter(row => String(row.day) === selectedDay);
        renderTimeChart(filtered);
      }
    });
  };

  // 🕒タブ専用のチャート描画関数
  let timeChartInstance = null;
  const renderTimeChart = (targetData) => {
    const canvas = document.getElementById("timeWinRateChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const labels = Array.from({length: 24}, (_, i) => `${i}時`);
    const winRates = Array.from({length: 24}, () => 0);
    const totals = Array.from({length: 24}, () => 0);

    targetData.forEach(row => {
      if (row.hour !== undefined) {
        winRates[row.hour] = (row.winRate || 0) * 100;
        totals[row.hour] = row.total || 0;
      }
    });

    if (timeChartInstance) timeChartInstance.destroy();

    timeChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          data: winRates,
          backgroundColor: ctx => {
            const val = ctx.raw;
            const total = totals[ctx.dataIndex];
            if (total === 0) return "rgba(0,0,0,0)";
            return val > 50 ? "rgba(165, 201, 237, 0.8)" : "rgba(242, 194, 212, 0.8)";
          },
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `勝率: ${ctx.raw.toFixed(1)}% (${totals[ctx.dataIndex]}試合)`
            }
          }
        },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => v + "%" } },
          x: { grid: { display: false } }
        }
      }
    });
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
    // おすすめランキングを更新
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
    }, 500); 
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
        borderWidth: 2,
        pointRadius: ctx => ctx.raw?.isStart ? 0 : 5, 
        pointHoverRadius: 7,
        borderColor: "#8297B2",
        pointBackgroundColor: ctx => (ctx.raw?.result > 0) ? "#a5c9ed" : "#f2c2d4",
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
          ticks: { stepSize: 1, callback: (value) => Number.isInteger(value) ? value : "" },
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
          callbacks: {
            title: () => "",
            label: (ctx) => {
              const d = ctx.raw;
              if (d.isStart) return "スタート";
              const score = d.y > 0 ? `+${d.y}` : d.y;
              return [`日時: ${d.time} (${score})`, `ジョブ: ${d.job}`, `ステージ: ${d.stage}`];
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
      innerHTML += `<span class="cal-score">${scoreText}</span>`;
    }
    cell.innerHTML = innerHTML;
    if (d === today) cell.classList.add("today");
    if (d === currentDate) cell.classList.add("selected");
  });
}

document.getElementById("refreshBtn")?.addEventListener("click", () => {
  if (!currentUserForApi) return;
  fetchAvailableDates(currentUserForApi);
  fetchMatchHistory(currentUserForApi, currentDate);
});
