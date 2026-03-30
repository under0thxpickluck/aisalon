# LIFAI `/music2` 音楽生成の歌詞一致改善・反復防止 実装仕様書

## 目的

`/music2` において発生している以下の問題を根本的に改善する。

1. 生成された音源内で同じ歌詞フレーズが不自然に連続反復される
2. 実際に歌われた内容が、生成・保存している歌詞と大きく乖離する
3. 歌詞一致率を計測しているにもかかわらず、最終表示歌詞・配信用歌詞に補正結果が反映されていない
4. 配信用として不適切な楽曲でも completed で通ってしまう

現行仕様では `displayLyrics` / `distributionLyrics` がスコアに関係なく常に `masterLyrics` を使う構造であり、また `singable_lyrics` 生成ルールが「意味より発音を優先」になっているため、歌詞乖離を助長している。さらに実データでも、テーマ「日々の守り」に対して ASR は別内容を反復し、一致率 total は 0.6 と極端に低い。これらを修正し、歌詞の意味保持・歌唱拘束・反復検知・品質ゲート を追加して、配信提出可能な品質まで引き上げる。

---

## 現状の問題整理

### 問題1: 表示歌詞と配信用歌詞が補正結果を使っていない

現行仕様では `display_lyrics` と `distribution_lyrics` が常に `masterLyrics` 固定になっている。`compareLyrics` と `mergeLyricsForDisplay` は実行しているが、結果は配信可否フラグの判定にしか使われていない。

### 問題2: singable変換が意味保持に弱い

現行の `buildSingableLyrics` は「1行12〜16音節」「子音連続回避」「ひらがな化」に加え、「意味より発音を優先」となっている。これにより ElevenLabs に渡る時点で元歌詞の意味拘束が弱くなり、別内容へ逸脱しやすい。

### 問題3: 実例で極端な歌詞乖離と反復が発生している

サンプル `song_20260330_IUCMDW` では、元歌詞は「守りの旋律」「明日を信じて」「希望を紡ぐ」などの内容だが、ASR では「朝焼けの空が街を染めてく」など別内容が連続し、同一フレーズが繰り返されている。スコア内訳も `axis1_chars: 0.6`, `axis2_lines: 0`, `axis3_words: 0`, `axis4_order: 0`, `total: 0.6` と極端に低い。

### 問題4: 品質ゲートが弱い

現行では `distributionReady=false` にはなるが、completed は通る。ユーザー表示歌詞も master 固定のため、実際の歌唱と乖離したまま表面上は完成品に見える。

---

## 実装方針

### 結論

以下の4本柱で改善する。

1. **歌詞意味保持型 singable 生成** に変更する
2. **ElevenLabs への歌詞拘束を強くする**
3. **反復検知と品質スコアを導入する**
4. **display / distribution に補正結果を実際に反映する**

### 変更対象

- `/api/song/start`
- `/api/song/approve-structure`
- `/api/song/status`
- `/api/song/result`
- `song_jobs` シート
- `buildSingableLyrics`
- `compareLyrics`
- `mergeLyricsForDisplay`
- ElevenLabs 用プロンプト生成関数
- ASR後処理
- 完成画面
- 管理画面または内部レビュー用データ保存

### 変更しないもの

- BP 先払い仕様
- 基本の 4 ステップUI構造
- 後加工（EQ / コンプ / リバーブ / ラウドネス）の基本機能
- R2 保存構造そのもの

---

## 新しい全体フロー

1. 入力
2. OpenAIで `masterLyrics` 生成
3. `masterLyrics` から 意味保持型 `singableLyrics` を生成
4. 歌詞の重要語 `anchorWords` を抽出
5. サビ固定行 `hookLines` を抽出
6. 構成確認
7. ElevenLabs に 拘束強化プロンプト + singableLyrics + hookLines + anchorWords を渡して生成
8. raw / final 保存
9. 後加工
10. ASR 実行
11. 反復検知
12. 歌詞一致率計算
13. 補正候補 `mergedLyrics` 生成
14. `displayLyrics` / `distributionLyrics` を決定
15. 品質ゲート判定
16. completed / review_required / failed を決定

