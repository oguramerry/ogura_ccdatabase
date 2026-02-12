// main.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbw9q7AMUUGrPaJFgkcEHRNNMLHzIj7DZHDBN4NxJqSRPYMk9Vfp7TwKNwOd629So00bgA/exec";

const CATEGORY_ICONS = {
    seasonal: "🎁", official_pvp: "⚔️", official_event: "📢",
    game_event: "🎮", player_event: "🏠", goods: "🧸",
    sale: "💰", other: "✨"
};

document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    const eventListEl = document.getElementById('event-list');
    const previewContent = document.getElementById('preview-content');

    let events = [];
    try {
        const response = await fetch(GAS_URL);
        events = await response.json();
        console.log("① 届いたデータ:", events);
    } catch (error) {
        console.error("データ取得エラー:", error);
        return;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: '100%',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: ''
        },
        events: events.map(ev => ({
            id: ev.id,
            title: (CATEGORY_ICONS[ev.category] || "✨") + " " + ev.title,
            start: ev.start,
            end: ev.end,
            extendedProps: ev 
        })),
        eventClick: (info) => renderPreview(info.event.extendedProps, info.event.title),
    });

    calendar.render();
    renderList(events);

    function renderPreview(data, displayTitle) {
        let imgTag = "";
        if (data.imageUrl) {
            let finalUrl = data.imageUrl;
            console.log("② 変換前のURL:", finalUrl);

            const driveMatch = finalUrl.match(/[-\w]{25,}/);
            if (driveMatch && finalUrl.includes("drive.google.com")) {
                finalUrl = `https://drive.google.com/uc?export=view&id=${driveMatch[0]}`;
                console.log("③ 魔法をかけたURL:", finalUrl);
            }
            imgTag = `<img src="${finalUrl}" class="preview-img" onerror="console.log('④ 画像エラー:', this.src);">`;
        }

        const start = data.start ? new Date(data.start).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
        
        previewContent.innerHTML = `
            <div>
                ${imgTag}
                <p class="mochi-text" style="color: #f06292; font-size: 1.5rem; margin-bottom: 10px;">${displayTitle}</p>
                <p class="dot-text mb-3" style="font-size: 0.9rem; color: #90caf9;">${start} 〜</p>
                <div class="p-3 rounded-4" style="background: rgba(144, 202, 249, 0.05); font-size: 0.9rem; text-align: left;">
                    <p><strong>Memo:</strong><br>${data.memo || 'なし'}</p>
                </div>
            </div>
        `;
    }

    function renderList(eventData) {
        eventListEl.innerHTML = "";
        eventData.forEach(ev => {
            const card = document.createElement('div');
            card.className = "col-md-6 col-lg-4";
            card.innerHTML = `<div class="event-card"><p class="mochi-text mb-0">${CATEGORY_ICONS[ev.category] || "✨"} ${ev.title}</p></div>`;
            card.onclick = () => { renderPreview(ev, ev.title); window.scrollTo({ top: 0, behavior: 'smooth' }); };
            eventListEl.appendChild(card);
        });
    }
});
