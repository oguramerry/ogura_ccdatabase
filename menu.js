// menu.js
function initMenu() {
  const path = window.location.pathname;
  const isSubFolder = path.includes('/upload') || path.includes('/dashboard') || path.includes('/global');
  const base = isSubFolder ? '../' : './';

  const style = document.createElement('style');
  style.textContent = `
    /* --- ヘッダー領域（ロゴとボタンを横並びにする） --- */
    .site-header {
      position: fixed;
      top: 15px;
      left: 15px;
      z-index: 1000;
      display: flex;
      align-items: center; /* 上下中央揃え */
      gap: 15px; /* ロゴとボタンの間隔 */
    }

    /* --- ロゴのスタイル --- */
    .site-logo img {
      display: block;
      width: 100px; /* ここでロゴの大きさを調整*/
      height: auto;
      transition: 0.3s;
    }
    .site-logo a:hover img {
      opacity: 0.8; /* カーソルを乗せた時に少し薄くする */
    }

    /* --- メニューボタン（三本線に戻す） --- */
    .menu-btn {
      position: relative; /* fixedから変更 */
      width: 44px; height: 44px;
      background-color: var(--main-blue); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 0 var(--accent-blue); cursor: pointer; border: none;
      padding: 0;
    }
    /* 三本線のデザイン */
    .menu-btn span, .menu-btn span::before, .menu-btn span::after {
      display: block; width: 20px; height: 3px; background-color: white;
      border-radius: 2px; position: absolute; transition: 0.3s;
      content: "";
    }
    .menu-btn span::before { top: -6px; }
    .menu-btn span::after { top: 6px; }
    /* 開いた時のバツ印 */
    .menu-btn.is-open span { background: transparent; }
    .menu-btn.is-open span::before { transform: rotate(45deg); top: 0; }
    .menu-btn.is-open span::after { transform: rotate(-45deg); top: 0; }


    /* --- サイドメニューとオーバーレイ（ここはそのまま） --- */
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

  // HTMLの注入（ヘッダーの中にロゴとボタンを入れる）
  const menuHTML = `
    <header class="site-header">
      <div class="site-logo">
        <a href="${base}index.html">
          <img src="${base}images/shu_shima.png" alt="トップページへ">
        </a>
      </div>
      <button id="menuBtn" class="menu-btn" aria-label="メニューを開く">
        <span></span>
      </button>
    </header>

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
