// dashboard.js

const GAS_BASE =
  "https://script.google.com/macros/s/AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec";

console.log("mode: jsonp only");

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

function formatCharacterName(name) {
  if (!name) return name;

  // すでに半角スペースがあるならそのまま
  if (name.includes(" ")) return name;

  // OguraChan -> Ogura Chan みたいに分割
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

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

document.addEventListener("DOMContentLoaded", () => {
  let statsData = null;
  const input = document.getElementById("userInput");
  const tabs = document.getElementById("tabButtons");
  let activeTab = "main";
  const panelInner = document.getElementById("panelInner");
  const render = () => {
    if (!panelInner) return;
    
if (!statsData) {
  return;
}

    
    if (activeTab === "main") {
  const m = statsData.meta || {};
  const winRateText =
    m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-";

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

else if (activeTab === "job") {
  const map = statsData.byJob;
  if (!map) {
    panelInner.textContent = "job 集計なし";
    return;
  }

const ranking = map
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

else if (activeTab === "jobStage") {
  const arr = statsData.byStageJob;
  if (!arr || !arr.length) {
    panelInner.textContent = "job*stage 集計なし";
    return;
  }

  const ranking = arr
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
else if (activeTab === "time") {
  const arr = statsData.byHour;
  if (!arr || !arr.length) {
    panelInner.textContent = "時間帯 集計なし";
    return;
  }

  const ranking = arr
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
  
  window.handleStatsJsonp = (data) => {
    console.log("handleStatsJsonp called", data);
    statsData = data;
    console.log("byStage sample", statsData.byStage?.[0]);
    render();
    const el = document.getElementById("result");
    if (!el) return;
    const m = data.meta;
    const resultEl = document.getElementById("result");
    if (resultEl) {
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
    return `${i + 1}位　${row.stage}<br>勝率 ${wr}%（${row.total}試合）`;
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
    return `${i + 1}位　${jobJp}<br>勝率 ${wr}%（${row.total}試合）`;
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
    return `${i + 1}位　${formatHourRange(row.hour)}<br>勝率 ${wr}%（${row.total}試合）`;
  }).join("<br>");
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
  
  input.addEventListener("input", () => {
    clearTimeout(timer);
    
    timer = setTimeout(() => {
      const user = input.value.trim();
      fetchUsers(user);
      const userForApi = user.replace(/\s+/g, ""); // スペース消す
      if (!userForApi) return;

      const old = document.getElementById("jsonpStats");
      if (old) old.remove();

      const s = document.createElement("script");
      s.id = "jsonpStats";
      s.src = GAS_BASE + "?action=stats&user=" + encodeURIComponent(userForApi) + "&callback=handleStatsJsonp&_=" + Date.now();
      document.body.appendChild(s);
    }, 500);
  });
  fetchUsers("");
});
