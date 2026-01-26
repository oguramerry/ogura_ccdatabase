// ★ご自身のGASのURLであることを確認してください
const API_URL = "https://script.google.com/macros/s/AKfycbxCOYEGborjJzpnyd1lG5_MeX3BDmQvjLC-NqN8MpKnr6YRBgcfz962kRFJsiFkb7RXdg/exec";

// --- グローバル変数 ---
let globalData = null;       // 全データ保存用
let currentViewMode = "ALL"; // ALL(全体), WIN(勝), LOSE(負) ★これが抜けていました！

// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();

  // 勝ち負け切り替えボタンの監視
  const radios = document.querySelectorAll('input[name="viewMode"]');
  radios.forEach(r => {
    r.addEventListener("change", (e) => {
      currentViewMode = e.target.value;
      const sel = document.getElementById("stage-selector");
      updateDashboard(sel ? sel.value : "ALL");
    });
  });

  // モーダルの外側クリックで閉じる処理
  const modal = document.getElementById("job-detail-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "job-detail-modal") {
        closeModal();
      }
    });
  }
});

async function fetchGlobalData() {
  try {
    const res = await fetch(`${API_URL}?action=global`);
    const data = await res.json();
    
    globalData = data;

    // ステージ選択肢生成
    initStageSelector(data.byStage);

    // 初期描画
    updateDashboard("ALL");

    // 時間帯グラフ（全体固定）
    renderHourChart(data.byHour);

  } catch (err) {
    console.error("データ取得エラー:", err);
    alert("データの読み込みに失敗しました");
  }
}

// ▼ ステージ選択肢
function initStageSelector(stages) {
  const sel = document.getElementById("stage-selector");
  if (!sel) return;

  stages.sort((a, b) => a.stage.localeCompare(b.stage));

  stages.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.stage;
    opt.textContent = `${s.stage} (${Math.floor(s.total/10)}試合)`;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", (e) => {
    updateDashboard(e.target.value);
  });
}

// ▼ 画面更新の司令塔
function updateDashboard(stageName) {
  let targetData;
  let currentTotal;

  if (stageName === "ALL") {
    targetData = globalData.byJob;
    currentTotal = globalData.meta.total;
  } else {
    targetData = globalData.byStageJob.filter(d => d.stage === stageName);
    const stageInfo = globalData.byStage.find(s => s.stage === stageName);
    currentTotal = stageInfo ? stageInfo.total : 0;
  }

  // 総観測数
  const displayCount = Math.floor(currentTotal / 10);
  const totalEl = document.getElementById("total-matches");
  if (totalEl) totalEl.textContent = `${displayCount} 試合`;

  // グラフ再描画
  renderJobPieChart(targetData);
  renderWinRateChart(targetData);
  renderDamageChart(targetData);
  
  // テーブル再描画（ここで currentViewMode を使う）
  renderJobTable(targetData, currentTotal);
}


// --- グラフ描画関数 ---

function renderJobPieChart(jobData) {
  resetCanvas("jobPieChart");
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  const topList = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.total, 0);
  
  // 円グラフも ÷10 表記にする
  const labels = topList.map(d => JOB_NAME_JP[d.job] || d.job);
  const values = topList.map(d => Math.floor(d.total / 10));
  
  if (otherTotal > 0) {
    labels.push("その他");
    values.push(Math.floor(otherTotal / 10));
  }

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#63b3ed', '#4fd1c5', '#f6e05e', '#f687b3', 
          '#9f7aea', '#ed8936', '#a0aec0', '#48bb78', '#cbd5e0'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });
}

function renderWinRateChart(jobData) {
  resetCanvas("jobWinRateChart");
  const ctx = document.getElementById("jobWinRateChart").getContext("2d");

  const filtered = jobData
    .filter(d => d.total >= 1)
    .sort((a, b) => (b.wins / b.total) - (a.wins / a.total));

  const labels = filtered.map(d => JOB_NAME_JP[d.job] || d.job);
  const rates = filtered.map(d => ((d.wins / d.total) * 100).toFixed(1));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '勝率 (%)',
        data: rates,
        backgroundColor: rates.map(r => r >= 50 ? '#68d391' : '#fc8181'),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, max: 100 } }
    }
  });
}

