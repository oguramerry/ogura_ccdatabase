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

  let setActiveTab = (tab) => {
    activeTab = tab;
// HTML上の全ボタンから active クラスを消す
  document.querySelectorAll("#tabButtons button").forEach(btn => {
    btn.classList.remove("active");
  });
  // 今押したボタンだけに active クラスをつける
  document.querySelector(`button[data-tab="${tab}"]`)?.classList.add("active");

    
    render();

    // 🕒タブ（時間帯統計）が選ばれた時の処理
    if (tab === "time" && statsData) {
      // 描画を確実にするため、HTMLが生成されるのを一瞬待つ
      setTimeout(() => {
        renderTimeChart(statsData.byHour); // 最初は全体(byHour)を表示
        setupDayFilter();
      }, 0);
    }
  };

  const setupDayFilter = () => {
    const container = document.querySelector(".day-tags");
    if (!container) return;

    // 以前のイベントリスナーを消すため、クローンを作って差し替える（重複登録防止）
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener("click", (e) => {
      const tag = e.target.closest(".day-tag");
      if (!tag) return;

      document.querySelectorAll(".day-tag").forEach(t => t.classList.remove("active"));
      tag.classList.add("active");

      const selectedDay = tag.dataset.day; // HTML側で data-day="0" 等が入っている想定

      if (selectedDay === "all") {
        renderTimeChart(statsData.byHour);
      } else {
        // GAS側から届く statsData.byDayHour (曜日別・時間別データ) をフィルタリング
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

    // 0〜23時の空データを作成
    const labels = Array.from({length: 24}, (_, i) => `${i}時`);
    const winRates = Array.from({length: 24}, () => 0);
    const totals = Array.from({length: 24}, () => 0);

    // データをマッピング
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
            const val = ctx.raw; // 勝率(%)
            const total = totals[ctx.dataIndex];
            
            if (total === 0) return "rgba(0,0,0,0)"; // 試合なしは透明
            
            if (val > 50) {
              // 50%より高い：水色（100%に近いほど濃い）
              const alpha = 0.2 + ((val - 50) / 50) * 0.8;
              return `rgba(165, 201, 237, ${alpha})`; // --pastel-win-textに近い水色
            } else if (val < 50) {
              // 50%より低い：ピンク（0%に近いほど濃い）
              const alpha = 0.2 + ((50 - val) / 50) * 0.8;
              return `rgba(242, 194, 212, ${alpha})`; // --pastel-loss-textに近いピンク
            }
            return "rgba(200, 200, 200, 0.2)"; // ちょうど50%
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
       // ensureEmptyChart 内の scales.y を修正
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
  
  // PDFの英語名 を日本語に変換
  const jobName = (d.job && JOB_NAME_JP[d.job]) ? JOB_NAME_JP[d.job] : (d.job || "なし");
  const stageName = (d.stage && STAGE_NAME_JP[d.stage]) ? STAGE_NAME_JP[d.stage] : (d.stage || "なし");
  
  const yyDate = d.date ? d.date.slice(2) : "";
  
  return [
    `試合日時: ${yyDate} ${d.time} (${score})`,
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

  // ★ 前の空きセル：クラスを追加
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty"; // emptyクラスを付与
    cal.appendChild(empty);
  }

  // 日付セル
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

  // ★ 追加：後ろの空きセル（カレンダーの最後を埋める）
  const totalCellsSoFar = startDay + total;
  const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty"; // emptyクラスを付与
    cal.appendChild(empty);
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