---

## `song_jobs` シート追加列

既存列は壊さず、以下を追加すること。

| 列名 | 意味 |
|---|---|
| `anchor_words_json` | 歌詞の中核語一覧。意味拘束用。 |
| `hook_lines_json` | サビ固定行。最重要拘束用。 |
| `repeat_score` | 反復の重さを数値化したもの。 |
| `repeat_detected` | true / false |
| `repeat_segments_json` | どのフレーズが何回反復したか。 |
| `lyrics_quality_score` | 一致率 + 反復率 + 重要語保持率を統合した最終品質スコア。 |
| `lyrics_gate_result` | `pass` / `review` / `reject` |
| `merged_lyrics` | ASR補正後の候補歌詞。 |
| `distribution_review_reason` | 配信提出NG理由。 |
| `generation_attempt` | 何回目の生成か。 |
| `regeneration_reason` | 再生成した理由。 |
| `section_plan_json` | セクションごとの歌詞割当計画。 |

---

## 歌詞生成の改善仕様

### 1. `masterLyrics` 生成ルール

OpenAIには従来どおり歌詞を生成させるが、以下を追加すること。

- 1行 8〜16文字を基本
- サビは 2〜4行を固定し、再利用前提で作る
- 意味上の中心語を繰り返し使う
- Verseごとに話題を変えすぎない
- ランダムな比喩や世界観飛躍を減らす
- 重要語が明確に抽出できる文体にする

### 2. `anchorWords` 抽出

`masterLyrics` から以下を抽出する関数を追加する。

**抽出対象**
- タイトル語
- hookSummary の中核語
- Chorus の名詞 / 動詞
- テーマ語
- 禁止したくないキーワード

**例**

`守りの旋律` の場合、候補は:
- 守り
- 旋律
- 明日
- 希望
- 守る

これらは歌唱結果に最低限残るべき語として扱う。

### 3. `hookLines` 抽出

Chorus から 2〜4 行を固定サビとして抽出する。これらは ElevenLabs 生成時に **絶対保持したい行** として使う。

---

## `buildSingableLyrics` の全面改修

### 現行問題

現行仕様の「意味より発音を優先」は廃止する。

### 新ルール

`buildSingableLyrics` は **意味保持優先 + 発音補助** に変更する。

**許可する変換**
1. 難読語だけ ひらがな補助
2. 長すぎる1行を2行へ分割
3. 語尾の軽微調整
4. 句読点除去
5. 発音しづらい記号除去
6. BPM別に音節上限を調整

**禁止する変換**
1. 意味の異なる語への置換
2. 主題変更
3. hookLines の書き換え
4. anchorWords の削除
5. Verse内容の要約しすぎ
6. 全文ひらがな化

**BPM別ガイド**

| BPM | 1行の音節数 |
|---|---|
| 70〜90 | 8〜12音節 |
| 91〜115 | 10〜14音節 |
| 116〜140 | 8〜12音節 |
| 141以上 | 6〜10音節 |

**必須要件**
- `hookLines` は原文維持率 95%以上
- `anchorWords` は 80%以上保持
- 変換後の差分率が高すぎる場合は `masterLyrics` をそのまま使う

---

## ElevenLabs 生成拘束の強化仕様

### 現行問題

現行の ElevenLabs プロンプトは音質・ジャンル・ボーカル表現が厚く、歌詞拘束が相対的に弱い。

### 新ルール

プロンプトの優先順位を以下に変更する。

1. 歌詞を守ること
2. hookLines を守ること
3. セクション順序を守ること
4. anchorWords を残すこと
5. 音楽表現・雰囲気
6. 音質

**追加指示**

プロンプトに以下を必ず含めること。

- 指定した歌詞以外の新規フレーズを極力追加しない
- Chorus以外で同一フレーズを連続反復しない
- サビの反復は指定回数のみ
- Verseの各行は別行として扱う
- 意味の異なる歌詞に置き換えない
- セクションの境界を守る

**追加パラメータ**

