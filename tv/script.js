//script.js

async function loadStreams() {
    const grid = document.getElementById('stream-grid');
    try {
        // キャッシュ対策：タイムスタンプを付与
        const timestamp = new Date().getTime();
        const response = await fetch(`./stream_data.json?t=${timestamp}`, { cache: 'no-cache' });
        
        if (!response.ok) throw new Error('File not found');
        
        const data = await response.json();

        if (data.length === 0) {
            grid.innerHTML = '<div class="empty">今は誰も配信してないじゃ、ないでしょうか(´;ω;｀)...<br>ほにゃ、引退(´;ω;｀)</div>';
            return;
        }

        grid.innerHTML = data.map(s => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="card">
                <div class="thumb-container">
                    <img src="${s.thumbnail}" class="thumb" alt="thumbnail">
                </div>
                <div class="info">
                    <span class="platform ${s.platform.toLowerCase()}">${s.platform}</span>
                    <div class="title">${s.title}</div>
                    <div class="streamer">${s.streamer}</div>
                    <div class="viewers">✧ ${s.viewers.toLocaleString()} 人が見てるよ</div>
                </div>
            </a>
        `).join('');
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div class="empty">データの読み込みに失敗(´;ω;｀)...<br>リロードして、みてね(´;ω;｀)</div>';
    }
}

// 初回読み込み
loadStreams();

// 1分ごとに更新
setInterval(loadStreams, 60000);
