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
    } catch (error) {
        console.error("Fetch error:", error);
        return;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: '100%',
        aspectRatio: 1.8, // ここで横長具合を調整できるよ
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
        eventClick: (info) => {
            renderPreview(info.event.extendedProps, info.event.title);
        },
    });

    calendar.render();
    renderList(events);

    function renderPreview(data, displayTitle) {
        const start = data.start ? new Date(data.start).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
        const end = data.end ? new Date(data.end).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";

        let imgTag = "";
        if (data.imageUrl) {
            let finalUrl = data.imageUrl;
            // GoogleドライブのURLからIDを抜き出す処理を強化したよ
            const driveMatch = finalUrl.match(/\/(?:d|open\?id|file\/d)\/([a-zA-Z0-9_-]+)/) || finalUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (driveMatch) {
                const fileId = driveMatch[1];
                finalUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
            }
            imgTag = `<img src="${finalUrl}" class="preview-img" alt="event image">`;
        }

        previewContent.innerHTML = `
            <div>
                ${imgTag}
                <p class="mochi-text" style="color: #f06292; font-size: 1.5rem; margin-bottom: 10px;">${displayTitle}</p>
                <p class="dot-text mb-3" style="font-size: 0.9rem; color: #90caf9;">${start} 〜 ${end}</p>
                
                <div class="p-3 rounded-4" style="background: rgba(144, 202, 249, 0.05); font-size: 0.9rem; text-align: left; line-height: 1.6;">
                    ${data.memo ? `<p class="mb-2"><strong>Memo:</strong><br>${data.memo.replace(/\n/g, '<br>')}</p>` : ''}
                    ${data.quest_name ? `<p class="mb-1"><strong>受注:</strong> ${data.quest_name}</p>` : ''}
                    ${data.location ? `<p class="mb-1"><strong>場所:</strong> ${data.location}</p>` : ''}
                </div>
                
                <div class="mt-3">
                    ${data.url ? `<a href="${data.url}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill mochi-text w-100 mb-2">公式サイト</a>` : ''}
                    ${data.reward_links ? `<a href="${data.reward_links}" target="_blank" class="btn btn-sm btn-outline-danger rounded-pill mochi-text w-100">報酬DB</a>` : ''}
                </div>
            </div>
        `;
    }

    function renderList(eventData) {
        eventListEl.innerHTML = "";
        const sorted = [...eventData].sort((a, b) => new Date(a.start) - new Date(b.start));

        sorted.forEach(ev => {
            const card = document.createElement('div');
            card.className = "col-md-6 col-lg-4";
            card.innerHTML = `
                <div class="event-card h-100" style="cursor: pointer;">
                    <p class="mochi-text mb-1">${CATEGORY_ICONS[ev.category] || "✨"} ${ev.title}</p>
                    <p class="dot-text mb-0" style="font-size: 0.8rem;">${new Date(ev.start).toLocaleDateString()} 〜</p>
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
