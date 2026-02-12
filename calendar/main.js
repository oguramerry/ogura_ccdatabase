// main.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbw9q7AMUUGrPaJFgkcEHRNNMLHzIj7DZHDBN4NxJqSRPYMk9Vfp7TwKNwOd629So00bgA/exec";

// カテゴリごとのアイコン設定
const CATEGORY_ICONS = {
    seasonal: "🎁",
    official_pvp: "⚔️",
    official_event: "📢",
    game_event: "🎮",
    player_event: "🏠",
    goods: "🧸",
    sale: "💰",
    other: "✨"
};

document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    const eventListEl = document.getElementById('event-list');
    const previewContent = document.getElementById('preview-content');

    // --- 1. GASからデータを取ってくる ---
    let events = [];
    try {
        const response = await fetch(GAS_URL);
        events = await response.json();
    } catch (error) {
        console.error("データの取得に失敗しちゃった：", error);
        previewContent.innerHTML = '<p class="text-danger">データの読み込みに失敗しちゃったﾆｮ(´;ω;｀)リロードしてみて、いただけないでしょうか！？</p>';
        return;
    }

    // --- 2. FullCalendarの初期化 ---
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth'
        },
        events: events.map(ev => ({
            id: ev.id,
            title: (CATEGORY_ICONS[ev.category] || "✨") + " " + ev.title,
            start: ev.start,
            end: ev.end,
            extendedProps: ev // 全データを保持
        })),

        // 予定をクリックした時の動き
        eventClick: (info) => {
            renderPreview(info.event.extendedProps);
        },

        // ホバーで簡易詳細（ブラウザ標準のツールチップ）
        eventMouseEnter: (info) => {
            info.el.title = info.event.title;
        }
    });

    calendar.render();

    // --- 3. 下部のイベントリストを表示 ---
    renderList(events);

    // --- 4. 詳細プレビューを表示する関数 ---
    function renderPreview(data) {
        // 日時のフォーマット
        const start = new Date(data.start).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const end = new Date(data.end).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        previewContent.innerHTML = `
            <div class="preview-detail animate__animated animate__fadeIn">
                ${data.imageUrl ? `<img src="${data.imageUrl}" class="img-fluid rounded-4 mb-3 shadow-sm">` : ''}
                <h3 class="mochi-text" style="color: #f06292;">${data.title}</h3>
                <p class="dot-text mb-4" style="font-size: 0.9rem; color: #90caf9;">${start} 〜 ${end}</p>
                
                <div class="detail-info p-3 rounded-4" style="background: rgba(144, 202, 249, 0.05);">
                    ${data.memo ? `<p class="mb-3"><strong>📝 Memo:</strong><br>${data.memo}</p>` : ''}
                    ${data.quest_name ? `
                        <p class="mb-1"><strong>受注:</strong> ${data.quest_name}</p>
                        <p class="mb-1"><strong>条件:</strong> ${data.requirement || 'なし'}</p>
                        <p class="mb-1"><strong>場所:</strong> ${data.location || '不明'}</p>
                    ` : ''}
                </div>
                
                ${data.url ? `<a href="${data.url}" target="_blank" class="btn btn-outline-primary mt-4 w-100 rounded-pill mochi-text">公式サイトを見る</a>` : ''}
                ${data.reward_links ? `<a href="${data.reward_links}" target="_blank" class="btn btn-outline-danger mt-2 w-100 rounded-pill mochi-text">報酬データベース</a>` : ''}
            </div>
        `;
    }

    // --- 5. リストを生成する関数 ---
    function renderList(eventData) {
        eventListEl.innerHTML = "";
        // 直近のものから並べる
        const sorted = [...eventData].sort((a, b) => new Date(a.start) - new Date(b.start));

        sorted.forEach(ev => {
            const card = document.createElement('div');
            card.className = "col-md-6 col-xl-4";
            card.innerHTML = `
                <div class="event-card shadow-sm h-100">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge rounded-pill" style="background-color: #e3f2fd; color: #90caf9;">${CATEGORY_ICONS[ev.category] || "✨"} ${ev.category}</span>
                    </div>
                    <h5 class="mochi-text mb-2">${ev.title}</h5>
                    <p class="dot-text mb-0" style="font-size: 0.8rem;">START: ${new Date(ev.start).toLocaleDateString()}</p>
                </div>
            `;
            // リストのカードをクリックしてもプレビューが出るようにする
            card.addEventListener('click', () => {
                renderPreview(ev);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            eventListEl.appendChild(card);
        });
    }
});
