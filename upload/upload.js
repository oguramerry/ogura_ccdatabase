//upload.js（改善版）
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZbWFbxilYd4n3o_vMoGNdQFMgZd4sFSmfSdJ_oxAtuFSvfx6a1A18JwVrYZp-O5Rh/exec";

const dropzone = document.getElementById("dropzone");
const filePicker = document.getElementById("filePicker");
const previews = document.getElementById("previews");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const sendBtnBottom = document.getElementById("sendBottom");
const clearBtnBottom = document.getElementById("clearBottom");
const msg = document.getElementById("msg");
const progress = document.getElementById("progress");
const scoreInput = document.getElementById("score");

const commonDateEl = document.getElementById("commonDate");
const commonTimeEl = document.getElementById("commonTime");
const commonNoteEl = document.getElementById("commonNote");
const copyCommonBtn = document.getElementById("copyCommon");
const commonStageEl = document.getElementById("commonStage");

const MAX_FILES = 10;
const MAX_SIZE_MB = 8;
const MAX_TOTAL_MB = 30;

const STAGE_ORDER = [
  "パライストラ",
  "ヴォルカニック・ハート",
  "東方絡繰御殿",
  "ベイサイド・バトルグラウンド",
  "クラウドナイン",
  "レッド・サンズ"
];

let submissionId = "";
let items = []; // { id, file, url, status, error?, perDate, perTime, perNote }

function setMsg(t){ msg.textContent = t || ""; }
function setProgress(t){ progress.textContent = t || ""; }
function bytesToMB(b){ return b / 1024 / 1024; }

