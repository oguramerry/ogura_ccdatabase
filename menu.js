// menu.js
function initMenu() {
  const path = window.location.pathname;
  const isSubFolder = path.includes('/upload') || path.includes('/dashboard') || path.includes('/global');
  const base = isSubFolder ? '../' : './';

  const style = document.createElement('style');
  style.textContent = `
    .menu-btn {
      position: fixed; top: 15px; left: 15px; width: 44px; height: 44px;
      background-color: var(--main-blue); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; box-shadow: 0 4px 0 var(--accent-blue); cursor: pointer; border: none;
      padding: 0; /* 画像を端まで表示するために余白を0に */
      overflow: hidden;
    }

    .menu-btn img {
      width: 100%;
      height: 100%;
      object-fit: contain; /* 画像をボタン内に収める */
      pointer-events: none;
    }

    .menu-btn.is-open img {
      opacity: 0.7; /* メニューが開いている時に少し薄くする */
    }

    .side-menu {
      position: fixed; top: 0; left: -260px; width: 250px; height: 100%;
      background: white; z-index: 999; transition: 0.4s; padding-top: 80px;
      border-radius: 0 24px 24px 0; box-shadow: 10px 0 25px rgba(163, 219, 240, 0.2);
    }
    .side-menu.is-open { left: 0; }
    .side-menu ul { list-style: none; padding: 0; margin: 0; }
    .side-menu li a {
      display: block; padding: 15px 25px; color: var(--text-color);
      text-decoration: none; font-weight: bold; transition: 0.2s;
    }
    .side-menu li a:hover { background: #f0faff; color: var(--accent-pink); padding-left: 35px; }

    .overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(163, 219, 240, 0.3); backdrop-filter: blur(2px);
      z-index: 998; opacity: 0; visibility: hidden; transition: 0.3s;
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
    menuBtn.classList.toggle("is-open");
    sideMenu.classList.toggle("is-open");
    overlay.classList.toggle("is-open");
  }

  menuBtn.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
}

document.addEventListener("DOMContentLoaded", initMenu);
