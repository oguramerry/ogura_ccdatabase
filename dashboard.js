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

// 画面読み込み開始
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("userInput");
  const tabs = document.getElementById("tabButtons");
  const panelInner = document.getElementById("panelInner");

  let statsData = null;
  let activeTab = "main";
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  // カレンダー前月・翌月ボタン
  document.getElementById("calPrev")?.addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    buildCalendar(viewYear, viewMonth);
    // カレンダーめくったら色は一旦消す（再取得はしない）
    // ※もし月をまたいで色を残したいならここは調整可能
    applyCalendarColors(); 
  });

  document.getElementById("calNext")?.addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    buildCalendar(viewYear, viewMonth);
    applyCalendarColors();
  });


  // ■ render関数 (TabRendererにお任せ！)
  const render = () => {
    if (!panelInner || !statsData) return;

    let html = "";
    // TabRendererに同名の関数(main, job等)があれば実行してHTMLをもらう
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
    console.log("tab:", activeTab);
    render();
  };

  if (tabs) {
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
    });
  }

  let timer = null;

  // ■ API: Stats受信
  window.handleStatsJsonp = (data) => {
    console.log("handleStatsJsonp called", data);
    statsData = data;
    render(); // 描画実行

    // 上部のハイライトエリア更新
    const m = data.meta;
    const resultEl = document.getElementById("result");
    if (resultEl) {
      resultEl.textContent =
        `試合数 ${m.total} / 勝率 ${m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-"}`;
    }

    // おすすめステージ
    const stageEl = document.getElementById("topStageBody");
    if (stageEl && data.byStage && data.byStage.length) {
      const ranking = data.byStage
        .filter(row => (row.total ?? 0) >= 5)
        .slice()
        .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
        .slice(0, 3);
      stageEl.innerHTML = ranking.map((row, i) =>
        `${i + 1}位　${row.stage} 勝率 ${((row.winRate ?? 0) * 100).toFixed(1)}%（${row.total}試合）`
      ).join("<br>");
    }

    // おすすめジョブ
    const jobEl = document.getElementById("topJobBody");
    if (jobEl && data.byJob && data.byJob.length) {
      const ranking = data.byJob.slice()
        .filter(row => (row.total ?? 0) >= 5)
        .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
        .slice(0, 3);
      jobEl.innerHTML = ranking.map((row, i) =>
        `${i + 1}位　${JOB_NAME_JP[row.job] ?? row.job} 勝率 ${((row.winRate ?? 0) * 100).toFixed(1)}%（${row.total}試合）`
      ).join("<br>");
    }

    // おすすめ時間
    const hourEl = document.getElementById("topHourBody");
    if (hourEl && data.byHour && data.byHour.length) {
      const ranking = data.byHour
        .filter(row => (row.total ?? 0) >= 5)
        .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
        .slice(0, 3);
      hourEl.innerHTML = ranking.map((row, i) =>
        `${i + 1}位　${formatHourRange(row.hour)} 勝率 ${((row.winRate ?? 0) * 100).toFixed(1)}%（${row.total}試合）`
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

    buildCalendar(now.getFullYear(), now.getMonth());
    applyCalendarColors();

    if (availableDates.includes(currentDate)) {
      fetchMatchHistory(currentUserForApi, currentDate);
    } else {
      if (matchChartInstance) {
        matchChartInstance.data.datasets[0].data = [];
        matchChartInstance.update();
      }
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
  fetchUsers("");
});

// --- 以下、関数定義 ---

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
        pointRadius: 4, pointHoverRadius: 6, tension: 0.5, borderColor: "#4e79a7",
        segment: {
          borderColor: ctx => {
            const y0 = ctx.p0?.raw?.y;
            const y1 = ctx.p1?.raw?.y;
            if (y0 == null || y1 == null) return "#4e79a7";
            return (y0 >= 0 && y1 >= 0) ? "#9fd9e8" : "#f2a7bf";
          }
        },
        pointBackgroundColor: ctx => { return (ctx.raw?.result > 0) ? "#b8e6f0" : "#f6c1d1"; },
        pointBorderColor: ctx => { return (ctx.raw?.result > 0) ? "#7cc9dd" : "#e79ab0"; }
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: "linear",
          ticks: { stepSize: 1, callback: (v) => { const i = Math.round(v); return (i < 0) ? "" : `${i + 1}`; } }
        },
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => Number.isInteger(value) ? value : "" },
          grid: { color: (ctx) => ctx.tick?.value === 0 ? "#999999" : "#e6e6e6", lineWidth: (ctx) => ctx.tick?.value === 0 ? 2 : 1 }
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
  script.src = GAS_BASE + "?action=matchhistory" + "&user=" + encodeURIComponent(user) + "&date=" + encodeURIComponent(dateStr) + "&callback=handleMatchHistoryJsonp" + "&_=" + Date.now();
  document.body.appendChild(script);
}