function makeSubmissionId(){
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  let runningTotal = currentTotal;

  for (const f of files){
    if (!f.type.startsWith("image/")) continue;
    if (items.length >= MAX_FILES) break;

    if (bytesToMB(f.size) > MAX_SIZE_MB) {
      setMsg(`大きすぎる画像があるかも(´;ω;｀)（1枚あたり上限 ${MAX_SIZE_MB}mb）`);
      continue;
    }

    const newTotal = runningTotal + f.size;
    if (bytesToMB(newTotal) > MAX_TOTAL_MB) {
      setMsg(`合計サイズが大きいかも(´;ω;｀)（合計上限 ${MAX_TOTAL_MB}mb）`);
      break;
    }

    runningTotal = newTotal;

    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    const url = URL.createObjectURL(f);
    items.push({ id, file: f, url, status: "ready", perDate: "", perTime: "", perNote: "" , perStage: "" });
    added++;
  }

  if (added === 0 && items.length === 0){
    setMsg("画像を、追加できなかった(´;ω;｀)！形式やサイズを見てみてね");
  } else {
    setMsg("");
  }

  render();

  if (added > 0) {
    //DOMのレンダリング完了を待つ
    setTimeout(() => {
      const rect = previews.getBoundingClientRect();
      // プレビューエリアが画面内に完全に見えていない（下の方にある）場合のみスクロール
      const isVisible = (rect.top >= 0 && rect.bottom <= window.innerHeight);

      if (!isVisible) {
        previews.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }
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

  const uploading = items.some(x => x.status === "uploading");
  const hasItems = items.length > 0;

  copyCommonBtn.disabled = !hasItems || uploading;

  if (!hasItems){
    setProgress("");
    sendBtn.disabled = true;
    clearBtn.disabled = true;
    sendBtnBottom.disabled = true;
    clearBtnBottom.disabled = true;
    return;
  }

  const ready = items.filter(x => x.status === "ready").length;
  const done = items.filter(x => x.status === "done").length;
  const error = items.filter(x => x.status === "error").length;
  
  // ⭐ 改善：状態を明確に表示
  if (uploading) {
    // 送信中は詳細な進捗を表示（uploadAll関数で更新）
    // ここでは何もしない（uploadAll側で制御）
  } else {
    // 待機中は状態サマリーを表示
    let statusText = `選択中: ${items.length}枚`;
    if (done > 0) statusText += ` | ✅ 完了: ${done}枚`;
    if (ready > 0) statusText += ` | ⏳ 送信待ち: ${ready}枚`;
    if (error > 0) statusText += ` | ❌ エラー: ${error}枚`;
    setProgress(statusText);
  }

  for (const it of items){
    const div = document.createElement("div");
    div.className = `thumb ${it.status === "uploading" ? "is-uploading" : ""} ${it.status === "done" ? "is-done" : ""} ${it.status === "error" ? "is-error" : ""}`;

    const img = document.createElement("img");
    img.src = it.url;
    img.alt = it.file.name;

    img.addEventListener("click", () => {
      const modal = document.getElementById("modal");
      const modalImg = document.getElementById("modalImg");
      if(modal && modalImg){
        modalImg.src = it.url; // プレビュー画像をモーダルに渡す
        modal.classList.add("is-open");
      }
    });

    const meta = document.createElement("div");
    meta.className = "meta";
    
    // ⭐ 改善：ステータスアイコンを追加
    let statusIcon = "";
    if (it.status === "uploading") statusIcon = "⏳ ";
    else if (it.status === "done") statusIcon = "✅ ";
    else if (it.status === "error") statusIcon = "❌ ";
    
    meta.textContent = statusIcon + `${it.file.name} (${bytesToMB(it.file.size).toFixed(2)}mb)` + (it.status === "error" ? ` / ${it.error || "error"}` : "");

    const btn = document.createElement("button");
    btn.className = "remove";
    btn.type = "button";
    btn.textContent = "×";
    btn.disabled = it.status === "uploading";
    btn.addEventListener("click", () => removeItem(it.id));

    const extra = document.createElement("div");
    extra.className = "extra";

    const dWrap = document.createElement("div");
    dWrap.className = "extraItem";
    const dLabel = document.createElement("label");
    dLabel.className = "label";
    dLabel.textContent = "試合日（任意）";
    const dInput = document.createElement("input");
    dInput.type = "date";
    dInput.value = it.perDate || "";
    dInput.disabled = it.status === "uploading";
    dInput.addEventListener("input", () => { it.perDate = dInput.value || ""; });
    dWrap.appendChild(dLabel);
    dWrap.appendChild(dInput);

    const tWrap = document.createElement("div");
    tWrap.className = "extraItem";
    const tLabel = document.createElement("label");
    tLabel.className = "label";
    tLabel.textContent = "時刻（任意）";
    const tInput = document.createElement("input");
    tInput.type = "time";
    tInput.value = it.perTime || "";
    tInput.disabled = it.status === "uploading";
    tInput.addEventListener("input", () => { it.perTime = tInput.value || ""; });
    tWrap.appendChild(tLabel);
    tWrap.appendChild(tInput);

    const sWrap = document.createElement("div");
    sWrap.className = "extraItem extraStage";
    const sLabel = document.createElement("label");
    sLabel.className = "label";
    sLabel.textContent = "ステージ名（任意）";
    
    const sInput = document.createElement("select");
    sInput.disabled = it.status === "uploading";
    
    // デフォルト（未選択）
    const defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = "任意";
    sInput.appendChild(defOpt);

    // リストから選択肢生成
    for(const st of STAGE_ORDER){
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      sInput.appendChild(opt);
    }

    // 値をセット
    sInput.value = it.perStage || "";

    // イベントリスナー
    sInput.addEventListener("change", () => { it.perStage = sInput.value || ""; });

    
    sWrap.appendChild(sLabel);
    sWrap.appendChild(sInput);

    
    const nWrap = document.createElement("div");
    nWrap.className = "extraItem extraNote";
    const nLabel = document.createElement("label");
    nLabel.className = "label";
    nLabel.textContent = "メモ（任意）";
    const nInput = document.createElement("input");
    nInput.type = "text";
    nInput.maxLength = 200;
    nInput.placeholder = "任意";
    nInput.value = it.perNote || "";
    nInput.disabled = it.status === "uploading";
    nInput.addEventListener("input", () => { it.perNote = nInput.value || ""; });
    nWrap.appendChild(nLabel);
    nWrap.appendChild(nInput);

    extra.appendChild(dWrap);
    extra.appendChild(tWrap);
    extra.appendChild(sWrap);
    extra.appendChild(nWrap);

    div.appendChild(btn);
    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(extra);
    previews.appendChild(div);
  }

  sendBtn.disabled = uploading || items.every(x => x.status !== "ready");
  clearBtn.disabled = uploading || items.length === 0;

  sendBtnBottom.disabled = sendBtn.disabled;
  clearBtnBottom.disabled = clearBtn.disabled;
}

function copyCommonToAll(){
  const cd = commonDateEl.value || "";
  const ct = commonTimeEl.value || "";
  const cn = commonNoteEl.value || "";
  const cs = commonStageEl.value || "";

  for (const it of items){
    it.perDate = cd;
    it.perTime = ct;
    it.perNote = cn;
    it.perStage = cs;
  }
  setMsg("すべての画像にコピーしたﾆｮ");
  render();
}



async function uploadOne(it, index, score){
  it.status = "uploading";
  it.error = "";
  render();

  const dataUrl = await fileToBase64(it.file);

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      submissionId,
      index,

      filename: it.file.name,
      mimeType: it.file.type,
      dataUrl,
      score,

      commonDate: commonDateEl.value || "",
      commonTime: commonTimeEl.value || "",
      commonNote: commonNoteEl.value || "",
      // ★追加：共通ステージ情報
      commonStage: commonStageEl ? commonStageEl.value : "",

      perFileDate: it.perDate || "",
      perFileTime: it.perTime || "",
      perFileNote: it.perNote || "",
      // ★追加：個別ステージ情報
      perFileStage: it.perStage || ""
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

  submissionId = makeSubmissionId();

  setMsg("送信中…");
  sendBtn.disabled = true;
  clearBtn.disabled = true;
  copyCommonBtn.disabled = true;
  sendBtnBottom.disabled = true;
  clearBtnBottom.disabled = true;

  const score = scoreInput ? scoreInput.value : "";

  let okCount = 0;
  
  for (let i = 0; i < queue.length; i++){
    const it = queue[i];
    
    // 送信中の状態表示
    const currentNum = i + 1;
    const totalNum = queue.length;
    const doneCount = okCount;
    const currentFileName = it.file.name;
    
    // 現在処理中のファイル名も表示
    setProgress(`📤 送信中: ${currentNum}/${totalNum}枚 | ✅ 完了: ${doneCount}枚 | 処理中: ${currentFileName}`);

    try {
      await uploadOne(it, items.indexOf(it), score);
      it.status = "done";
      okCount++;
      
      // 送信完了直後に進捗を更新
      setProgress(`📤 送信中: ${currentNum}/${totalNum}枚 | ✅ 完了: ${okCount}枚`);
    } catch (e){
      it.status = "error";
      it.error = String(e);
    }
    render();
  }

  const errCount = queue.length - okCount;

  if (errCount === 0){
    setProgress(`🎉 全${okCount}枚の送信が完了しました！`);
    setMsg("送信完了！ﾊﾆｧﾄｫ(´;ω;｀)");
    
    // ⭐ 完了メッセージを2秒間表示してからリダイレクト
    setTimeout(() => {
      window.location.href = "./thanks.html";
    }, 2000);
  } else {
    setProgress(`完了: ${okCount}枚 | エラー: ${errCount}枚`);
    setMsg(`完了 ${okCount}枚 / 失敗 ${errCount}枚。そのままもう一回送信ボタンｩｫ押してね`);
  }

  sendBtn.disabled = items.every(x => x.status !== "ready");
  clearBtn.disabled = false;
  copyCommonBtn.disabled = items.length === 0 || items.some(x => x.status === "uploading");
  sendBtnBottom.disabled = sendBtn.disabled;
  clearBtnBottom.disabled = clearBtn.disabled;
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
copyCommonBtn.addEventListener("click", copyCommonToAll);
sendBtnBottom.addEventListener("click", uploadAll);
clearBtnBottom.addEventListener("click", clearAll);

function initCommonStage(){
  // 一旦空にする
  commonStageEl.innerHTML = "";
  
  // デフォルト（未選択）を追加
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "ステージを選択（任意）";
  commonStageEl.appendChild(defaultOpt);

  // リストから選択肢を追加
  for(const st of STAGE_ORDER){
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    commonStageEl.appendChild(opt);
  }
}
initCommonStage();

render();

// ★画像の拡大表示ロジック
const guideImg = document.querySelector(".guide-img");
const modal = document.getElementById("modal");
const modalImg = document.getElementById("modalImg");

if (guideImg && modal && modalImg) {
  // 画像クリックでモーダルを開く
  guideImg.addEventListener("click", () => {
    modalImg.src = guideImg.src; // 元画像のURLをコピー
    modal.classList.add("is-open");
  });

  // モーダルクリックで閉じる
  modal.addEventListener("click", () => {
    modal.classList.remove("is-open");
  });
}
