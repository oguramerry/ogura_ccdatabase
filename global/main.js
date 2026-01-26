

const API_URL = "https://script.google.com/macros/s/AKfycbxCOYEGborjJzpnyd1lG5_MeX3BDmQvjLC-NqN8MpKnr6YRBgcfz962kRFJsiFkb7RXdg/exec";

// ページ読み込み時に実行
document.addEventListener("DOMContentLoaded", () => {
  fetchGlobalData();
});

async function fetchGlobalData() {
  try {
    // action=global で全体データを取得
    const res = await fetch(`${API_URL}?action=global`);
    const data = await res.json();
    
    // サマリー表示
    document.getElementById("total-matches").textContent = `${data.meta.total} 試合`;
    const matchCount = Math.floor(data.meta.total / 10);
    
    // グラフ描画
    renderJobPieChart(data.byJob);
    renderWinRateChart(data.byJob);
    renderHourChart(data.byHour);

  } catch (err) {
    console.error("データ取得エラー:", err);
    alert("データの読み込みに失敗しました");
  }
}

// 1. 人気ジョブ（円グラフ）
function renderJobPieChart(jobData) {
  const ctx = document.getElementById("jobPieChart").getContext("2d");
  
  // 試合数が多い順にソート
  const sorted = [...jobData].sort((a, b) => b.total - a.total);
  
  // 上位8つ＋その他にまとめる
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
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

// 2. 勝率ティア（横棒グラフ）
function renderWinRateChart(jobData) {
  const ctx = document.getElementById("jobWinRateChart").getContext("2d");

  // 試合数が5回以上のジョブのみ対象（信頼性のため）＆勝率順
  const filtered = jobData
    .filter(d => d.total >= 5)
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
        backgroundColor: rates.map(r => r >= 50 ? '#68d391' : '#fc8181'), // 50%以上は緑、以下は赤
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y', // 横棒にする魔法
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, max: 100 }
      }
    }
  });
}

// 3. 時間帯別（折れ線＋棒グラフ）
function renderHourChart(hourData) {
  const ctx = document.getElementById("hourChart").getContext("2d");
  
  // 0時〜23時の配列を作る
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
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