function fetchAvailableDates(user) {
  const old = document.getElementById("jsonpAvailableDates");
  if (old) old.remove();
  const s = document.createElement("script");
  s.id = "jsonpAvailableDates";
  s.src = GAS_BASE + "?action=availabledates" + "&user=" + encodeURIComponent(user) + "&callback=handleAvailableDatesJsonp" + "&_=" + Date.now();
  document.body.appendChild(s);
}

function fetchUsers(qText) {
  const q = encodeURIComponent(String(qText || "").replace(/\s+/g, ""));
  const oldUsers = document.getElementById("jsonpUsers");
  if (oldUsers) oldUsers.remove();
  const su = document.createElement("script");
  su.id = "jsonpUsers";
  su.src = GAS_BASE + "?action=users" + "&q=" + q + "&callback=handleUsersJsonp" + "&_=" + Date.now();
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
    cell.textContent = d;
    const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    cell.dataset.date = dateStr;

    cell.addEventListener("click", () => {
      if (!availableDates.includes(cell.dataset.date)) return;
      currentDate = cell.dataset.date;
      applyCalendarColors();
      if (!currentUserForApi) return;
      if (availableDates.includes(currentDate)) {
        fetchMatchHistory(currentUserForApi, currentDate);
      } else {
        if (matchChartInstance) {
          matchChartInstance.data.datasets[0].data = [];
          matchChartInstance.update();
        }
      }
    });
    cal.appendChild(cell);
  }
}

function applyCalendarColors() {
  const cells = document.querySelectorAll(".calendar-cell");
  const today = (() => {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  })();

  cells.forEach(cell => {
    const d = cell.dataset.date;
    if (!d) return;
    cell.classList.remove("today", "selected", "nodata", "win", "loss", "draw");

    const dayNum = parseInt(d.split("-")[2], 10);
    let innerHTML = `<span class="cal-date">${dayNum}</span>`;

    if (availableDates.includes(d)) {
      const data = resultByDate[d];
      const r = data.status;
      const s = data.score;
      if (r === 1) cell.classList.add("win");
      else if (r === -1) cell.classList.add("loss");
      else cell.classList.add("draw");

      const sign = s > 0 ? "+" : "";
      const scoreText = `${sign}${s}`;
      const textClass = r === 1 ? "text-win" : (r === -1 ? "text-loss" : "text-draw");
      innerHTML += `<span class="cal-score ${textClass}">${scoreText}</span>`;
    } else {
      cell.classList.add("nodata");
    }
    cell.innerHTML = innerHTML;
    if (d === today) cell.classList.add("today");
    if (d === currentDate) cell.classList.add("selected");
  });
}

// ユーザー入力の監視
const input = document.getElementById("userInput");
if(input){
    let timer = null;
    input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        const user = input.value.trim();
        fetchUsers(user);
        const userForApi = user.replace(/\s+/g, "");
        currentUserForApi = userForApi;
        if (!userForApi) return;
        ensureEmptyChart();
        
        const old = document.getElementById("jsonpStats");
        if (old) old.remove();
        const s = document.createElement("script");
        s.id = "jsonpStats";
        s.src = GAS_BASE + "?action=stats&user=" + encodeURIComponent(userForApi) + "&callback=handleStatsJsonp&_=" + Date.now();
        document.body.appendChild(s);

        fetchAvailableDates(userForApi);
        if (availableDates.includes(currentDate)) {
            fetchMatchHistory(userForApi, currentDate);
        } else {
            if (matchChartInstance) {
                matchChartInstance.data.datasets[0].data = [];
                matchChartInstance.update();
            }
        }
    }, 500);
    });
}
