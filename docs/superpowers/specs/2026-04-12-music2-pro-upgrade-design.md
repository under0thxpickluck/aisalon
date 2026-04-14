# music2 Pro設定強化 設計書

**日付**: 2026-04-12  
**対象**: `app/music2/page.tsx`, `app/api/song/start/route.ts`, `app/lib/bp-config.ts`

---

## 概要

音楽生成NEW（`/music2`）のPro設定セクションを以下の2軸で強化する。

1. **音楽パラメータの追加**: 楽器選択・曲の長さ選択を新設
2. **デザイン豪華化**: Pro設定セクションをダーク＋パープルグロー表示に変更
3. **BP課金分離**: Pro設定を1つでも使った場合は250BP、未使用なら100BP

---

## BP消費ロジック

### 判定（バックエンド）

`app/api/song/start/route.ts` でリクエストの以下フィールドを検査する。

```ts
const isProSettingsUsed = !!(bpmHint || vocalStyle || vocalMood || instruments?.length || duration);
const bpCost = isProSettingsUsed ? BP_COSTS.music_full_pro : BP_COSTS.music_full;
```

- `bpmHint` / `vocalStyle` / `vocalMood` / `instruments`（非空配列）/ `duration` のいずれかが存在 → **250BP**
- すべて未設定 → **100BP**（従来通り）

### bp-config.ts 追加

```ts
music_full_pro: 250,  // Pro設定使用時のフル生成
```

### フロントエンドのBP表示

```ts
const isProSettingsActive =
  isPro && (!!bpmHint || !!vocalStyle || !!vocalMood || instruments.length > 0 || !!duration);
const displayBp = isProSettingsActive ? 250 : 100;
```

BP表示欄・insufficient_bpエラーメッセージの両方に反映する。

---

## 追加パラメータ

### 楽器選択（`instruments: string[]`）

```ts
const INSTRUMENTS = ["ピアノ", "ギター", "ストリングス", "ブラス", "サックス"];
```

- 複数選択可（チップトグル）
- 未選択でも可（任意）
- `/api/song/start` に `instruments` 配列として送信

### 曲の長さ（`duration: number | null`）

```ts
const DURATION_OPTIONS = [
  { label: "30秒", value: 30 },
  { label: "1分",  value: 60 },
  { label: "2分",  value: 120 },
  { label: "3分",  value: 180 },
];
```

- 単一選択（再クリックで解除）
- 未選択でも可（任意）
- `/api/song/start` に `duration`（秒数）として送信

---

## Proセクション デザイン変更

### 現在

```
bg-violet-50 border-violet-200 — 白っぽい薄紫背景
```

### 変更後

```
bg-[#0d0d1a]
border border-violet-500/30
shadow-[0_0_20px_rgba(139,92,246,0.15)]
```

**チップの色**

| 状態 | 背景 | テキスト | ボーダー |
|---|---|---|---|
| 選択中 | `bg-violet-600` | `text-white` | なし |
| 未選択 | `bg-[#1e1b4b]` | `text-indigo-300` | `border-[#3730a3]` |

**セクションラベル**

- `text-violet-400`（暗背景向け）
- 追加項目には `NEW` バッジ（`bg-[#312e81] text-[#a5b4fc]`）

**ヘッダー**

- `🎛️ PRO SETTINGS` を `text-violet-400 tracking-widest` で表示
- PROバッジ: `bg-gradient-to-r from-violet-600 to-indigo-500`

---

## API送信パラメータ変更

### `handleStart` → `/api/song/start`

```ts
body: JSON.stringify({
  id, code, theme, genre, mood: moodStr, isPro,
  bpmHint:    isPro && bpmHint    ? bpmHint    : undefined,
  vocalStyle: isPro && vocalStyle ? vocalStyle : undefined,
  vocalMood:  isPro && vocalMood  ? vocalMood  : undefined,
  instruments: isPro && instruments.length > 0 ? instruments : undefined,  // NEW
  duration:   isPro && duration   ? duration   : undefined,                // NEW
  language:   "ja",
}),
```

### `handleFullReset` にクリア追加

```ts
setInstruments([]);
setDuration(null);
```

---

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `app/lib/bp-config.ts` | `music_full_pro: 250` 追加 |
| `app/api/song/start/route.ts` | `isProSettingsUsed` 判定、BP cost分岐、`instruments`/`duration` 受け取り |
| `app/music2/page.tsx` | 定数追加、state追加、Proセクション全面デザイン変更、BP表示更新 |

---

## 変更しないもの

- `/api/song/approve-structure`、`/api/song/result` など他のAPIルート
- Step 1（構成確認）の表示内容・編集機能
- 非Proユーザーの表示・フロー
- GAS側のBP deductロジック（`amount` を API から渡しているので自動対応）
