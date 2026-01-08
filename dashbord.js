
  <script>
    console.log("mode: jsonp only");

    document.addEventListener("DOMContentLoaded", () => {
      const input = document.getElementById("userInput");
      let timer = null;

      window.handleStatsJsonp = (data) => {
  console.log("gas stats(jsonp):", data);

  const el = document.getElementById("result");
  if (!el) return;

  const m = data.meta;
  el.textContent =
    `試合数 ${m.total} / 勝ち ${m.wins} / 負け ${m.losses} / 勝率 ${m.winRate ?? "-"}`;
        const h = document.getElementById("highlight");
if (h) {
  h.querySelector("p:last-child").textContent =
    `試合数 ${m.total} / 勝率 ${m.winRate ?? "-"}`;
}

const stageEl = document.getElementById("topStageBody");
if (stageEl) stageEl.textContent = "あとでここにステージtop3が入るよ";

        
};

      window.handleUsersJsonp = (data) => {
  console.log("gas users(jsonp):", data);

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
        const sUsers = document.createElement("script");
  sUsers.src =
    "https://script.google.com/macros/s/AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec" +
    "?action=users&callback=handleUsersJsonp" +
    "&_=" + Date.now();
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
          s.onload = () => console.log("jsonp script loaded");
          s.onerror = () => console.log("jsonp script load failed");

          s.src =
            "https://script.google.com/macros/s/AKfycbzC2xkZsjdr4amOc3cc0xvFLubZOfsi3G7Aw5uiqklXDJWnRKUeu6z0cwK7d144Jdi83w/exec" +
            "?action=stats&user=" + encodeURIComponent(user) +
            "&callback=handleStatsJsonp" +
            "&_=" + Date.now();

          console.log("jsonp url:", s.src);
          document.body.appendChild(s);
        }, 500);
      });
    });
<script src="./dashboard.js">
  </script>
