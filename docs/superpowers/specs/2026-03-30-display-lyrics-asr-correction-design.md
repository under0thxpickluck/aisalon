# displayLyrics ASR補正 設計仕様

## 目的

音楽生成フローで実際に歌われた内容（ASR書き起こし）をもとに、
ユーザーに表示する `displayLyrics` をより実歌唱に近い内容に補正する。

既存の `start → approve-structure → result` フローは維持し、
最小修正のパッチ方式で実装する。

---

## スコープ

### 変更するもの

| ファイル | 変更内容 |
|----------|----------|
| `lib/music/lyrics-display.ts` | **新規作成**。ウィンドウ付き逐次マッチング・ノイズ判定・正規化ロジック |
| `lib/music/lyrics-merge.ts` | `mergeLyricsForDisplay()` 内の `displayLyrics` / `lyricsSource` 計算を `finalizeDisplayLyrics()` に差し替え |

### 最小変更のみ

- `app/api/song/approve-structure/route.ts` — `mergeLyricsForDisplay()` 呼び出しに `jobId` を渡す1行追加のみ
- `app/api/song/result/route.ts` — 変更なし
- `MergeResult` の型定義 — 変更なし
- `distributionLyrics`, `mergedLyrics`, `reviewRequired`, `distributionReady`, `lyricsGateResult` の計算 — 既存 Case A/B/C/D のまま維持

---

## 歌詞の役割

| フィールド | 役割 |
|------------|------|
| `masterLyrics` | 人間向け元歌詞（OpenAI 生成） |
| `singableLyrics` | 実際に歌わせる歌詞（ElevenLabs に渡す） |
| `asrLyrics` | 実歌唱の書き起こし（ElevenLabs Scribe） |
| `displayLyrics` | ユーザー表示用最終歌詞（本仕様で改善対象） |

---

## アーキテクチャ

```
runAsrAndQuality() [approve-structure/route.ts] ← 変更なし
  └─ mergeLyricsForDisplay(singable, asr, score, repeatScore, ...) [lyrics-merge.ts]
       ├─ 既存 Case A/B/C/D: distributionLyrics, mergedLyrics, reviewRequired, distributionReady, lyricsGateResult を決定
       └─ 新規: finalizeDisplayLyrics(singable, asr, jobId) → { displayLyrics, lyricsSource } で上書き
```

`mergeLyricsForDisplay()` の外形（引数・戻り値型）は変えない。
内部で `finalizeDisplayLyrics()` を呼び、その結果で `displayLyrics` と `lyricsSource` のみ上書きする。

---

## 新規ファイル: `lib/music/lyrics-display.ts`

### エクスポートする関数

#### `finalizeDisplayLyrics(singable: string, asr: string | null | undefined, jobId?: string): { displayLyrics: string; lyricsSource: "singable" | "asr_merged" }`

外部公開 top-level 関数。フォールバック処理を含む。

内部で `mergeSingableWithAsr()` を呼ぶ。例外発生時は singable フォールバック。

#### `mergeSingableWithAsr(singable: string, asr: string): { displayLyrics: string; replacedCount: number; keptCount: number }`

ウィンドウ付き逐次マッチング本体。

#### `isNoiseLine(line: string): boolean`

ノイズ行判定。

#### `normalizeAsrLineForDisplay(line: string): string`

ASR 1行の表示向け正規化。

---

## `mergeSingableWithAsr()` アルゴリズム

```
入力: singable (string), asr (string)
出力: { displayLyrics: string, replacedCount: number, keptCount: number }

1. singable を行に分割 → singableLines[]
2. asr を行に分割 → 各行に normalizeAsrLineForDisplay 適用
   → isNoiseLine でフィルタ → asrLines[]
3. asrUsed = Set<number>（採用済み ASR 行インデックス）
4. asrPtr = 0（ASR 側の現在位置）
5. result: string[] = []

各 singableLine を順に処理:
  セクションタグ行 /^\[.*\]$/ → result にそのまま追加、続行

  通常行:
    window = [asrPtr-2 .. asrPtr+2] の範囲内で asrUsed に含まれないインデックス
    window が空 → singableLine を採用、keptCount++、続行

    bestIdx = window 内で bigramJaccard(singableLine, asrLines[idx]) が最大のもの
    similarity = その最大値

    採用条件:
      - singableLine.length > 4 のとき: similarity >= 0.45
      - singableLine.length <= 4 のとき: similarity >= 0.65（短行は厳しく）
      - かつ !isNoiseLine(asrLines[bestIdx])

    採用 → result に asrLines[bestIdx] を追加
            asrUsed に bestIdx を追加
            asrPtr = bestIdx + 1
            replacedCount++

    不採用 → result に singableLine を追加
              keptCount++

6. result に対して dedupeSequentialLines() を適用（同一行 3連続以上 → 2に圧縮）
7. result.join("\n") を返す
```

---

## `isNoiseLine()` 判定基準

以下のいずれかに該当する行をノイズと判定する：

- trim後の文字数が 3 未満
- 記号・スペースのみ（`/^[\s\W]+$/` にマッチ）
- `[` で始まる行（セクションタグ）

---

## `normalizeAsrLineForDisplay()` 処理内容

比較・除去が目的ではなく、表示向け整形が目的。

1. 先頭・末尾の余分な空白を trim
2. 連続する空白を1つに圧縮
3. 行頭の `-` や `・` などの記号プレフィックスを除去（ASR が箇条書き形式で出力する場合への対応）
4. セクションタグ `[xxx]` は除去しない（isNoiseLine で後から弾く）

