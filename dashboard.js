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

    if (activeTab === "main") panelInner.textContent = "main を表示（仮）";
    else if (activeTab === "job") panelInner.textContent = "job を表示（仮）";
    else if (activeTab === "stage") panelInner.textContent = "stage を表示（仮）";
    else if (activeTab === "jobStage") panelInner.textContent = "job*stage を表示（仮）";
    else if (activeTab === "time") panelInner.textContent = "🕒 を表示（仮）";
    else panelInner.textContent = "unknown tab: " + activeTab;
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

// deploy refresh

