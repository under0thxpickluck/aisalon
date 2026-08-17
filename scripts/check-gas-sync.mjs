// 稼働中GASが gas/Code.gs とどれだけ一致しているかを推定する使い捨てスクリプト。
// 読み取り専用（どのアクションもシートに書き込まない組み合わせを使う）。
//
//   node scripts/check-gas-sync.mjs

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const GAS_URL = env.GAS_WEBAPP_URL;
const GAS_KEY = env.GAS_API_KEY;

async function call(action, body = {}) {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_KEY)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { __raw: t.slice(0, 200) };
  }
}

const isBadAction = (r) => r?.ok === false && r?.error === "bad_action";

// 1) 直近コミット 6d52c6b で Code.gs から削除された診断アクション。
//    本番に残っていれば「本番はリポジトリより古い」。
const REMOVED = ["which_sheet", "diag_importrange", "diag_dump", "diag_mbtracks"];

// 2) リポジトリの Code.gs に存在するアクション。
//    本番で bad_action なら「本番はリポジトリより古い」。
const PRESENT = [
  "image_history",
  "music_history_list",
  "monitor_rumble_spectator",
  "cat_faq_list",
];

// 3) 今回追加したいアクション。
const NEW = ["sticker_get", "sticker_save", "sticker_credits"];

console.log("=== 1) リポジトリで削除済みのアクション（本番に残っていないのが正しい） ===");
let staleLive = [];
for (const a of REMOVED) {
  const res = await call(a);
  const gone = isBadAction(res);
  console.log(`${gone ? "OK  削除済み" : "!!  まだ生きている"}  ${a}`);
  if (!gone) staleLive.push(a);
}

console.log("\n=== 2) リポジトリに存在するアクション（本番でも動くのが正しい） ===");
let missingLive = [];
for (const a of PRESENT) {
  const res = await call(a);
  const missing = isBadAction(res);
  console.log(`${missing ? "!!  本番に無い" : "OK  存在する"}  ${a}`);
  if (missing) missingLive.push(a);
}

console.log("\n=== 3) 今回追加する sticker アクション ===");
let missingNew = [];
for (const a of NEW) {
  const res = await call(a);
  const missing = isBadAction(res);
  console.log(`${missing ? "--  未反映"    : "OK  反映済み"}  ${a}`);
  if (missing) missingNew.push(a);
}

console.log("\n================ 判定 ================");
if (missingLive.length) {
  console.log("❌ 本番にしか無い/リポジトリにしか無い差分があります。");
  console.log("   リポジトリに存在するのに本番で動かないアクション:", missingLive.join(", "));
  console.log("   → Code.gs の全文貼り付けは危険です。差分を調べてください。");
} else if (staleLive.length) {
  console.log("⚠️ 本番はリポジトリより古いようです（削除済みのはずの診断アクションが残存）:", staleLive.join(", "));
  console.log("   → Code.gs の全文貼り付けで本番をリポジトリの状態に揃えられます。");
  console.log("   ただし、本番でGASエディタから直接直した変更があれば失われます。");
  console.log("   貼る前に GAS の「変更履歴」で直接編集の有無を必ず確認してください。");
} else {
  console.log("✅ 本番とリポジトリの Code.gs は一致していそうです。");
  console.log("   → Code.gs の全文貼り付けは安全に行えます。");
}
console.log(
  missingNew.length
    ? `\nsticker アクションは未反映（${missingNew.join(", ")}）。貼り付けと再デプロイが必要です。`
    : "\nsticker アクションは反映済みです。"
);