function renderHourChart(hourData) {
  resetCanvas("hourChart");
  const ctx = document.getElementById("hourChart").getContext("2d");
  
  const hours = Array.from({length: 24}, (_, i) => i);
  const counts = hours.map(h => {
    const found = hourData.find(d => Number(d.hour) === h);
    return found ? Math.floor(found.total / 10) : 0;
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.map(h => `${h}時`),
      datasets: [{
        label: '観測された試合数',
        data: counts,
        backgroundColor: '#90cdf4',
        borderRadius: 4
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderDamageChart(jobData) {
  resetCanvas("damageChart");
  const ctx = document.getElementById("damageChart").getContext("2d");

  // currentViewMode に応じて表示データを変える
  const getKey = () => {
    if (currentViewMode === "WIN") return "w_avgDamage";
    if (currentViewMode === "LOSE") return "l_avgDamage";
    return "avgDamage";
  };
  // データがまだ無い場合のガード（Undefined対策）
  const getVal = (d) => {
    const key = getKey();
    // すでに計算済みの平均値があればそれを使う、なければ計算
    if (typeof d[key] === "number") return d[key];
    if (key === "avgDamage") return d.total ? (Number(d.sumDamage)||0)/d.total : 0;
    return 0; 
  };

  const filtered = jobData
    .filter(d => d.total >= 1)
    .map(d => ({ ...d, _val: getVal(d) }))
    .sort((a, b) => b._val - a._val);

  const labels = filtered.map(d => JOB_NAME_JP[d.job] || d.job);
  const data = filtered.map(d => Math.round(d._val));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '平均与ダメージ',
        data: data,
        backgroundColor: '#f6ad55',
        borderRadius: 4
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// --- テーブル描画（モーダル連携あり） ---
function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  
  if (!tbody) return;

  let list = jobData.map(d => {
    // 現在のモードに合わせて表示用データを作る
    const p = (key) => {
      if (currentViewMode === "WIN") return d["w_" + key] || 0;
      if (currentViewMode === "LOSE") return d["l_" + key] || 0;
      return d[key] || 0; 
    };

    return {
      name: JOB_NAME_JP[d.job] || d.job,
      jobKey: d.job, // クリック時に使う元の英語名
      winRate: (d.wins / d.total) * 100,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      
      avgK: p("avgK"),
      avgD: p("avgD"),
      avgA: p("avgA"),
      avgDmg: p("avgDamage"),
      avgTaken: p("avgTaken"),
      avgHeal: p("avgHeal"),
      avgTime: p("avgTime"),

      raw: d // 全データ（これを使ってモーダルを出す！）
    };
  });

  const draw = (sortedList) => {
    tbody.innerHTML = "";
    sortedList.forEach(d => {
      const tr = document.createElement("tr");
      const winClass = d.winRate >= 50 ? "rate-high" : "rate-low";
      const fmt = (n) => Math.round(n).toLocaleString();
      const fmtTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      tr.innerHTML = `
        <td style="text-align:left; font-weight:500;" class="clickable-job" onclick="openModal('${d.jobKey}')">
          ${d.name} <span style="font-size:0.8em; color:#718096;">❐</span>
        </td>

        <td class="${winClass}">${d.winRate.toFixed(1)}%</td>
        <td>${d.pickRate.toFixed(1)}%</td>
        <td>${d.avgK.toFixed(2)}</td>
        <td>${d.avgD.toFixed(2)}</td>
        <td>${d.avgA.toFixed(2)}</td>
        <td style="font-weight:bold; color:#d69e2e;">${fmt(d.avgDmg)}</td>
        <td style="font-weight:bold; color:#e53e3e;">${fmt(d.avgTaken)}</td>
        <td style="font-weight:bold; color:#38a169;">${fmt(d.avgHeal)}</td>
        <td style="font-weight:bold; color:#718096;">${fmtTime(d.avgTime)}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  list.sort((a, b) => b.winRate - a.winRate);
  draw(list);
  
  // ソート機能
  ths.forEach(th => {
    // 既存のリスナーを削除するためにクローンして置換
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
    newTh.addEventListener("click", () => {
      const key = newTh.dataset.key;
      if (!key) return;
      list.sort((a, b) => {
        if (key === "job") return a.name.localeCompare(b.name);
        return b[key] - a[key];
      });
      draw(list);
    });
  });
}


// --- 以下、モーダル（カード詳細）用の処理 ---

function openModal(jobKey) {
  // グローバルデータから該当ジョブを探す
  const sel = document.getElementById("stage-selector");
  const currentStage = sel ? sel.value : "ALL";
  
  let targetList;
  if (currentStage === "ALL") {
    targetList = globalData.byJob;
  } else {
    targetList = globalData.byStageJob.filter(d => d.stage === currentStage);
  }

  const d = targetList.find(j => j.job === jobKey);
  if (!d) return;

  const nameEl = document.getElementById("modal-job-name");
  if (nameEl) {
    nameEl.textContent = (JOB_NAME_JP[d.job] || d.job) + " の詳細データ";
  }

  // テーブルの中身を作る
  const fmt = (n) => Math.round(n).toLocaleString();
  const fmt2 = (n) => n.toFixed(2);
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const makeRow = (label, cls, prefix) => {
    // prefixが空なら全体、"w_"なら勝ち、"l_"なら負け
    const p = (key) => d[prefix + key] || d[key] || 0; 
    
    // データがない場合のガード
    if (label === "勝利" && d.wins === 0) return `<tr class="${cls}"><td>${label}</td><td colspan="7">データなし</td></tr>`;
    if (label === "敗北" && d.losses === 0) return `<tr class="${cls}"><td>${label}</td><td colspan="7">データなし</td></tr>`;

    return `
      <tr class="${cls}">
        <td>${label}</td>
        <td>${fmt2(p("avgK"))}</td>
        <td>${fmt2(p("avgD"))}</td>
        <td>${fmt2(p("avgA"))}</td>
        <td style="color:#d69e2e">${fmt(p("avgDamage"))}</td>
        <td style="color:#e53e3e">${fmt(p("avgTaken"))}</td>
        <td style="color:#38a169">${fmt(p("avgHeal"))}</td>
        <td style="color:#718096">${fmtTime(p("avgTime"))}</td>
      </tr>
    `;
  };

  const html = 
    makeRow("全体", "row-all", "") +
    makeRow("勝利", "row-win", "w_") +
    makeRow("敗北", "row-lose", "l_");

  const bodyEl = document.getElementById("modal-stats-body");
  if (bodyEl) bodyEl.innerHTML = html;

  const modal = document.getElementById("job-detail-modal");
  if (modal) modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("job-detail-modal");
  if (modal) modal.style.display = "none";
}

// Chart.js の再描画バグを防ぐヘルパー
function resetCanvas(id) {
  const oldCanv = document.getElementById(id);
  if (!oldCanv) return;
  const container = oldCanv.parentElement;
  oldCanv.remove();
  
  const newCanv = document.createElement("canvas");
  newCanv.id = id;
  container.appendChild(newCanv);
}
