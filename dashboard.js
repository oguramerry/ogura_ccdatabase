// dashboard.js
window.testAvailableDates = (data) => {
  console.log("availableDates:", data);
};

// match-stats-api
const GAS_BASE =
  "https://script.google.com/macros/s/"+
  "AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec";

const JOB_NAME_JP = {
  "PLD": "ナイト",
  "WAR": "戦士",
  "DRK": "暗黒騎士",
  "GNB": "ガンブレイカー",
  "WHM": "白魔道士",
  "SCH": "学者",
  "AST": "占星術師",
  "SGE": "賢者",
  "MNK": "モンク",
  "DRG": "竜騎士",
  "NIN": "忍者",
  "SAM": "侍",
  "RPR": "リーパー",
  "VPR":"ヴァイパー",
  "BRD": "吟遊詩人",
  "MCH": "機工士",
  "DNC": "踊り子",
  "BLM": "黒魔道士",
  "SMN": "召喚士",
  "RDM": "赤魔道士",
};

let matchChartInstance = null;

//　名前変換
function formatCharacterName(name) {
  if (!name) return name;
  // すでに半角スペースがあるならそのまま
  if (name.includes(" ")) return name;
  // OguraChan -> Ogura Chan みたいに分割
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

//時間帯を05:00~05:59で整える
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatHourRange(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return String(hour ?? "");
  const start = `${pad2(h)}:00`;
  const end = `${pad2(h)}:59`;
  return `${start}～${end}`;
}

function ensureEmptyChart() {
  const canvas = document.getElementById("matchChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // すでに Chart があれば何もしない
  if (matchChartInstance) return;

  matchChartInstance = new Chart(ctx, {
    type: "line",
    data: {
datasets: [{
  label: "勝敗グラフ",
  data: [],
  parsing: false,
  borderWidth: 2,
  pointRadius: 4,
  pointHoverRadius: 6,
  tension: 0.5,
  borderColor: "#4e79a7",

  segment: {
    borderColor: ctx => {
      const y0 = ctx.p0?.raw?.y;
      const y1 = ctx.p1?.raw?.y;
      if (y0 == null || y1 == null) return "#4e79a7";
      return (y0 >= 0 && y1 >= 0)
        ? "#9fd9e8"
        : "#f2a7bf";
    }
  },

  pointBackgroundColor: ctx => {
    const r = ctx.raw?.result;
    return r > 0 ? "#b8e6f0" : "#f6c1d1";
  },
  pointBorderColor: ctx => {
    const r = ctx.raw?.result;
    return r > 0 ? "#7cc9dd" : "#e79ab0";
  }
}]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: "linear",
          ticks: {
            stepSize: 1,
            callback: (v) => {
              const i = Math.round(v);
              if (i < 0) return "";
              return `${i + 1}`;
            }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) =>
              Number.isInteger(value) ? value : ""
          },
          grid: {
            color: (ctx) =>
              ctx.tick?.value === 0 ? "#999999" : "#e6e6e6",
            lineWidth: (ctx) =>
              ctx.tick?.value === 0 ? 2 : 1
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

const now = new Date();

// 選択中の日付（初期は今日・JST）
let currentDate = (() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
})();


//画面が読み込まれたら開始
document.addEventListener("DOMContentLoaded", () => {

  const input = document.getElementById("userInput"); // キャラ名入力欄
  const tabs = document.getElementById("tabButtons");  //　タブボタン群
  const panelInner = document.getElementById("panelInner"); //htmlのid panelInnerを掴む（タブ内書き換え表示）
  
  let statsData = null;
  let activeTab = "main";　//　現在表示中のタブ
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

document.getElementById("calPrev")?.addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  }
  buildCalendar(viewYear, viewMonth);
  Object.keys(resultByDate).forEach(k => delete resultByDate[k]);
  applyCalendarColors();
});

document.getElementById("calNext")?.addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  buildCalendar(viewYear, viewMonth);
  Object.keys(resultByDate).forEach(k => delete resultByDate[k]);
  applyCalendarColors();
});
  
  
  //　-------------------------------render開始
  //　現在のactivetabに応じてpanelInnerを描画
  //　未取得時は何も表示しない
  const render = () => {
    if (!panelInner) return;
    
//statsDataが空のときは何もしない    
if (!statsData) {
  return;
}
//　メインサマリ（試合数・勝率）
if (activeTab === "main") {
  const m = statsData.meta || {};
  const winRateText =
    m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-";
  
//パネルの中を消して新しい内容を入れる
  panelInner.innerHTML = `
    <div class="stat-card">
    <p class="stat-title">サマリ</p>
    <p class="stat-body">
    試合数 ${m.total ?? "-"}<br>
    勝率 ${winRateText}
    </p>
    </div>
  `;
}
  
//ジョブ別　勝率ランキング
else if (activeTab === "job") {
  const map = statsData.byJob;
  if (!map) {
    panelInner.textContent = "job 集計なし";
    return;
  }

const ranking = map
  .filter(row=>(row.total??0)>=5)
  .slice()
  .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  .slice(0, 5);

  panelInner.innerHTML = `
    <div class="stat-card">
      <p class="stat-title">ジョブ top5（勝率）</p>
      <p class="stat-body">
  ${ranking.map((row, i) =>
    `${i + 1}位：${JOB_NAME_JP[row.job] ?? row.job}（${((row.winRate ?? 0) * 100).toFixed(1)}% / ${row.total}試合）`
  ).join("<br>")}
      </p>
    </div>
  `;
}
//　ステージ別　勝率ランキング
else if (activeTab === "stage") {
  const map = statsData.byStage;
  if (!map) {
    panelInner.textContent = "stage 集計なし";
    return;
  }

const ranking = map
  .slice()
  .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  .slice(0, 6);

  panelInner.innerHTML = `
    <div class="stat-card">
      <p class="stat-title">ステージ勝率ランキング</p>
      <p class="stat-body">
  ${ranking.map((row, i) =>
    `${i + 1}位：${row.stage}（${((row.winRate ?? 0) * 100).toFixed(1)}% / ${row.total}試合）`
  ).join("<br>")}

      </p>
    </div>
  `;
}
  
//　ジョブ×ステージ　勝率ランキング
else if (activeTab === "jobStage") {
  const arr = statsData.byStageJob;
  if (!arr || !arr.length) {
    panelInner.textContent = "job*stage 集計なし";
    return;
  }

  const ranking = arr
    .filter(row=>(row.total??0)>=5)
    .slice()
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 10);

  panelInner.innerHTML = `
    <div class="stat-card">
      <p class="stat-title">ジョブ × ステージ top10（勝率）</p>
      <p class="stat-body">
        ${ranking.map((row, i) => {
          const jobJp = JOB_NAME_JP[row.job] ?? row.job;
          const wr = ((row.winRate ?? 0) * 100).toFixed(1);
          return `${i + 1}位：${jobJp} × ${row.stage}（${wr}% / ${row.total}試合）`;
        }).join("<br>")}
      </p>
    </div>
  `;
}

//　時間帯別　勝率ランキング
else if (activeTab === "time") {
  const arr = statsData.byHour;
  if (!arr || !arr.length) {
    panelInner.textContent = "時間帯 集計なし";
    return;
  }

  const ranking = arr
    .filter(row=>(row.total??0)>=5)
    .slice()
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 5);

  panelInner.innerHTML = `
    <div class="stat-card">
      <p class="stat-title">時間帯 top5（勝率）</p>
      <p class="stat-body">
        ${ranking.map((row, i) => {
          const wr = ((row.winRate ?? 0) * 100).toFixed(1);
          return `${i + 1}位：${formatHourRange(row.hour)}（${wr}% / ${row.total}試合）`;
        }).join("<br>")}
      </p>
    </div>
  `;
}
  };　
  // -------------------------------render終わり


  //　タブ切り替え→再描画
  //　タブがクリックされたらactivetabを切り替え
  const setActiveTab = (tab) => {
      activeTab = tab;
      console.log("tab:", activeTab);
      render();
  };

  console.log("tabs:", tabs);
  if (!tabs) console.log("tabButtons が見つからない（html未反映 or キャッシュ or 別ページ）");

  if (tabs) {
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
    });
  }

  let timer = null;

  //　gasのaction=statsから返ってきた戦績データ受け取り
  //　.statsDataに保存
  window.handleStatsJsonp = (data) => {
    console.log("handleStatsJsonp called", data);
    statsData = data;
    console.log("byStage sample", statsData.byStage?.[0]);
    //　アクティブタブ再描画
    render();
    
    const el = document.getElementById("result");
    if (!el) return;　//resultがhtmlになかったら終了
    
    const m = data.meta;　//　全体サマリをmとして宣言
    const resultEl = document.getElementById("result");
    if (resultEl) {　　//　resultがある場合だけ処理
      resultEl.textContent =
        `試合数 ${m.total} / 勝率 ${m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-"}`;
    }

    const stageEl = document.getElementById("topStageBody");
if (stageEl && data.byStage && data.byStage.length) {
  const ranking = data.byStage
    .slice()
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 3);

  stageEl.innerHTML = ranking.map((row, i) => {
    const wr = ((row.winRate ?? 0) * 100).toFixed(1);
    return `${i + 1}位　${row.stage} 勝率 ${wr}%（${row.total}試合）`;
  }).join("<br>");
}

    const jobEl = document.getElementById("topJobBody");
