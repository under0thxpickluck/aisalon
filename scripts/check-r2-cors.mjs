// R2の公開ドメインがCORSヘッダを返すかを、実在オブジェクトで確認する使い捨てスクリプト。
// 読み取り専用（ListObjects と GET のみ）。
//   node scripts/check-r2-cors.mjs

import { readFileSync } from "node:fs";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const list = await s3.send(
  new ListObjectsV2Command({ Bucket: env.CLOUDFLARE_R2_BUCKET_NAME, MaxKeys: 50 })
);

const keys = (list.Contents ?? []).map((o) => o.Key);
console.log(`バケット ${env.CLOUDFLARE_R2_BUCKET_NAME} のオブジェクト数（先頭50件）: ${keys.length}`);

// 画像を優先して1件選ぶ
const target = keys.find((k) => /\.(png|jpe?g|webp)$/i.test(k)) ?? keys[0];
if (!target) {
  console.log("オブジェクトが1件もありません。確認できませんでした。");
  process.exit(0);
}
console.log(`確認対象: ${target}\n`);

const base = env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, "");
const url = `${base}/${target.split("/").map(encodeURIComponent).join("/")}`;

const res = await fetch(url, {
  headers: { Origin: "https://lifai.vercel.app" },
});

console.log(`GET ${url}`);
console.log(`HTTP ${res.status}`);
const acao = res.headers.get("access-control-allow-origin");
console.log(`content-type: ${res.headers.get("content-type")}`);
console.log(`access-control-allow-origin: ${acao ?? "(なし)"}`);

console.log("\n================ 判定 ================");
if (res.status !== 200) {
  console.log("⚠️ オブジェクトを取得できませんでした。公開設定を確認してください。");
} else if (acao) {
  console.log("✅ CORSヘッダあり。canvas への読み込みは成功するはずです。");
  console.log("   → 表示されない原因は別にあります。");
} else {
  console.log("❌ CORSヘッダがありません。");
  console.log("   crossOrigin='anonymous' を付けた画像読み込みは失敗します（=グリッドが表示されない）。");
  console.log("   さらに canvas が汚染されるため、ZIP書き出し(toBlob)も SecurityError になります。");
  console.log("   → 同一オリジンのプロキシ経由に変更する必要があります。");
}
