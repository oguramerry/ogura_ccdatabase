//script.js

function safeText(v) {
  return v == null ? "" : String(v);
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeLower(v) {
  return safeText(v).toLowerCase();
}

function safeHttpsUrl(v) {
  try {
    const u = new URL(String(v), location.href);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function buildEmptyMessage(htmlString) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = htmlString;
  return div;
}

function buildCard(stream) {
  const url = safeHttpsUrl(stream?.url);
  if (!url) return null;

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "card";

  const thumbContainer = document.createElement("div");
  thumbContainer.className = "thumb-container";

  const img = document.createElement("img");
  img.className = "thumb";
  img.alt = "thumbnail";

  const thumbUrl = safeHttpsUrl(stream?.thumbnail);
  if (thumbUrl) {
    img.src = thumbUrl;
    img.loading = "lazy";
    img.decoding = "async";
  } else {
    img.removeAttribute("src");
  }

  thumbContainer.appendChild(img);

  const info = document.createElement("div");
  info.className = "info";

  const platformText = safeText(stream?.platform) || "";
  const platform = document.createElement("span");
  platform.className = `platform ${safeLower(platformText)}`;
  platform.textContent = platformText;

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = safeText(stream?.title);

  const streamer = document.createElement("div");
  streamer.className = "streamer";
  streamer.textContent = safeText(stream?.streamer);

  const viewers = document.createElement("div");
  viewers.className = "viewers";
  const viewersNum = safeNumber(stream?.viewers);
  viewers.textContent = `✧ ${viewersNum.toLocaleString()} 人が見てるよ`;

  info.appendChild(platform);
  info.appendChild(title);
  info.appendChild(streamer);
  info.appendChild(viewers);

  a.appendChild(thumbContainer);
  a.appendChild(info);

  return a;
}

async function loadStreams() {
  const grid = document.getElementById("stream-grid");
  if (!grid) return;

  try {
    const timestamp = Date.now();
    const response = await fetch(`./stream_data.json?t=${timestamp}`, { cache: "no-cache" });

    if (!response.ok) throw new Error("File not found");

    const data = await response.json();

    grid.textContent = "";

    if (!Array.isArray(data) || data.length === 0) {
      grid.appendChild(
        buildEmptyMessage("今は誰も配信してないじゃ、ないでしょうか(´;ω;｀)...<br>ほにゃ、引退(´;ω;｀)")
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const s of data) {
      const card = buildCard(s);
      if (card) fragment.appendChild(card);
    }

    if (!fragment.childNodes.length) {
      grid.appendChild(
        buildEmptyMessage("今は誰も配信してないじゃ、ないでしょうか(´;ω;｀)...<br>ほにゃ、引退(´;ω;｀)")
      );
      return;
    }

    grid.appendChild(fragment);
  } catch (e) {
    console.error(e);
    grid.textContent = "";
    grid.appendChild(
      buildEmptyMessage("データの読み込みに失敗(´;ω;｀)...<br>リロードして、みてね(´;ω;｀)")
    );
  }
}

loadStreams();
setInterval(loadStreams, 60000);
