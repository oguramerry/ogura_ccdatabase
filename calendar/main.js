// main.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbw9q7AMUUGrPaJFgkcEHRNNMLHzIj7DZHDBN4NxJqSRPYMk9Vfp7TwKNwOd629So00bgA/exec";

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

    let events = [];
    try {
        const response = await fetch(GAS_URL);
        events = await response.json();
        console.log("取得したデータ:", events); // デバッグ用：うまくいかない時にコンソールで中身が見れるよ
    } catch (error) {
        console.error("データ取得エラー:", error);
        previewContent.innerHTML = '<p class="text-danger">読み込み失敗…リロードしてね</p>';
        return;
    }

    // --- カレンダーの初期化 ---
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: 'auto',
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
            extendedProps: ev 
        })),
        eventClick: (info) => {
            renderPreview(info.event.extendedProps, info.event.title);
        },
    });

    calendar.render();
    renderList(events);

    // --- 詳細プレビューを表示する関数 ---
    function renderPreview(data, displayTitle) {
        // 日時の整形
        const start = data.start ? new Date(data.start).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
        const end = data.end ? new Date(data.end).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";

        // ★画像のURLをGoogleドライブ表示用に変換
        let imgTag = "";
        if (data.imageUrl) {
            let finalUrl = data.imageUrl;
            // ドライブのリンク（file/d/.../view）を直接表示可能なURLに書き換えるよ
            if (finalUrl.includes("drive.google.com")) {
                const fileId = finalUrl.split("/d/")[1]?.split("/")[0] || finalUrl.split("id=")[1];
                if (fileId) finalUrl = `https://drive.google.com/uc?id=${fileId}`;
            }
            imgTag = `<img src="${finalUrl}" class="preview-img">`;
        }

        previewContent.innerHTML = `
            <div class="animate__animated animate__fadeIn">
                ${imgTag}
                <h4 class="mochi-text" style="color: #f06292;">${displayTitle}</h4>
                <p class="dot-text mb-3" style="font-size: 0.8rem; color: #90caf9;">${start} 〜 ${end}</p>
                
                <div class="p-3 rounded-4" style="background: rgba(144, 202, 249, 0.05); font-size: 0.9rem; text-align: left;">
                    ${data.memo ? `<p class="mb-2"><strong>📝 Memo:</strong><br>${data.memo}</p>` : ''}
                    ${data.quest_name ? `<p class="mb-1"><strong>受注:</strong> ${data.quest_name}</p>` : ''}
                    ${data.location ? `<p class="mb-1"><strong>場所:</strong> ${data.location}</p>` : ''}
                </div>
                
                ${data.url ? `<a href="${data.url}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill mochi-text w-100 mt-3">公式サイト</a>` : ''}
                ${data.reward_links ? `<a href="${data.reward_links}" target="_blank" class="btn btn-sm btn-outline-danger rounded-pill mochi-text w-100 mt-2">報酬DB</a>` : ''}
            </div>
        `;
    }

    // --- 下部のリストを表示する関数 ---
    function renderList(eventData) {
        eventListEl.innerHTML = "";
        const sorted = [...eventData].sort((a, b) => new Date(a.start) - new Date(b.start));

        sorted.forEach(ev => {
            const card = document.createElement('div');
            card.className = "col-md-6 col-lg-4";
            card.innerHTML = `
                <div class="event-card">
                    <h6 class="mochi-text mb-1">${CATEGORY_ICONS[ev.category] || "✨"} ${ev.title}</h6>
                    <p class="dot-text mb-0" style="font-size: 0.7rem;">${new Date(ev.start).toLocaleDateString()}</p>
                </div>
            `;
            card.onclick = () => {
                renderPreview(ev, (CATEGORY_ICONS[ev.category] || "✨") + " " + ev.title);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            eventListEl.appendChild(card);
        });
    }
});
