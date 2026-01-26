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

// 3. 時間帯別（折れ線＋棒グラフ）
function renderHourChart(hourData) {
  resetCanvas("hourChart");
  const ctx = document.getElementById("hourChart").getContext("2d");
  
  const hours = Array.from({length: 24}, (_, i) => i);
  const counts = hours.map(h => {
    const found = hourData.find(d => Number(d.hour) === h);
    // ★修正：ここでも ÷10 して切り捨て処理を入れました！
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
      scales: {
        y: { beginAtZero: true }
      }
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

// global/main.js の renderJobTable 関数

function renderJobTable(jobData, currentTotalMatches) {
  const tbody = document.querySelector("#job-stats-table tbody");
  const ths = document.querySelectorAll("#job-stats-table th");
  
  // データ加工
  let list = jobData.map(d => {
    // 現在のモードに合わせて表示用データを作る（ここは前回と同じ）
    const p = (key) => {
      if (currentViewMode === "WIN") return d["w_" + key] || 0;
      if (currentViewMode === "LOSE") return d["l_" + key] || 0;
      return d[key] || 0; 
    };

    return {
      name: JOB_NAME_JP[d.job] || d.job,
      jobKey: d.job, // ★クリック時に使う元の英語名
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
  
  // (ソート機能はそのまま)
  ths.forEach(th => {
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

// --- 以下、モーダル（カード詳細）用の処理 ---

// カードを開く
function openModal(jobKey) {
  // グローバルデータから該当ジョブを探す
  // (currentViewModeに関係なく、現在のステージデータから探す)
  // updateDashboardで使っている targetData はローカル変数なので、
  // globalData から探し直します。
  
  // 今選ばれているステージを取得
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

  // ジョブ名セット
  document.getElementById("modal-job-name").textContent = 
    (JOB_NAME_JP[d.job] || d.job) + " の詳細データ";

  // テーブルの中身を作る関数
  const fmt = (n) => Math.round(n).toLocaleString();
  const fmt2 = (n) => n.toFixed(2);
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 3行分のHTML生成
  const makeRow = (label, cls, prefix) => {
    // prefixが空なら全体、"w_"なら勝ち、"l_"なら負け
    const p = (key) => d[prefix + key] || d[key] || 0; 
    
    // データがない場合(0試合など)のガード
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

  document.getElementById("modal-stats-body").innerHTML = html;

  // 表示
  document.getElementById("job-detail-modal").style.display = "flex";
}

// カードを閉じる
function closeModal() {
  document.getElementById("job-detail-modal").style.display = "none";
}

// モーダルの外側をクリックしたら閉じる
document.getElementById("job-detail-modal").addEventListener("click", (e) => {
  if (e.target.id === "job-detail-modal") {
    closeModal();
  }
});
