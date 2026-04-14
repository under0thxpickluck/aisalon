# displayLyrics_debug_execution.md

## 目的

displayLyrics が不正になる原因を特定する。

buildDisplayLyricsFromTimestamps() は実装済みのため、
問題は「ロジック不足」ではなく
**どこで正しい値が失われているか**にある。

---

## 実行手順（Vercelログ）

以下の順番でログを確認すること：

---

### ① timestamps / fallback の確認

```
[merge][jobId=xxx] timestamps_display len=NNN preview=...
```

または

```
[merge][jobId=xxx] fallback_display len=NNN preview=... reason=...
```

---

### ② 最終採用値の確認

```
[merge][jobId=xxx] final_display source=... len=NNN preview=...
```

---

### ③ API返却値の確認

```
[result][jobId=xxx] return_display len=NNN preview=...
```

---

## 判定テーブル

┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
│                     パターン                     │                             原因                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ timestamps_display が崩れている                  │ buildDisplayLyricsFromTimestamps のロジック不具合            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ timestamps_display は正しいが final_display が違う │ lyrics-merge.ts の分岐で上書きされている                    │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ final_display は正しいが return_display が違う   │ result/route.ts のフォールバック処理で上書き                │
│                                                  │ （例：singableLyrics に落ちている）                         │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ return_display は正しいが UI が違う              │ フロント側の state / ポーリング / キャッシュ問題            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ reason=timestamps_empty                          │ timestamps が未取得（asrResult.timestampsJson 未連携）      │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘

---

## 必ずやること

以下をそのまま貼り付けてログ取得：

### timestampsログ

```ts
console.log(`[merge][jobId=${jobId}] timestamps_display len=${displayFromTimestamps.length} preview=${displayFromTimestamps.slice(0, 120)}`);
```

### fallbackログ

```ts
console.log(`[merge][jobId=${jobId}] fallback_display len=${fallbackDisplay.length} preview=${fallbackDisplay.slice(0, 120)} reason=${reason}`);
```

### 最終ログ

```ts
console.log(`[merge][jobId=${jobId}] final_display source=${finalDisplaySource} len=${finalDisplayLyrics.length} preview=${finalDisplayLyrics.slice(0, 120)}`);
```

### API返却ログ

```ts
console.log(`[result][jobId=${jobId}] return_display len=${displayLyrics.length} preview=${displayLyrics.slice(0, 120)}`);
```

---

## 出力フォーマット（必須）

以下をそのまま提出：

```
timestamps_display:
xxxx

fallback_display:
xxxx

final_display:
xxxx

return_display:
xxxx

UI表示:
xxxx

差分発生箇所:
（どこで変わったか）
```

---

## 重要な前提

* timestamps は既に高精度で取得できている
* 問題は ASR ではない
* 問題は merge でもない可能性が高い

👉 **問題は「採用順」か「上書き」**

---

## 絶対にやってはいけないこと

* 新ロジック追加
* mergeアルゴリズム変更
* 閾値変更
* ASR変更
* UI修正

---

## ゴール

👉 displayLyrics が壊れる「正確な地点」を特定する

---

## 補足

この問題はかなり高確率で以下のどれか：

1. timestamps → 正しい
2. merge → 正しく作成
3. その後どこかで上書き

👉 つまり「最後の1箇所」が原因
