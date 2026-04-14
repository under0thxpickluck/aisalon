# timestamps_builder_internal_debug.md

## 目的

Vercel ログより、displayLyrics が壊れる原因は
UI / result API / 最終保存ではなく、
**buildDisplayLyricsFromTimestamps() の内部ロジック**
にあることが判明した。

そのため、新ロジック追加は行わず、
**timestamps から displayLyrics を組み立てる各段階で、どこで文字が消えているかを特定する。**

---

## 判明済み事実

* timestamps_display がすでに崩れている
* final_display は timestamps_display と同じ
* return_display も final_display と同じ

つまり、

* 上書きバグではない
* result API の返却バグでもない
* UI表示バグでもない

問題は **buildDisplayLyricsFromTimestamps() 内部** に限定される

---

## 最重要方針

* 新機能追加禁止
* 閾値いじり禁止
* まずは内部ログ追加だけ
* 既存構造を壊さない
* buildDisplayLyricsFromTimestamps() の中だけを追う

---

## 確認したい段階

以下の段階ごとにログを出すこと：

1. JSON parse 後の token 数
2. word token 抽出後の件数
3. low logprob 除外後の件数
4. audio_event 処理後の lines 数
5. cleanup 前の lines preview
6. cleanup 後の lines preview
7. sourceLyrics 補正前の lines preview
8. sourceLyrics 補正後の lines preview
9. 最終 join 前の lines 数

---

## 追加するログ

### 1. parse 直後

```ts
console.log(`[timestamps][jobId=${jobId}] parsed tokens=${tokens.length}`);
```

### 2. type 別件数

```ts
const wordCount = tokens.filter(t => t?.type === "word").length;
const spacingCount = tokens.filter(t => t?.type === "spacing").length;
const eventCount = tokens.filter(t => t?.type === "audio_event").length;
console.log(`[timestamps][jobId=${jobId}] token_breakdown word=${wordCount} spacing=${spacingCount} event=${eventCount}`);
```

### 3. low logprob 除外件数

```ts
console.log(`[timestamps][jobId=${jobId}] low_logprob_removed=${removedLowLogprobCount} kept_words=${keptWordCount}`);
```

### 4. audio_event 処理後

```ts
console.log(`[timestamps][jobId=${jobId}] after_event_split lines=${lines.length} preview=${lines.slice(0, 8).join(" | ")}`);
```

### 5. cleanup 前

```ts
console.log(`[timestamps][jobId=${jobId}] before_cleanup lines=${rawLines.length} preview=${rawLines.slice(0, 8).join(" | ")}`);
```

### 6. cleanup 後

```ts
console.log(`[timestamps][jobId=${jobId}] after_cleanup lines=${cleanedLines.length} preview=${cleanedLines.slice(0, 8).join(" | ")}`);
```

### 7. sourceLyrics 補正前

```ts
console.log(`[timestamps][jobId=${jobId}] before_source_correct lines=${cleanedLines.length} preview=${cleanedLines.slice(0, 8).join(" | ")}`);
```

### 8. sourceLyrics 補正後

```ts
console.log(`[timestamps][jobId=${jobId}] after_source_correct lines=${correctedLines.length} preview=${correctedLines.slice(0, 8).join(" | ")}`);
```

### 9. 最終結果

```ts
console.log(`[timestamps][jobId=${jobId}] final_join len=${finalText.length} preview=${finalText.slice(0, 160)}`);
```

---

## 特に確認したいバグ候補

### A. audio_event 後に後半歌詞が消える

症状:

* `[間奏]` までは出る
* その後が出ない

確認:

* audio_event に入ったあと current / prevEnd / lines がどうなるか
* `[間奏]` 後の word token が追加されているか

### B. cleanup で消しすぎ

症状:

* before_cleanup では複数行ある
* after_cleanup で激減する

確認:

* 1文字行除外
* 記号行除外
* 重複除外
* KEEP_EVENT / DROP_EVENT 判定

### C. sourceLyrics 補正で消しすぎ

症状:

* before_source_correct は多い
* after_source_correct で激減する

確認:

* 類似度が低い行を「維持」ではなく「削除」していないか

### D. final join 前に空行だらけ

症状:

* line 数はあるのに finalText が極端に短い

確認:

* join 対象が別変数になっていないか
* filter(Boolean) などで過剰除去していないか

---

## 最終報告フォーマット

以下を貼って報告すること：

```txt
parsed tokens:
token_breakdown:
low_logprob_removed:
after_event_split:
before_cleanup:
after_cleanup:
before_source_correct:
after_source_correct:
final_join:
```

---

## 判断基準

* parsed token 数が少なすぎる → timestampsJson 取得/parse 問題
* wordCount は多いのに after_event_split が少ない → 行組み立て問題
* before_cleanup は多いのに after_cleanup が少ない → cleanup 問題
* after_cleanup は多いのに after_source_correct が少ない → source 補正問題
* after_source_correct は多いのに final_join が短い → join / return 問題

---

## ゴール

👉 buildDisplayLyricsFromTimestamps() のどの段階で文字数が激減しているかを特定する