if (jobEl && data.byJob && data.byJob.length) {
  const ranking = data.byJob
    .slice()
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 3);

  jobEl.innerHTML = ranking.map((row, i) => {
    const jobJp = JOB_NAME_JP[row.job] ?? row.job;
    const wr = ((row.winRate ?? 0) * 100).toFixed(1);
    return `${i + 1}位　${jobJp} 勝率 ${wr}%（${row.total}試合）`;
  }).join("<br>");
}
    
const hourEl = document.getElementById("topHourBody");
if (hourEl && data.byHour && data.byHour.length) {
  const ranking = data.byHour
    .slice()
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 3);

  hourEl.innerHTML = ranking.map((row, i) => {
    const wr = ((row.winRate ?? 0) * 100).toFixed(1);
    return `${i + 1}位　${formatHourRange(row.hour)} 勝率 ${wr}%（${row.total}試合）`;
  }).join("<br>");
}
  };
  
  //gasから帰ってきたユーザ名候補をinputboxの候補リストに入れる
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

// GAS matchHistory の返りを受け取る
window.handleMatchHistoryJsonp = (data) => {
  console.log("📊 match history data:", data);

const points = data.points;
  if (points && points.length) {
const last = points[points.length - 1];
// 最終到達点が 0 より大きいか小さいかで判定
resultByDate[data.date] = last.sum >= 0 ? 1 : -1;

}
  if (silentMode) {
  applyCalendarColors();
  return;
}


  
const chartData = points.map((p, i) => ({
    x: i,
    y: p.sum,
    result: p.result, // 勝ち=1 / 負け=-1
    time: p.time,
    slot: p.slot,
    date: data.date
  }));

const ctx = document.getElementById("matchChart").getContext("2d");

matchChartInstance.data.datasets[0].data = chartData;
  
matchChartInstance.update();
  applyCalendarColors();

};

