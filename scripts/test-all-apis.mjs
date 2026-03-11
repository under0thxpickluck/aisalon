// scripts/test-all-apis.mjs
// GASアクション疎通テスト（Node.js ネイティブ fetch 使用）
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local を手動パース
function loadEnv(filepath) {
  const env = {};
  try {
    const text = readFileSync(filepath, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val    = trimmed.slice(eqIdx + 1).trim();
      // クォート除去
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch (e) {
    console.error("⚠️  .env.local の読み込みに失敗:", e.message);
  }
  return env;
}

const env = loadEnv(resolve(__dirname, "../.env.local"));
const GAS_URL       = env.GAS_WEBAPP_URL;
const GAS_KEY       = env.GAS_API_KEY;
const GAS_ADMIN_KEY = env.GAS_ADMIN_KEY;

if (!GAS_URL || !GAS_KEY || !GAS_ADMIN_KEY) {
  console.error("❌ 環境変数が不足しています");
  console.error("  GAS_WEBAPP_URL:", GAS_URL ? "✅" : "❌ 未設定");
  console.error("  GAS_API_KEY:   ", GAS_KEY ? "✅" : "❌ 未設定");
  console.error("  GAS_ADMIN_KEY: ", GAS_ADMIN_KEY ? "✅" : "❌ 未設定");
  process.exit(1);
}

const BASE_URL = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_KEY)}`;

async function callGas(payload) {
  const res  = await fetch(BASE_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ...payload, adminKey: GAS_ADMIN_KEY }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `non-JSON response: ${text.slice(0, 200)}` };
  }
}

function printOk(action, data) {
  const preview = [];
  if (data.ok !== undefined)   preview.push(`ok: ${data.ok}`);
  if (data.reason !== undefined) preview.push(`reason: ${data.reason}`);
  // 主要フィールドをコンパクトに表示
  if (data.summary)            preview.push(`summary: ${JSON.stringify(data.summary)}`);
  if (data.missions)           preview.push(`missions: ${JSON.stringify(data.missions)}`);
  if (data.stakes !== undefined) preview.push(`stakes.length: ${Array.isArray(data.stakes) ? data.stakes.length : data.stakes}`);
  if (data.songs !== undefined)  preview.push(`songs.length: ${Array.isArray(data.songs) ? data.songs.length : data.songs}`);
  if (data.today !== undefined)  preview.push(`today: ${data.today}`);
  if (data.today_count !== undefined) preview.push(`today_count: ${data.today_count}, remaining: ${data.remaining}`);
  if (data.members !== undefined) preview.push(`members.length: ${Array.isArray(data.members) ? data.members.length : "?"}, total: ${data.total ?? "?"}`);
  if (data.bp_balance !== undefined) preview.push(`bp_balance: ${data.bp_balance}`);
  if (data.ep_balance !== undefined) preview.push(`ep_balance: ${data.ep_balance}`);
  if (data.bp_earned !== undefined)  preview.push(`bp_earned: ${data.bp_earned}, streak: ${data.streak}`);

  console.log(`✅ [${action}]`);
  for (const line of preview) console.log(`   ${line}`);
  console.log("");
}

function printErr(action, err) {
  console.log(`❌ [${action}]`);
  console.log(`   ERROR: ${JSON.stringify(err)}`);
  console.log("");
}

function separator() {
  console.log("─".repeat(50));
}

async function runTests() {
  console.log("=".repeat(50));
  console.log("  LIFAI GAS API テスト");
  console.log(`  GAS URL: ${GAS_URL.slice(0, 60)}…`);
  console.log("=".repeat(50));
  console.log("");

  const TEST_LOGIN_ID = "admin";

  // 1. daily_login_bonus
  separator();
  try {
    const d = await callGas({ action: "daily_login_bonus", loginId: TEST_LOGIN_ID });
    printOk("daily_login_bonus", d);
  } catch (e) { printErr("daily_login_bonus", e.message); }

  // 2. get_missions
  separator();
  try {
    const d = await callGas({ action: "get_missions", loginId: TEST_LOGIN_ID });
    printOk("get_missions", d);
  } catch (e) { printErr("get_missions", e.message); }

  // 3. get_stakes
  separator();
  try {
    const d = await callGas({ action: "get_stakes", loginId: TEST_LOGIN_ID });
    printOk("get_stakes", d);
  } catch (e) { printErr("get_stakes", e.message); }

  // 4. get_radio_songs
  separator();
  try {
    const d = await callGas({ action: "get_radio_songs" });
    printOk("get_radio_songs", d);
  } catch (e) { printErr("get_radio_songs", e.message); }

  // 5. get_radio_status
  separator();
  try {
    const d = await callGas({ action: "get_radio_status", loginId: TEST_LOGIN_ID });
    printOk("get_radio_status", d);
  } catch (e) { printErr("get_radio_status", e.message); }

  // 6. admin_dashboard
  separator();
  try {
    const d = await callGas({ action: "admin_dashboard" });
    printOk("admin_dashboard", d);
  } catch (e) { printErr("admin_dashboard", e.message); }

  // 7. admin_get_members
  separator();
  try {
    const d = await callGas({ action: "admin_get_members", page: 0, pageSize: 5 });
    printOk("admin_get_members", d);
  } catch (e) { printErr("admin_get_members", e.message); }

  // 8. gacha_spin
  separator();
  try {
    const d = await callGas({ action: "gacha_spin", loginId: TEST_LOGIN_ID });
    printOk("gacha_spin", d);
  } catch (e) { printErr("gacha_spin", e.message); }

  separator();
  console.log("✅ テスト完了");
}

runTests().catch(e => {
  console.error("致命的エラー:", e);
  process.exit(1);
});
