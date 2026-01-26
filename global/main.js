const API_URL = "https://script.google.com/macros/s/AKfycbxCOYEGborjJzpnyd1lG5_MeX3BDmQvjLC-NqN8MpKnr6YRBgcfz962kRFJsiFkb7RXdg/exec";

// データを切り替えるために一時保存しておく変数
let globalData = null;

document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();
});

async function fetchGlobalData() {
  try {
    const res = await fetch(`${API_URL}?action=global`);
    const data = await res.json();
    
    // データを保存（あとでフィルターする時に使う）
    globalData = data;

    // ステージ選択肢を作る
    initStageSelector(data.byStage);

    // 最初は「全部」で描画
    updateDashboard("ALL");

    // 時間帯グラフだけは全体データで固定表示（ステージ別の時間データはないため）
    renderHourChart(data.byHour);

  } catch (err) {
    console.error("データ取得エラー:", err);
    alert("データの読み込みに失敗しました");
  }
}

// ▼ ステージ選択肢を生成する
function initStageSelector(stages) {
  const sel = document.getElementById("stage-selector");
  
  // ステージ名でソート（あいうえお順）
  stages.sort((a, b) => a.stage.localeCompare(b.stage));

  stages.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.stage;
    opt.textContent = `${s.stage} (${Math.floor(s.total/10)}試合)`; // 表示用に試合数もつける
    sel.appendChild(opt);
  });

  // 変更されたらグラフを書き換えるイベント
  sel.addEventListener("change", (e) => {
    updateDashboard(e.target.value);
  });
}

// ▼ 選択されたステージに合わせてグラフを更新する司令塔
function updateDashboard(stageName) {
  let targetData;     // 描画するジョブデータ
  let currentTotal;   // その時の総試合数

  if (stageName === "ALL") {
    // 全ステージの場合
    targetData = globalData.byJob;
    currentTotal = globalData.meta.total;
  } else {
    // 特定のステージの場合
    // byStageJob（ステージ×ジョブ）の中から、選ばれたステージだけを抜き出す
    targetData = globalData.byStageJob.filter(d => d.stage === stageName);
    
    // そのステージの総試合数を探す
    const stageInfo = globalData.byStage.find(s => s.stage === stageName);
    currentTotal = stageInfo ? stageInfo.total : 0;
  }

  // 1. 総観測数の表示更新
  const displayCount = Math.floor(currentTotal / 10);
  document.getElementById("total-matches").textContent = `${displayCount} 試合`;

  // 2. 各グラフの再描画
  renderJobPieChart(targetData);
  renderWinRateChart(targetData);
  renderDamageChart(targetData);
  renderJobTable(targetData, currentTotal);
}


// --- 以下、グラフ描画関数（中身はほぼ変更なし） ---

function renderJobPieChart(jobData) {
  // キャンバスをリセット（再描画時のバグ防止）
  resetCanvas("jobPieChart");
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  const topList = sorted.slice(0, 8);
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.total, 0);
  
  const labels = topList.map(d => JOB_NAME_JP[d.job] || d.job);
  const values = topList.map(d => d.total);
  
  if (otherTotal > 0) {
    labels.push("その他");
    values.push(otherTotal);
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

  // 試合数が少ないと信頼できないのでフィルタ（ステージ別だと母数が減るので緩和してもいいかも）
  const threshold = 1; // 1試合でもあれば表示する設定に変更
  const filtered = jobData
    .filter(d => d.total >= threshold)
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
  // 時間帯チャートはステージ切り替え対象外なのでリセット不要だが念のため
  resetCanvas("hourChart");
  const ctx = document.getElementById("hourChart").getContext("2d");
  
  const hours = Array.from({length: 24}, (_, i) => i);
  const counts = hours.map(h => {
    const found = hourData.find(d => Number(d.hour) === h);
    return found ? found.total : 0;
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

  const filtered = jobData
    .filter(d => d.total >= 1)
    .map(d => ({
      ...d,
      avgDmg: (typeof d.avgDamage === "number") ? d.avgDamage : (d.total ? (Number(d.sumDamage)||0)/d.total : 0)
    }))
    .sort((a, b) => b.avgDmg - a.avgDmg);

  const labels = filtered.map(d => JOB_NAME_JP[d.job] || d.job);
  const data = filtered.map(d => Math.round(d.avgDmg));

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

function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  
  let list = jobData.map(d => {
    const getVal = (val, sumName) => {
      if (typeof val === "number") return val;
      return d.total ? (Number(d[sumName]) || 0) / d.total : 0;
    };

    return {
      name: JOB_NAME_JP[d.job] || d.job,
      winRate: (d.wins / d.total) * 100,
      pickRate: currentTotalMatches ? (d.total / currentTotalMatches) * 100 : 0,
      
      avgK: getVal(d.avgK, "sumK"),
      avgD: getVal(d.avgD, "sumD"),
      avgA: getVal(d.avgA, "sumA"),
      avgDmg: getVal(d.avgDamage, "sumDamage"),
      avgTaken: getVal(d.avgTaken, "sumTaken"),
      avgHeal: getVal(d.avgHeal, "sumHeal"),

      raw: d
    };
  });

  const draw = (sortedList) => {
    tbody.innerHTML = "";
    sortedList.forEach(d => {
      const tr = document.createElement("tr");
      const winClass = d.winRate >= 50 ? "rate-high" : "rate-low";
      const fmt = (n) => Math.round(n).toLocaleString();

      tr.innerHTML = `
        <td style="text-align:left; font-weight:500;">${d.name}</td>
        <td class="${winClass}">${d.winRate.toFixed(1)}%</td>
        <td>${d.pickRate.toFixed(1)}%</td>
        <td>${d.avgK.toFixed(2)}</td>
        <td>${d.avgD.toFixed(2)}</td>
        <td>${d.avgA.toFixed(2)}</td>
        <td style="font-weight:bold; color:#d69e2e;">${fmt(d.avgDmg)}</td>
        <td style="font-weight:bold; color:#e53e3e;">${fmt(d.avgTaken)}</td>
        <td style="font-weight:bold; color:#38a169;">${fmt(d.avgHeal)}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  list.sort((a, b) => b.winRate - a.winRate);
  draw(list);

  ths.forEach(th => {
    // 古いイベントリスナーが重複しないよう、クローンして置換（簡易リセット）
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

// Chart.js の再描画バグを防ぐためのヘルパー
function resetCanvas(id) {
  const oldCanv = document.getElementById(id);
  const container = oldCanv.parentElement;
  oldCanv.remove();
  
  const newCanv = document.createElement("canvas");
  newCanv.id = id;
  container.appendChild(newCanv);
}
