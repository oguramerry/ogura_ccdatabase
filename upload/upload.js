const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZbWFbxilYd4n3o_vMoGNdQFMgZd4sFSmfSdJ_oxAtuFSvfx6a1A18JwVrYZp-O5Rh/exec";

const imgInput = document.getElementById("img");
const scoreInput = document.getElementById("score");
const sendBtn = document.getElementById("send");
const msg = document.getElementById("msg");
const previewImg = document.getElementById("previewImg");

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result); // data:image/...;base64,...
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function setMsg(text) {
  msg.textContent = text;
}

imgInput.addEventListener("change", async () => {
  const file = imgInput.files?.[0];
  if (!file) {
    previewImg.removeAttribute("src");
    previewImg.style.display = "none";
    return;
  }

  // 画像だけ許可（念のため）
  if (!file.type.startsWith("image/")) {
    setMsg("画像ファイルだけにしてね");
    imgInput.value = "";
    previewImg.removeAttribute("src");
    previewImg.style.display = "none";
    return;
  }

  const dataUrl = await fileToBase64(file);
  previewImg.src = dataUrl;
  previewImg.style.display = "block";
  setMsg("");
});

sendBtn.addEventListener("click", async () => {
  const file = imgInput.files?.[0];
  const score = scoreInput.value || "";

  if (!file) {
    setMsg("画像を選んでね");
    return;
  }
  if (!file.type.startsWith("image/")) {
    setMsg("画像ファイルだけにしてね");
    return;
  }

  // 5mb制限（必要なら増やしてok）
  if (file.size > 5 * 1024 * 1024) {
    setMsg("サイズが大きいかも（上限5mb）");
    return;
  }

  sendBtn.disabled = true;
  setMsg("送信中…");

  try {
    const dataUrl = await fileToBase64(file);

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        dataUrl,
        score
      })
    });

    const json = await res.json();

    if (json.ok) {
      // 完了ページに遷移したいならこっち
      window.location.href = "./thanks.html";
      // 画面内で完了表示だけにしたいなら上を消して下を使う
      // setMsg("送信完了！ﾊﾆｧﾄｫ(´;ω;｀)");
    } else {
      setMsg("失敗しちゃったﾆｮｰ(´;ω;｀)：" + (json.error || "unknown"));
    }
  } catch (e) {
    setMsg("通信でこけちゃったﾆｮｰ(´;ω;｀)：" + String(e));
  } finally {
    sendBtn.disabled = false;
  }
});