let availableDates = [];
let currentUserForApi = "";
let silentMode = false;

const resultByDate = {};

window.handleAvailableDatesJsonp = (data) => {
  console.log("availableDates jsonp:", data);
  availableDates = data.dates || [];
  buildCalendar(now.getFullYear(), now.getMonth());
  applyCalendarColors();
  if (availableDates.includes(currentDate)) {
  fetchMatchHistory(currentUserForApi, currentDate);
}
  // 月内の勝敗を静かに取得（色付け用）
silentMode = true;

for (const d of availableDates) {
  fetchMatchHistory(currentUserForApi, d);
}
};

  

function fetchMatchHistory(user, dateStr) {
  if (!silentMode) {
    const old = document.getElementById("jsonpHistory");
    if (old) old.remove();
  }


  const script = document.createElement("script");
  script.id = "jsonpHistory_" + dateStr;
  script.src = GAS_BASE
    + "?action=matchhistory"
    + "&user=" + encodeURIComponent(user)
    + "&date=" + encodeURIComponent(dateStr)　//curentDate入れる
    + "&callback=handleMatchHistoryJsonp"
    + "&_=" + Date.now();
  document.body.appendChild(script);
}

function fetchAvailableDates(user) {
  const old = document.getElementById("jsonpAvailableDates");
  if (old) old.remove();

  const s = document.createElement("script");
  s.id = "jsonpAvailableDates";
  s.src = GAS_BASE
    + "?action=availabledates"
    + "&user=" + encodeURIComponent(user)
    + "&callback=handleAvailableDatesJsonp"
    + "&_=" + Date.now();
  document.body.appendChild(s);
}

