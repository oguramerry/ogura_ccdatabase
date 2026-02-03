const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZbWFbxilYd4n3o_vMoGNdQFMgZd4sFSmfSdJ_oxAtuFSvfx6a1A18JwVrYZp-O5Rh/exec";

const dropzone = document.getElementById("dropzone");
const filePicker = document.getElementById("filePicker");
const previews = document.getElementById("previews");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const msg = document.getElementById("msg");
const progress = document.getElementById("progress");
const scoreInput = document.getElementById("score");

const MAX_FILES = 10;           // 1回で選べる枚数
const MAX_SIZE_MB = 8;          // 1枚あたり（base64化で増えるので様子見推奨）
const MAX_TOTAL_MB = 30;        // 合計（安全側）

let items = []; // { id, file, url, status: 'ready'|'uploading'|'done'|'error', error? }

function setMsg(t){ msg.textContent = t || ""; }
function setProgress(t){ progress.textContent = t || ""; }

function bytesToMB(b){ return b / 1024 / 1024; }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function addFiles(fileList){
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  const currentTotal = items.reduce((s, it) => s + it.file.size, 0);
  let added = 0;

  for (const f of files){
    if (!f.type.startsWith("image/")) continue;

    if (items.length >= MAX_FILES) break;

    if (bytesToMB(f.size) > MAX_SIZE_MB) {
      setMsg(`大きすぎる画像があるかも(´;ω;｀)（1枚あたり上限 ${MAX_SIZE_MB}mb）`);
      continue;
    }

    const newTotal = currentTotal + items.reduce((s, it) => s + it.file.size, 0) + f.size;
    if (bytesToMB(newTotal) > MAX_TOTAL_MB) {
      setMsg(`合計サイズが大きいかも(´;ω;｀)（合計上限 ${MAX_TOTAL_MB}mb）`);
      break;
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    const url = URL.createObjectURL(f);
    items.push({ id, file: f, url, status: "ready" });
    added++;
  }

  if (added === 0 && items.length === 0){
    setMsg("画像を、追加できなかった(´;ω;｀)！形式やサイズを見てみてね");
  } else {
    setMsg("");
  }

  render();
}

function removeItem(id){
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return;
  URL.revokeObjectURL(items[idx].url);
  items.splice(idx, 1);
  render();
}

function clearAll(){
  for (const it of items) URL.revokeObjectURL(it.url);
  items = [];
  setMsg("");
  setProgress("");
  render();
}

function render(){
  previews.innerHTML = "";

  if (items.length === 0){
    setProgress("");
    return;
  }

  const ready = items.filter(x => x.status === "ready").length;
  const done = items.filter(x => x.status === "done").length;
  const uploading = items.some(x => x.status === "uploading");
  setProgress(`選択 ${items.length}枚 / 送信待ち ${ready} / 完了 ${done}`);

  for (const it of items){
    const div = document.createElement("div");
    div.className = `thumb ${it.status === "uploading" ? "is-uploading" : ""} ${it.status === "done" ? "is-done" : ""} ${it.status === "error" ? "is-error" : ""}`;

    const img = document.createElement("img");
    img.src = it.url;
    img.alt = it.file.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${it.file.name} (${bytesToMB(it.file.size).toFixed(2)}mb)` + (it.status === "error" ? ` / ${it.error || "error"}` : "");

    const btn = document.createElement("button");
    btn.className = "remove";
    btn.type = "button";
    btn.textContent = "×";
    btn.disabled = it.status === "uploading";
    btn.addEventListener("click", () => removeItem(it.id));

    div.appendChild(btn);
    div.appendChild(img);
    div.appendChild(meta);
    previews.appendChild(div);
  }

  sendBtn.disabled = uploading || items.every(x => x.status !== "ready");
  clearBtn.disabled = uploading || items.length === 0;
}

async function uploadOne(it, score){
  it.status = "uploading";
  it.error = "";
  render();

  const dataUrl = await fileToBase64(it.file);

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      filename: it.file.name,
      mimeType: it.file.type,
      dataUrl,
      score
    })
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "unknown");
}

async function uploadAll(){
  if (items.length === 0){
    setMsg("画像を追加してくだたいね？！(´;ω;｀)");
    return;
  }

  const queue = items.filter(x => x.status === "ready");
  if (queue.length === 0){
    setMsg("送信できる画像がない、との、こと(´;ω;｀)");
    return;
  }

  setMsg("送信中…");
  sendBtn.disabled = true;
  clearBtn.disabled = true;

  const score = scoreInput.value || "";

  let okCount = 0;
  for (let i = 0; i < queue.length; i++){
    const it = queue[i];
    setProgress(`送信中 ${i+1}/${queue.length}`);

    try {
      await uploadOne(it, score);
      it.status = "done";
      okCount++;
    } catch (e){
      it.status = "error";
      it.error = String(e);
    }
    render();
  }

  const errCount = queue.length - okCount;

  if (errCount === 0){
    setMsg("送信完了！ﾊﾆｧﾄｫ(´;ω;｀)");
    window.location.href = "./thanks.html";
  } else {
    setMsg(`完了 ${okCount}枚 / 失敗 ${errCount}枚。そのままもう一回送信ボタンｩｫ押してね`);
  }

  sendBtn.disabled = items.every(x => x.status !== "ready");
  clearBtn.disabled = false;
}

dropzone.addEventListener("click", () => filePicker.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") filePicker.click();
});

filePicker.addEventListener("change", () => {
  addFiles(filePicker.files);
  filePicker.value = "";
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("is-dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("is-dragover");
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-dragover");
  addFiles(e.dataTransfer.files);
});

sendBtn.addEventListener("click", uploadAll);
clearBtn.addEventListener("click", clearAll);

render();
