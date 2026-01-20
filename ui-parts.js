// ui-parts.js
// 定数やフォーマット関数などの「道具箱」

// ジョブ名定数（グローバル定数として定義）
const JOB_NAME_JP = {
  "PLD": "ナイト", "WAR": "戦士", "DRK": "暗黒騎士", "GNB": "ガンブレイカー",
  "WHM": "白魔道士", "SCH": "学者", "AST": "占星術師", "SGE": "賢者",
  "MNK": "モンク", "DRG": "竜騎士", "NIN": "忍者", "SAM": "侍",
  "RPR": "リーパー", "VPR":"ヴァイパー",
  "BRD": "吟遊詩人", "MCH": "機工士", "DNC": "踊り子",
  "BLM": "黒魔道士", "SMN": "召喚士", "RDM": "赤魔道士", "PCT": "ピクトマンサー",
};

// 名前変換 (OguraChan -> Ogura Chan)
function formatCharacterName(name) {
  if (!name) return name;
  if (name.includes(" ")) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// 時間帯整形 (5 -> 05:00～05:59)
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatHourRange(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return String(hour ?? "");
  const start = `${pad2(h)}:00`;
  const end = `${pad2(h)}:59`;
  return `${start}～${end}`;
}

// ui-parts.js の一番下に追加

// ロール定義
const JOB_ROLES = {
  "TANK":   ["PLD","WAR","DRK","GNB"],
  "HEALER": ["WHM","SCH","AST","SGE"],
  "MELEE":  ["MNK","DRG","NIN","SAM","RPR","VPR"],
  "RANGE":  ["BRD","MCH","DNC"],
  "CASTER": ["BLM","SMN","RDM","PCT"]
};

// 日本語のロール名
const ROLE_NAME_JP = {
  "TANK": "タンク",
  "HEALER": "ヒーラー",
  "MELEE": "メレー",
  "RANGE": "レンジ",
  "CASTER": "キャスター"
};
