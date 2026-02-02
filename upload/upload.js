
<input id="img" type="file" accept="image/*" />
<input id="score" type="text" placeholder="戦績（例: 10-2） 任意" />
<button id="send">送信</button>
<div id="msg"></div>

<script>
const SCRIPT_URL = "https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result); // data:image/...;base64,....
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

document.getElementById("send").addEventListener("click", async () => {
  const file = document.getElementById("img").files[0];
  const score = document.getElementById("score").value || "";

  if (!file) {
    document.getElementById("msg").textContent = "画像を選んでね";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    document.getElementById("msg").textContent = "サイズが大きいかも（上限5mbの例）";
    return;
  }

  document.getElementById("msg").textContent = "送信中…";

  const dataUrl = await fileToBase64(file);

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      dataUrl,
      score
    })
  });

  const json = await res.json();
  if (json.ok) {
    document.getElementById("msg").textContent = "送信できたよ。ありがとう";
  } else {
    document.getElementById("msg").textContent = "失敗しちゃった：" + (json.error || "unknown");
  }
});
</script>