---

## `bigramJaccardLine()` 仕様

既存 `lyrics-compare.ts` の `bigramJaccard()` と同ロジック。
`lyrics-display.ts` 内に独立して実装する（循環参照防止）。

- `normalizeLyricsForCompare()` は**呼ばない**（表示向け正規化済みの文字列を直接比較する）
- 入力は `normalizeAsrLineForDisplay` 適用済みの文字列を想定
- 入力が短すぎて bigram が作れない場合（0文字または1文字）は 0 を返す

---

## フォールバック条件

`finalizeDisplayLyrics()` 内で以下の条件を順に評価し、フォールバックする場合は固定の reason を使う：

| 条件 | reason | 結果 |
|------|--------|------|
| `asr` が null / undefined / 空文字 | `asr_unavailable` | `displayLyrics = singable, lyricsSource = "singable"` |
| ノイズ除去後 `asrLines` が 0 行 | `asr_empty_after_filter` | `displayLyrics = singable, lyricsSource = "singable"` |
| `mergeSingableWithAsr()` が例外 | `merge_exception` | `displayLyrics = singable, lyricsSource = "singable"` |
| `replacedCount === 0`（補正ゼロ） | —（フォールバックではない） | `lyricsSource = "singable"` |
| `replacedCount >= 1` | —（成功） | `lyricsSource = "asr_merged"` |

---

## ログ仕様

`mergeLyricsForDisplay()` 内の `finalizeDisplayLyrics()` 呼び出し前後に以下を出力する。

```
[merge][jobId=XXX] asr available=true asrRawLength=XXX
[merge][jobId=XXX] singableLines=XX asrLines=XX removedNoise=XX
[merge][jobId=XXX] replaced=XX kept=XX finalDisplayLength=XXX lyricsSource=singable|asr_merged
```

フォールバック時：
```
[merge][jobId=XXX] fallback reason=asr_unavailable|asr_empty_after_filter|merge_exception
```

`jobId` は `mergeLyricsForDisplay()` の引数として追加する（optional）。
既存呼び出し元 `approve-structure/route.ts` からは jobId を渡す。

---

## `mergeLyricsForDisplay()` 修正方針

### 引数に `jobId?: string` を追加

```typescript
export function mergeLyricsForDisplay(params: {
  singableLyrics: string;
  asrLyrics: string;
  score: number;
  repeatScore?: number;
  anchorWords?: string[];
  hookLines?: string[];
  jobId?: string;  // ← 追加（ログ用）
}): MergeResult
```

### 内部変更

既存の Case A/B/C/D 分岐はそのまま残し、各 case の `displayLyrics:` と `lyricsSource:` の値を、`finalizeDisplayLyrics()` の結果で上書きする。

パターン：

```typescript
const { displayLyrics, lyricsSource } = finalizeDisplayLyrics(
  singableLyrics,
  asrLyrics,
  params.jobId
);

// Case A の return を例に:
return {
  displayLyrics,        // ← 新ロジックの結果
  distributionLyrics: singableLyrics,  // ← 既存のまま
  mergedLyrics,
  reviewRequired: false,
  distributionReady: true,
  lyricsSource,         // ← 新ロジックの結果
  lyricsGateResult: "pass",
};
```

全 case（A/B/C/D）に同様に適用する。

---

## `approve-structure/route.ts` の呼び出し変更

`mergeLyricsForDisplay()` に `jobId` を渡す1行の追加のみ：

```typescript
// 変更前
const mergeResult = mergeLyricsForDisplay({
  singableLyrics: singable,
  asrLyrics: asrResult.text,
  score: compareResult.score,
  repeatScore: repeatResult.repeatScore,
  anchorWords,
  hookLines,
});

// 変更後
const mergeResult = mergeLyricsForDisplay({
  singableLyrics: singable,
  asrLyrics: asrResult.text,
  score: compareResult.score,
  repeatScore: repeatResult.repeatScore,
  anchorWords,
  hookLines,
  jobId,  // ← 追加
});
```

---

## テスト観点

| # | シナリオ | 期待動作 |
|---|----------|----------|
| 1 | ASR null/空 | `lyricsSource="singable"`, ログに `fallback reason=asr_unavailable` |
| 2 | ASR がノイズのみ | `lyricsSource="singable"`, ログに `fallback reason=asr_empty_after_filter` |
| 3 | `mergeSingableWithAsr` が例外 | `displayLyrics=singable`, ログに `fallback reason=merge_exception` |
| 4 | singable と ASR が高類似度（同じ内容） | 全行 ASR 採用、`lyricsSource="asr_merged"` |
| 5 | singable と ASR が低類似度（全く別内容） | 全行 singable 維持、`lyricsSource="singable"` |
| 6 | ASR に同一行の3連続 | dedupeSequentialLines で2行に圧縮 |
| 7 | 4文字以内の短い singable 行で類似度 0.5 の ASR 行 | 閾値 0.65 未満のため不採用、singable 維持 |
| 8 | セクションタグ行 `[Chorus]` | 比較対象にならず result にそのまま含まれる |
| 9 | ASR 行数が singable より少ない | ウィンドウ外のため singable 維持 |
| 10 | `approve-structure` から jobId 渡し | ログに `[merge][jobId=song_XXXXXX_XXXXXX]` が出る |
