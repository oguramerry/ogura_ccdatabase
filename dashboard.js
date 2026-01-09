const GAS_BASE =
  "https://script.google.com/macros/s/AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec";

console.log("mode: jsonp only");

document.addEventListener("DOMContentLoaded", () => {
  let statsData = null;
  const input = document.getElementById("userInput");
  const tabs = document.getElementById("tabButtons");
  let activeTab = "main";
  const panelInner = document.getElementById("panelInner");
  const render = () => {
    if (!panelInner) return;

    if (!statsData) {
      panelInner.textContent = "ユーザーを入力してね（まだデータなし）";
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

  const top3 = Object.entries(map)
    .sort((a, b) => (b[1].winRate ?? 0) - (a[1].winRate ?? 0))
    .slice(0, 3);

  panelInner.innerHTML = `
    <div class="stat-card">
      <p class="stat-title">ジョブ top3（勝率）</p>
      <p class="stat-body">
        ${top3.map(([job, v], i) =>
          `${i + 1}位 ${job} ${((v.winRate ?? 0) * 100).toFixed(1)}%`
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
    
      panelInner.innerHTML = `
      <div class="stat-card">
      <p class="stat-title">ステージ</p>
      <p class="stat-body">
      ステージ数 ${Object.keys(map).length}
    </p>
  </div>
  `;
    }

    else if (activeTab === "jobStage") {
      const map = statsData.byStageJob;
      if (!map) {
        panelInner.textContent = "job*stage 集計なし";
        return;
      }
      
      panelInner.innerHTML = `
        <div class="stat-card">
          <p class="stat-title">ジョブ × ステージ</p>
          <p class="stat-body">
            組み合わせ数 ${Object.keys(map).length}
          </p>
        </div>
      `;
    }

    else if (activeTab === "time") {
      panelInner.innerHTML = `
        <div class="stat-card">
          <p class="stat-title">時間帯 / 曜日</p>
          <p class="stat-body">
            時間帯 ${statsData.byHour ? "あり" : "なし"}<br>
            曜日 ${statsData.byHourWeekday ? "あり" : "なし"}
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
    statsData = data;
    render();
    const el = document.getElementById("result");
    if (!el) return;
    const m = data.meta;
    
    const h = document.getElementById("highlight");
    if (h) {
     h.querySelector("p:last-child").textContent =
       `試合数 ${m.total} / 勝率 ${m.winRate != null ? (m.winRate * 100).toFixed(1) + "%" : "-"}`;
    }

    const stageEl = document.getElementById("topStageBody");
    if (stageEl) stageEl.textContent = "あとでここにステージtop3が入るよ";
  };

  window.handleUsersJsonp = (data) => {
    const list = document.getElementById("userList");
    if (!list) return;

    list.innerHTML = "";
    const users = data.users || [];
    for (const u of users) {
      const opt = document.createElement("option");
      opt.value = u;
      list.appendChild(opt);
    }
  };

  // users を先に読み込み
  const sUsers = document.createElement("script");
  sUsers.src = GAS_BASE + "?action=users&callback=handleUsersJsonp&_=" + Date.now();
  document.body.appendChild(sUsers);

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const user = input.value.trim();
      if (!user) return;

      const old = document.getElementById("jsonpStats");
      if (old) old.remove();

      const s = document.createElement("script");
      s.id = "jsonpStats";
      s.src = GAS_BASE + "?action=stats&user=" + encodeURIComponent(user) + "&callback=handleStatsJsonp&_=" + Date.now();
      document.body.appendChild(s);
    }, 500);
  });
});
