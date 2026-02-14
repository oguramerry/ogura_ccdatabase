// config.js

// APIのURL
const API_URL = "https://script.google.com/macros/s/AKfycbxpRRpIHKgsB3yTUpzCe8IxXKqBTXSkjnHoGFjvMnq7pBwGp1tTNQwpIoHsEns_aQhG4g/exec";

// 散布図フィルターのグループ定義
const FILTER_GROUPS_DEF = [
  { label: 'TANK',   jobs: ['PLD', 'WAR', 'DRK', 'GNB'] },
  { label: 'HEALER', jobs: ['WHM', 'SCH', 'AST', 'SGE'] },
  { label: 'MELEE',  jobs: ['MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR'] },
  { label: 'RANGE',  jobs: ['BRD', 'MCH', 'DNC'] },
  { label: 'CASTER', jobs: ['BLM', 'SMN', 'RDM', 'PCT'] }
];

// ジョブの設定（略称対応・指定順・ロール別カラー）
const JOB_META = {
  // --- TANK (Pastel Blue) ---
  "PLD": { order: 1,  role: "tank",   jp: "ナイト" },
  "WAR": { order: 2,  role: "tank",   jp: "戦士" },
  "DRK": { order: 3,  role: "tank",   jp: "暗黒騎士" },
  "GNB": { order: 4,  role: "tank",   jp: "ガンブレイカー" },
  // --- HEALER (Pastel Green) ---
  "WHM": { order: 5,  role: "healer", jp: "白魔道士" },
  "SCH": { order: 6,  role: "healer", jp: "学者" },
  "AST": { order: 7,  role: "healer", jp: "占星術師" },
  "SGE": { order: 8,  role: "healer", jp: "賢者" },
  // --- DPS (Pastel Pink) ---
  "MNK": { order: 9,  role: "dps",    jp: "モンク" },
  "DRG": { order: 10, role: "dps",    jp: "竜騎士" },
  "NIN": { order: 11, role: "dps",    jp: "忍者" },
  "SAM": { order: 12, role: "dps",    jp: "侍" },
  "RPR": { order: 13, role: "dps",    jp: "リーパー" },
  "VPR": { order: 14, role: "dps",    jp: "ヴァイパー" },
  "BRD": { order: 15, role: "dps",    jp: "吟遊詩人" },
  "MCH": { order: 16, role: "dps",    jp: "機工士" },
  "DNC": { order: 17, role: "dps",    jp: "踊り子" },
  "BLM": { order: 18, role: "dps",    jp: "黒魔道士" },
  "SMN": { order: 19, role: "dps",    jp: "召喚士" },
  "RDM": { order: 20, role: "dps",    jp: "赤魔道士" },
  "PCT": { order: 21, role: "dps",    jp: "ピクトマンサー" }
};

// ロールごとの色定義
const ROLE_COLORS = {
  tank: "#E3F2FD", healer: "#E8F5E9", dps: "#FCE4EC", unknown: "#F5F5F5"
};

const DC_META = {
  "Elemental": { color: "#A5D6A7", label: "Elemental" }, // パステルグリーン
  "Gaia":      { color: "#FFCC80", label: "Gaia" },      //パステルオレンジ 
  "Mana":      { color: "#90CAF9", label: "Mana" },      // パステルブルー
  "Meteor":    { color: "#CE93D8", label: "Meteor" },    // パステルパープル
};

const RANK_META = {
  "アルテマ":     { label: "アルテマ",     img: "ultima.png",   colors: ["#560002", "#e5022b"] },
  "オメガ":       { label: "オメガ",       img: "omega.png",    colors: ["#6e0072", "#f44ed6"] },
  "クリスタル":   { label: "クリスタル",   img: "crystal.png",  colors: ["#2d1eff", "#64d8e5"] },
  "ダイヤモンド": { label: "ダイヤ",       img: "diamond.png",  colors: ["#c4ce0c", "#4e9bed"] },
  "プラチナ":     { label: "プラチナ",     img: "platinum.png", colors: ["#abbad3", "#5cc3d6"] },
  "ゴールド":     { label: "ゴールド",     img: "gold.png",     colors: ["#968134", "#e5de82"] },
  "シルバー":     { label: "シルバー",     img: "silver.png",   colors: ["#95a6c1", "#cbd5ed"] },
  "ブロンズ":     { label: "ブロンズ",     img: "bronze.png",   colors: ["#72430c", "#b2905e"] }
};