| パラメータ | 初期値 |
|---|---|
| `lyricStrictness` (0〜1) | `0.9` |
| `maxChorusRepeats` | `2` |
| `allowAdlibs` | `false` |
| `allowInstrumentalIntroSec` | `8` |
| `allowInstrumentalOutroSec` | `8` |

---

## セクション分割生成仕様

### 目的

180秒一発生成で歌詞拘束が崩れる問題を減らす。

### 新モード

曲を以下の単位で分割生成可能にする。

- Block A: Intro + Verse A
- Block B: Chorus
- Block C: Verse B + Chorus
- Block D: Bridge + Outro

または構成に応じて動的に分割する。

### 実装方針

まず v1.5 としてオプション機能で入れる。品質スコアが低い場合の再生成時に優先使用する。

**必須**
- 各ブロックの歌詞だけを送る
- Chorus ブロックは hookLines を中心に固定
- 最後に結合
- 結合後も ASR / compare / repeat検知を再実行

---

## 反復防止仕様

### 目的

「同じ歌詞を2回繰り返す」問題を自動検知し、品質ゲートに反映する。

### 新関数 `detectRepetition(asrLyrics, timestamps)`

**検知ルール**
1. 同一行が連続2回以上出たら検知
2. 6文字以上の同一n-gramが連続2回以上出たら検知
3. Chorus以外で同一行の再出現率が20%を超えたら検知
4. 10秒以内に同一フレーズが2回以上出たら強いペナルティ
5. filler 語以外の反復は重く評価
6. `oh`, `yeah`, `ah` だけは軽微扱い

**出力**

```ts
{
  repeatDetected: boolean;
  repeatScore: number; // 0-100, 高いほど悪い
  repeatSegments: Array<{
    text: string;
    count: number;
    start: number;
    end: number;
    section?: string;
  }>;
}
```

**判定**

| repeatScore | 判定 |
|---|---|
| < 15 | 正常 |
| 15〜34 | 注意 |
| 35〜59 | 要レビュー |
| >= 60 | 自動再生成候補 |

今回のような「朝焼けの空が街を染めてく」が連続するケースは `repeatScore >= 60` 扱いにする。

---

## 歌詞一致率の改善仕様

### 現行

`compareLyrics` は 4軸スコアのみ。

### 新仕様: 7軸に拡張

1. 文字レベル類似度
2. 行一致率
3. 単語一致率
4. 順序保持率
5. anchorWords 保持率
6. hookLines 一致率
7. 反復ペナルティ補正

### 新しい最終スコア

```
lyricsQualityScore =
  baseCompareScore * 0.55 +
  anchorRetentionScore * 0.20 +
  hookRetentionScore * 0.20 -
  repeatPenalty * 0.15 +
  orderBonus * 0.05
```

数式は調整可能だが、重要語とサビ保持を強く評価すること。

### 閾値

| スコア | 判定 |
|---|---|
| 90以上 | pass |
| 80〜89 | review |
| 65〜79 | soft reject |
| 64以下 | reject |

---

## `mergeLyricsForDisplay` の仕様変更

### 現行問題

現行は最終的に `displayLyrics` / `distributionLyrics` が `masterLyrics` 固定。これを廃止する。

### 新ルール

**Case A: 高品質**
- 条件: `lyricsQualityScore >= 90` かつ `repeatScore < 15`
- `displayLyrics = singableLyrics`
- `distributionLyrics = singableLyrics`
- `lyricsSource = "singable"`

**Case B: 軽微ずれ**
- 条件: `80 <= score < 90`
- `mergedLyrics` を生成
- `displayLyrics = mergedLyrics`
- `distributionLyrics = mergedLyrics`
- `lyricsSource = "asr_merged"`

**Case C: 中程度ずれ**
- 条件: `65 <= score < 80`
- `displayLyrics = mergedLyrics`
- `distributionLyrics = ""`
- `lyricsReviewRequired = true`
- `distributionReady = false`