//カレンダー生成
function buildCalendar(year, month) {
  const cal = document.getElementById("calendar");
  if (!cal) return;
  cal.innerHTML = "";

  const week = ["日","月","火","水","木","金","土"];
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

  // 前の空白
  for (let i = 0; i < startDay; i++) {
    cal.appendChild(document.createElement("div"));
  }

  // 日付
for (let d = 1; d <= total; d++) {
  const cell = document.createElement("div");
  cell.className = "calendar-cell";
  cell.textContent = d;

  const dateStr =
    year + "-" +
    String(month + 1).padStart(2, "0") + "-" +
    String(d).padStart(2, "0");

  cell.dataset.date = dateStr;
  
  cell.addEventListener("click", () => {
    currentDate = cell.dataset.date;
    applyCalendarColors();
    if (!currentUserForApi) return;
    
    if (availableDates.includes(currentDate)) {
      silentMode = false; 
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

return (
now.getFullYear() + "-" +
String(now.getMonth() + 1).padStart(2, "0") + "-" +
String(now.getDate()).padStart(2, "0")
);
})();

cells.forEach(cell => {
  const d = cell.dataset.date;
  if (!d) return;

  cell.classList.remove("today", "selected", "nodata", "win", "loss");
  const r = resultByDate[d];
  
  if (r === 1) {
    cell.classList.add("win");
  } else if (r === -1) {
    cell.classList.add("loss");
  }

  if (d === currentDate) {
    cell.classList.add("selected");
  }

  if (d === today) {
    cell.classList.add("today");
  }

  if (!availableDates.includes(d)) {
    cell.classList.add("nodata");
  }
});
}  

buildCalendar(now.getFullYear(), now.getMonth());
  applyCalendarColors();
  
//ユーザ名候補を取りに行く
function fetchUsers(qText) {
  const q = encodeURIComponent(String(qText || "").replace(/\s+/g, ""));
  const oldUsers = document.getElementById("jsonpUsers");
  if (oldUsers) oldUsers.remove();

  const su = document.createElement("script");
  su.id = "jsonpUsers";
  su.src = GAS_BASE
    + "?action=users"
    + "&q=" + q
    + "&callback=handleUsersJsonp"
    + "&_=" + Date.now();
  document.body.appendChild(su);
}

  //キャラ名選択後にgasにjsonpで取りに行く
  input.addEventListener("input", () => {
    clearTimeout(timer);
    
    timer = setTimeout(() => {
      const user = input.value.trim();
      fetchUsers(user);
      
      const userForApi = user.replace(/\s+/g, ""); // スペース消す
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
  fetchUsers("");
});
