// forecast.js
// Ver 2.1: ChatGPTさんの指摘（例外ガード、Stage大文字対応、日付正規化、激プピクラス）を反映

window.WeatherForecast = {
  // ステージ設定（略称とCSSクラス）
  STAGE_INFO: {
    "Palaistra": { jp: "パライストラ", abbr: "パラ", class: "Palaistra" },
    "Volcanic Heart": { jp: "ヴォルカニック・ハート", abbr: "VH", class: "VolcanicHeart" },
    "Clockwork Castletown": { jp: "東方絡繰御殿", abbr: "からくり", class: "ClockworkCastletown" },
    "Bayside Battleground": { jp: "ベイサイド・バトルグラウンド", abbr: "BB", class: "BaysideBattleground" },
    "Cloud Nine": { jp: "クラウドナイン", abbr: "C9", class: "CloudNine" },
    "Red Sands": { jp: "レッド・サンズ", abbr: "サンズ", class: "RedSands" }
  },

  // 描画メイン
  render: function(statsData) {
    const wrapper = document.getElementById("forecastWrapper");
    if (!wrapper || !statsData) return;

    const SLOTS = ["21:00", "22:30", "00:00", "01:30"];
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    
    // 5時切り替えルール（実行時の時刻判定）
    const now = new Date();
    if (now.getHours() < 5) now.setDate(now.getDate() - 1);

    let html = `<table class="forecast-table"><thead><tr><th></th>`;
    const targetDates = [];

    // ヘッダー生成（向こう7日間）
    // ★修正：時刻を00:00に正規化して日付オブジェクトを作成
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      targetDates.push(d);
      html += `<th class="forecast-th">${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})</th>`;
    }
    html += `</tr></thead><tbody>`;

    // 行（時間スロット）の生成
    SLOTS.forEach(slot => {
      html += `<tr><td class="forecast-time-label">${slot}</td>`;
      
      targetDates.forEach(date => {
        // スロット開始日時のタイムスタンプ計算
        const [h, m] = slot.split(":").map(Number);
        
        // dateは00:00になっているので、h, m をセットする
        const targetDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
        
        // 00:00以降の枠は、カレンダー上の日付としては「翌日」
        if (h < 5) {
          targetDateTime.setDate(targetDateTime.getDate() + 1);
        }

        // 未来のステージを計算
        const stageKey = this.getStageAtTime(targetDateTime.getTime());
        const info = this.STAGE_INFO[stageKey] || { jp: stageKey, abbr: stageKey, class: "unknown" };

        // バックオフ計算
        const res = this.calculateBackoff(statsData, date.getDay(), slot, stageKey);

        // 表示コンテンツの決定
        let innerHTML = "";
        if (res.total === 0) {
          innerHTML = `<span class="status-text status-debut">デビュー</span>`;
        } else if (res.p > 0.5) {
          // アイコンの場合
          const icons = res.topJobs.map(job => 
            `<img src="../images/JOB/${job}.png" class="forecast-job-icon" title="${job} (勝率${(res.jobRates[job]*100).toFixed(1)}%)">`
          ).join("");
          innerHTML = `${icons}`; 
        } else if (res.p > 0.45) {
          innerHTML = `<span class="status-text status-pupi">プピ</span>`;
        } else if (res.p > 0.40) {
          // ★修正：激プピ用のクラスを設定（status-gekipupi）
          innerHTML = `<span class="status-text status-gekipupi">激プピ</span>`;
        } else {
          innerHTML = `<span class="status-text status-retirement">引退</span>`;
        }

        // メタ情報
        const meta = `l${res.level} n=${res.total}`;

        html += `
          <td class="forecast-cell st-bar-${info.class}">
            <span class="st-abbr">${info.abbr}</span>
            <div class="forecast-content">${innerHTML}</div>
            <span class="forecast-meta">${meta}</span>
          </td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    wrapper.innerHTML = html;
  },

  // 90分サイクルに基づくステージ算出
  getStageAtTime: function(timeMs) {
    let diff = timeMs - CC_CONFIG.ANCHOR_EPOCH;
    const totalDuration = CC_CONFIG.CYCLE_MS * CC_CONFIG.ROTATION.length;
    while (diff < 0) diff += totalDuration;
    const totalSlots = Math.floor(diff / CC_CONFIG.CYCLE_MS);
    return CC_CONFIG.ROTATION[totalSlots % CC_CONFIG.ROTATION.length];
  },

  // バックオフ勝率計算エンジン
  calculateBackoff: function(statsData, wIdx, t, sKey) {
    const matches = statsData.matches || [];
    const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const targetW = WD[wIdx]; 
    
    // ステージ名の揺らぎ吸収
    const targetS_EN = sKey;
    const targetS_JP = this.STAGE_INFO[sKey] ? this.STAGE_INFO[sKey].jp : sKey;

    // ヘルパー：時間枠の判定
    const getSlot = (timeStr) => {
      if (!timeStr) return "";
      const [h, m] = timeStr.split(":").map(Number);
      const val = h * 60 + m; 

      if (val >= 21 * 60 && val < 22 * 60 + 30) return "21:00";
      if (val >= 22 * 60 + 30 && val < 24 * 60) return "22:30"; 
      if (val >= 0 && val < 1 * 60 + 30) return "00:00";
      if (val >= 1 * 60 + 30 && val < 3 * 60) return "01:30";
      return "";
    };

    // ヘルパー：試合データの曜日判定
    const getMatchWDay = (m) => {
      // ★修正：データ不備ガード（日付や時間が欠けていたら処理しない）
      if (!m.date || !m.time) return "";

      const parts = m.date.split("-");
      const y = parseInt(parts[0], 10);
      const mon = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      const d = new Date(y, mon, day);
      
      const h = parseInt(m.time.split(":")[0], 10);
      if (h < 5) d.setDate(d.getDate() - 1);
      
      return WD[d.getDay()];
    };

    // ヘルパー：ステージ一致判定
    const isStageMatch = (m) => {
      // ★修正：m.Stage（大文字）も考慮して取得
      const st = m.stage || m.Stage;
      if (!st) return false;
      return st === targetS_EN || st === targetS_JP;
    };

    // 検索レベル定義
    const levels = [
      { lv: 0, f: m => getMatchWDay(m) === targetW && getSlot(m.time) === t && isStageMatch(m) },
      { lv: 1, f: m => getSlot(m.time) === t && isStageMatch(m) },
      { lv: 2, f: m => getMatchWDay(m) === targetW && isStageMatch(m) },
      { lv: 3, f: m => isStageMatch(m) },
      { lv: 4, f: m => getSlot(m.time) === t },
      { lv: 5, f: m => getMatchWDay(m) === targetW },
      { lv: 6, f: m => true }
    ];

    // バックオフ実行
    for (let layer of levels) {
      const filtered = matches.filter(layer.f);
      
      if (filtered.length > 0) {
        const wins = filtered.filter(m => /win|勝利/i.test(m.result) || Number(m.result) > 0).length;
        const total = filtered.length;
        
        const jobMap = {};
        filtered.forEach(m => {
          const j = m.job || m.Job; 
          if (!j) return;
          if (!jobMap[j]) jobMap[j] = { w: 0, t: 0 };
          jobMap[j].t++;
          if (/win|勝利/i.test(m.result) || Number(m.result) > 0) jobMap[j].w++;
        });

        const jobRates = {};
        const jobScores = Object.keys(jobMap).map(j => {
          const p = jobMap[j].w / jobMap[j].t;
          jobRates[j] = p;
          return { job: j, p, score: 2 * p - 1, n: jobMap[j].t };
        });

        const topJobs = jobScores
          .filter(j => j.p > 0.5)
          .sort((a, b) => b.score - a.score || b.p - a.p || b.n - a.n)
          .slice(0, 3)
          .map(j => j.job);

        return { p: wins / total, total, level: layer.lv, topJobs, jobRates };
      }
    }
    
    return { p: 0, total: 0, level: 6, topJobs: [], jobRates: {} };
  }
};