**Case D: 重度ずれ / 強反復**
- 条件: `score < 65` または `repeatScore >= 35`
- `displayLyrics = singableLyrics`
- `distributionLyrics = ""`
- `lyricsReviewRequired = true`
- `distributionReady = false`
- `lyricsGateResult = "reject"`

> **重要**: `distributionLyrics` が空の場合は配信提出不可扱いにする。

---

## 自動再生成仕様

### 目的

明らかに品質が悪い楽曲を completed のまま終わらせず、再挑戦できるようにする。

### 条件

以下のどれかで自動再生成候補にする。

- `lyricsQualityScore < 65`
- `repeatScore >= 60`
- `anchorWords` 保持率 < 40%
- `hookLines` 一致率 < 50%

### 挙動

初回生成失敗時は **1 回だけ** 自動再生成してよい。

**再生成時変更**
- `lyricStrictness` を上げる
- `allowAdlibs=false` を強化
- Chorus反復回数を減らす
- 可能ならセクション分割生成へ切替
- Pro 音質指定を少し薄め、歌詞拘束を強める

**保存**
- `generation_attempt += 1`
- `regeneration_reason` を保存

---

## 新ステータス追加

| ステータス | 意味 |
|---|---|
| `quality_checking` | ASR / 一致率 / 反復チェック中 |
| `regenerating_audio` | 自動再生成中 |
| `review_required` | 手動確認が必要 |

---

## `/api/song/approve-structure` の新フロー

1. `status = generating_audio`
2. ElevenLabsへ拘束強化プロンプトで送信
3. raw保存
4. postprocess
5. `status = transcribing_lyrics`
6. ASR実行
7. `status = quality_checking`
8. `detectRepetition`
9. `compareLyrics`
10. `mergeLyricsForDisplay`
11. 品質ゲート判定
12. 低品質なら `regenerating_audio` へ移行して1回だけ再生成
13. 再評価
14. `pass` なら completed
15. `review` または `reject` なら `review_required`

---

## `/api/song/status` 仕様変更

**追加ステータス**

| ステータス | 表示テキスト | progress |
|---|---|---|
| `transcribing_lyrics` | - | 94 |
| `quality_checking` | 歌詞と反復を検査しています | 97 |
| `regenerating_audio` | 品質を改善するため再生成しています | 70 |
| `review_required` | 歌詞の最終確認が必要です | 100 |

---

## `/api/song/result` 仕様変更

**新しい返却値**

```ts
{
  ok: boolean
  jobId: string
  audioUrl: string
  displayLyrics: string
  distributionLyrics: string
  mergedLyrics?: string
  masterLyrics?: string
  singableLyrics?: string
  asrLyrics?: string
  lyricsQualityScore?: number
  repeatScore?: number
  repeatDetected?: boolean
  lyricsGateResult?: "pass" | "review" | "reject"
  distributionReady?: boolean
  lyricsReviewRequired?: boolean
  anchorWords?: string[]
  hookLines?: string[]
  generationAttempt?: number
}
```

**返却ルール**
- ユーザー表示は `displayLyrics`
- 配信用ダウンロードは `distributionLyrics`
- `distributionReady=false` なら配信用ダウンロードを無効化または警告表示

---

## 完成画面の仕様

**表示**
- 音楽プレイヤー
- `displayLyrics`
- 通常歌詞ダウンロード
- 配信用歌詞ダウンロード
- 品質表示バッジ

**品質表示**

| 判定 | 色 |
|---|---|
| `pass` | 緑 |
| `review` | 黄 |
| `reject` | 赤 |

**警告**

`review_required` または `distributionReady=false` のとき、以下を表示。

> `この曲は歌詞一致または反復に問題があるため、配信提出前に確認してください。`

---

## 管理レビュー仕様

### 目的

自動で危険判定された曲を手動修正できるようにする。

### 必須表示項目

- masterLyrics
- singableLyrics
- asrLyrics
- mergedLyrics
- anchorWords
- hookLines
- repeatSegments
- lyricsQualityScore
- repeatScore

### 操作

- `displayLyrics に採用`
- `distributionLyrics に採用`
- 手動編集して保存
- 配信可にする
- 配信不可のまま保存

---

