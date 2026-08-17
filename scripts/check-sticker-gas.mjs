// GAS 側に sticker_* アクションが正しく反映されたかを確認する使い捨てスクリプト。
//   node scripts/check-sticker-gas.mjs
//
// 書き込みは user_id = __sticker_selftest__ のテスト行1件だけ。
// 確認後に sticker_projects シートからその行を削除してよい。

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
const TEST_USER = "__sticker_selftest__";
const TEST_PROJECT = "selftest-project";

async function call(action, body) {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_KEY)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await r.text();
  try {
    return { status: r.status, json: JSON.parse(text) };
  } catch {
    return { status: r.status, raw: text.slice(0, 300) };
  }
}

function show(label, res) {
  console.log(`\n--- ${label} ---`);
  console.log(`HTTP ${res.status}`);
  console.log(res.json ? JSON.stringify(res.json) : `(非JSON) ${res.raw}`);
}

// 未登録アクションが何を返すかの基準値。これと同じ応答なら「貼り付け漏れ」。
const baseline = await call("__no_such_action__", {});
show("基準: 存在しないアクション", baseline);
const baselineStr = JSON.stringify(baseline.json ?? baseline.raw);

const results = {};

// 1) sticker_get — 読み取りのみ。シートが無ければここで自動生成される。
const get1 = await call("sticker_get", { id: TEST_USER });
show("1) sticker_get（空）", get1);
results.get = get1.json?.ok === true && Array.isArray(get1.json?.projects);

// 2) sticker_credits — 残高不足のパス。書き込みは発生しない。
const credNeg = await call("sticker_credits", {
  id: TEST_USER,
  project_id: "does-not-exist",
  delta: -1,
});
show("2) sticker_credits（残高なしで減算）", credNeg);
results.creditsGuard = credNeg.json?.ok === false && credNeg.json?.error === "no_credits";

// テスト行が前回実行から残っている場合に備え、開始時点の残高を基準にする。
// 絶対値で判定すると、行が残っているだけで誤ってNGになる。
const before = await call("sticker_get", { id: TEST_USER, project_id: TEST_PROJECT });
const start = Number(before.json?.project?.credits ?? 0);
console.log(`\n（テスト行の開始残高: ${start}。以降は差分で判定する）`);

// 3) sticker_credits — 付与（行が無ければここで作られる）
const credAdd = await call("sticker_credits", {
  id: TEST_USER,
  project_id: TEST_PROJECT,
  delta: 40,
});
show(`3) sticker_credits（+40 付与 → ${start + 40} を期待）`, credAdd);
results.creditsGrant = credAdd.json?.ok === true && credAdd.json?.credits === start + 40;

// 4) sticker_save — credits を書き換えないことを確認する
const save = await call("sticker_save", {
  id: TEST_USER,
  project_id: TEST_PROJECT,
  name: "セルフテスト",
  status: "rendering",
  project_json: JSON.stringify({ version: 1, hello: "world" }),
});
show(`4) sticker_save（保存 → ${start + 40} のまま を期待）`, save);
results.save = save.json?.ok === true;
results.saveKeepsCredits = save.json?.credits === start + 40;

// 5) sticker_credits — 消費
const credUse = await call("sticker_credits", {
  id: TEST_USER,
  project_id: TEST_PROJECT,
  delta: -1,
});
show(`5) sticker_credits（-1 消費 → ${start + 39} を期待）`, credUse);
results.creditsConsume = credUse.json?.ok === true && credUse.json?.credits === start + 39;

// 6) sticker_get — 保存内容が読み戻せるか
const get2 = await call("sticker_get", { id: TEST_USER, project_id: TEST_PROJECT });
show("6) sticker_get（読み戻し）", get2);
results.roundTrip =
  get2.json?.ok === true &&
  get2.json?.project?.credits === start + 39 &&
  JSON.parse(get2.json?.project?.project_json || "{}").hello === "world";

// 後始末: このスクリプトが増やした分を戻し、何度実行しても残高が膨らまないようにする
const restore = await call("sticker_credits", {
  id: TEST_USER,
  project_id: TEST_PROJECT,
  delta: -39,
});
console.log(`\n（後始末: 残高を ${restore.json?.credits ?? "?"} に戻した）`);

// 判定
console.log("\n================ 判定 ================");
const checks = [
  ["sticker_get が動く", results.get],
  ["sticker_credits の残高ガードが効く", results.creditsGuard],
  ["sticker_credits の付与が動く", results.creditsGrant],
  ["sticker_save が動く", results.save],
  ["sticker_save が credits を壊さない", results.saveKeepsCredits],
  ["sticker_credits の消費が動く", results.creditsConsume],
  ["保存 → 読み戻しが一致する", results.roundTrip],
];
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK  " : "NG  "} ${label}`);
}

const allOk = checks.every(([, ok]) => ok);
console.log(
  `\n${allOk ? "✅ すべて通過。GASの反映は完了しています。" : "❌ 未反映または不整合があります。上の応答内容を確認してください。"}`
);
if (!allOk && JSON.stringify(get1.json ?? get1.raw) === baselineStr) {
  console.log("→ 応答が「存在しないアクション」と同じです。貼り付けか doPost の振り分け追加が漏れています。");
}
console.log(`\n後片付け: sticker_projects シートの user_id = ${TEST_USER} の行を削除してください。`);
