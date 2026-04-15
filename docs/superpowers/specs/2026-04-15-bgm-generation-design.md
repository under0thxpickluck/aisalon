# BGM生成機能 実装設計書

> 作成日: 2026-04-15
> 対象: aisalon / app/music2

---

## 概要

「音楽生成NEW」（`/music2`）ページ内に、ボーカルなしのBGM生成機能を追加する。
エンジンはReplicate（minimax music-01モデル）を使用。
リリース時点では **準備中（タブをグレーアウト＆非クリック）** として公開し、実装は完成した状態で保持する。

---

## 設計方針

- 既存のElevenLabsウィザード（step 0〜3）のstate・ロジック・JSXは**一切変更しない**
- タブUI追加のみで既存機能を分離
- BGMタブは`pointer-events-none opacity-50`で非インタラクティブ（stateも不要）
- Replicateの呼び出しロジックは旧`/api/music/generate/route.ts`から流用

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `app/music2/page.tsx` | 変更 | メインカード上部にタブUI追加（約10行） |
| `app/api/bgm/generate/route.ts` | 新規 | BGMプロンプト構築 + Replicate呼び出し |
| `app/api/bgm/status/route.ts` | 新規 | Replicate polling（既存music/statusから流用） |

---

## UIデザイン

`app/music2/page.tsx` のメインカード内、ヘッダーの直下に静的タブを追加：

```
[ ボーカル曲 ← 現在のウィザード ]  [ BGM  準備中 (greyed out) ]
```

実装：
```tsx
<div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 mb-4">
  <div className="flex-1 rounded-lg bg-white px-4 py-2 text-center text-xs font-bold text-slate-800 shadow-sm">
    ボーカル曲
  </div>
  <div className="relative flex-1 cursor-not-allowed rounded-lg px-4 py-2 text-center text-xs font-bold text-slate-400 pointer-events-none opacity-50">
    BGM
    <span className="ml-1.5 rounded-full bg-slate-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">準備中</span>
  </div>
</div>
```

---

## API設計

### POST `/api/bgm/generate`

**リクエスト:**
```json
{
  "theme": "夏の朝、爽やかな目覚め",
  "genre": "ローファイ",
  "mood": "落ち着いた",
  "bpm": 80,
  "duration": 30
}
```

**処理フロー:**
1. プロンプト構築（`buildBgmPrompt`）― `instrumental only, no vocals` を強制付与
2. Replicate API (`/v1/predictions`) に POST（minimax music-01モデル、version `671ac645...`）
3. `predictionId` を返す

**レスポンス:**
```json
{ "ok": true, "predictionId": "abc123" }
```

**プロンプト構築ルール:**
- genre, mood, theme をカンマ区切りで英語変換
- 末尾に固定で `instrumental only, no vocals, no singing, background music, BGM` を付加
- bpm指定がある場合 `{N} BPM` を追加
- durationはReplicateの`duration`パラメータに直接渡す（秒）

### GET `/api/bgm/status?id={predictionId}`

**処理フロー:**
1. `GET https://api.replicate.com/v1/predictions/{id}` でステータス取得
2. `status` が `succeeded` の場合 `audioUrl`（`output[0]`）を返す
3. `failed` の場合エラーを返す
4. それ以外は `processing` を返す

**レスポンス（完了時）:**
```json
{ "ok": true, "status": "succeeded", "audioUrl": "https://..." }
```

---

## Replicateモデル仕様

| 項目 | 値 |
|---|---|
| モデル | `minimax/music-01` |
| バージョン | `671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb` |
| 環境変数 | `REPLICATE_API_TOKEN`（既存） |
| duration範囲 | 30〜180秒 |
| output_format | `mp3` |

---

## エラーハンドリング

| エラー | 対応 |
|---|---|
| `REPLICATE_API_TOKEN` 未設定 | 500を返す |
| Replicate API エラー | `{ ok: false, error: "replicate_error" }` |
| prediction `failed` | `{ ok: false, error: "generation_failed" }` |

---

## 制約・除外事項

- BGMページのUI（入力フォーム・再生プレイヤー）は実装しない（準備中のため）
- BP消費・GASログは準備中解除時に追加する
- ElevenLabsは使用しない（Replicateのみ）
- status APIはフロントエンドのポーリングから利用する想定だが、UIは今回作らない