## 新規内部モジュール構成案

```
lib/music/lyrics-anchor.ts
lib/music/lyrics-hook.ts
lib/music/lyrics-repeat.ts
lib/music/lyrics-quality.ts
lib/music/lyrics-gate.ts
lib/music/lyrics-merge.ts
lib/music/elevenlabs-constraints.ts
```

| ファイル | 役割 |
|---|---|
| `lyrics-anchor.ts` | anchorWords 抽出 |
| `lyrics-hook.ts` | hookLines 抽出 |
| `lyrics-repeat.ts` | 反復検知 |
| `lyrics-quality.ts` | 品質スコア統合 |
| `lyrics-gate.ts` | pass/review/reject 判定 |
| `lyrics-merge.ts` | mergedLyrics 生成 |
| `elevenlabs-constraints.ts` | 歌詞拘束プロンプト生成 |

---

## 関数仕様案

### `extractAnchorWords`

```ts
function extractAnchorWords(params: {
  title: string;
  hookSummary: string;
  masterLyrics: string;
  theme?: string;
}): string[]
```

### `extractHookLines`

```ts
function extractHookLines(masterLyrics: string): string[]
```

### `buildSingableLyrics`

```ts
async function buildSingableLyrics(params: {
  masterLyrics: string;
  bpm?: number;
  genre?: string;
  mood?: string;
  anchorWords?: string[];
  hookLines?: string[];
}): Promise<string>
```

### `detectRepetition`

```ts
function detectRepetition(params: {
  asrLyrics: string;
  timestamps?: unknown;
  chorusLines?: string[];
}): {
  repeatDetected: boolean;
  repeatScore: number;
  repeatSegments: Array<Record<string, unknown>>;
}
```

### `computeLyricsQuality`

```ts
function computeLyricsQuality(params: {
  singableLyrics: string;
  asrLyrics: string;
  anchorWords: string[];
  hookLines: string[];
  baseCompareScore: number;
  repeatScore: number;
}): {
  lyricsQualityScore: number;
  anchorRetentionScore: number;
  hookRetentionScore: number;
}
```

### `gateLyricsQuality`

```ts
function gateLyricsQuality(params: {
  lyricsQualityScore: number;
  repeatScore: number;
}): {
  gate: "pass" | "review" | "reject";
  distributionReady: boolean;
  reviewRequired: boolean;
}
```

---

## 実装優先順位

### Phase 1

1. `buildSingableLyrics` を意味保持優先へ改修
2. `anchorWords` / `hookLines` 抽出追加
3. ElevenLabs 拘束強化プロンプト追加
4. `detectRepetition` 追加
5. `mergeLyricsForDisplay` を実際に反映するよう修正
6. `distributionLyrics` を空にできる構造へ変更

### Phase 2

1. `lyricsQualityScore` 統合
2. `gateLyricsQuality` 実装
3. `review_required` ステータス追加
4. 完成画面の品質警告

### Phase 3

1. 自動再生成
2. セクション分割生成
3. 管理レビューUI
4. 配信用確定フロー

---

## 実装上の注意

- 既存構造を壊さないこと
- 現行の completed 乱発を止めること
- `distributionReady=false` の時は、表向き completed でも配信用には使えない状態を明示すること
- `masterLyrics` 固定返却をやめること
- Chorus の自然な反復だけは許容し、それ以外を厳しく罰すること
- 再生成は最大1回までに制限すること
- 失敗しても音源自体は保存するが、品質ラベルで明確に区別すること

---

## 完了条件

以下を満たしたら完了。

1. `buildSingableLyrics` が意味保持優先に変わっている
2. ElevenLabs に hookLines / anchorWords を活用した拘束強化プロンプトを渡している
3. ASR後に反復検知が走る
4. `lyricsQualityScore` と `repeatScore` が保存される
5. `displayLyrics` / `distributionLyrics` が master 固定ではなくなる
6. 低品質曲は `distributionReady=false` か `review_required` になる
7. 明らかな反復曲は自動再生成候補になる
8. 配信提出前に危険曲を機械的にふるい落とせる