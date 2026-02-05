// menu.js
function initMenu() {
  const path = window.location.pathname;
  const isSubFolder = path.includes('/upload') || path.includes('/dashboard') || path.includes('/global');
  const base = isSubFolder ? '../' : './';

  const style = document.createElement('style');
  style.textContent = `
    /* ボタンの背景や枠をすべて透明にする */
    .menu-btn {
      position: fixed !important; 
      top: 10px !important;   /* 上の隙間 */
      left: 10px !important;  /* 左の隙間 */
      background: none !important; /* 背景色を消去 */
      border: none !important;     /* 枠線を消去 */
      box-shadow: none !important;  /* 影を消去 */
      padding: 0 !important;
      margin: 0 !important;
      cursor: pointer;
      z-index: 9999 !important;
    }

    /* ロゴの大きさをここで決める */
    .menu-btn img {
      width: 120px;
      height: auto;
      display: block;
      transition: 0.2s;
    }

    /* 押した時に少しだけ透明にして、反応してることを分からせる */
    .menu-btn:active img {
      opacity: 0.7;
      transform: scale(0.95);
    }

    /* サイドメニュー（ここは元のまま） */
    .side-menu {
      position: fixed; top: 0; left: -260px; width: 250px; height: 100%;
      background: white; z-index: 9998; transition: 0.4s; padding-top: 80px;
      border-radius: 0 24px 24px 0; box-shadow: 10px 0 25px rgba(163, 219, 240, 0.2);
    }
    .side-menu.is-open { left: 0; }
    .side-menu ul { list-style: none; padding: 0; margin: 0; }
    .side-menu li a {
      display: block; padding: 15px 25px; color: #333;
      text-decoration: none; font-weight: bold; transition: 0.2s;
    }
    .side-menu li a:hover { background: #f0faff; padding-left: 35px; }

    .overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(163, 219, 240, 0.3); backdrop-filter: blur(2px);
      z-index: 9997; opacity: 0; visibility: hidden; transition: 0.3s;
    }
    .overlay.is-open { opacity: 1; visibility: visible; }
  `;
  document.head.appendChild(style);

  const menuHTML = `
    <button id="menuBtn" class="menu-btn" aria-label="メニューを開く">
      <img src="${base}images/shu_shima.png" alt="メニュー">
    </button>
    <div id="overlay" class="overlay"></div>
    <nav id="sideMenu" class="side-menu">
      <ul>
        <li><a href="${base}index.html">・TOP</a></li>
        <li><a href="${base}global/index.html">・戦場レポート</a></li>
        <li><a href="${base}dashboard/index.html">・こんくりラボ</a></li>
        <li><a href="${base}upload/index.html">・リザルト送信BOX</a></li>
      </ul>
    </nav>
  `;
  document.body.insertAdjacentHTML('afterbegin', menuHTML);

  const menuBtn = document.getElementById("menuBtn");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");

  function toggleMenu() {
    sideMenu.classList.toggle("is-open");
    overlay.classList.toggle("is-open");
  }

  menuBtn.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
}

document.addEventListener("DOMContentLoaded", initMenu);
