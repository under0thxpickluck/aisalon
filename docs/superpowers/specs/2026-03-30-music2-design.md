# 音楽生成NEW（/music2）システム仕様書

**作成日:** 2026-03-30
**対象バージョン:** commit 5501e2f 時点

---

## 1. 概要

`/music2` は LIFAI の AI 音楽生成機能。ユーザーが「テーマ・ジャンル・雰囲気」を選択するだけで、楽曲構成の生成→確認→音声生成→後加工→ASR歌詞検証 の一連のパイプラインを経て、完成したMP3と歌詞を出力する。

**技術スタック:**
- フロントエンド: Next.js 14 App Router（`app/music2/page.tsx`）
- 構成/歌詞生成: OpenAI gpt-4o-mini
- 音楽生成: ElevenLabs music_v1
- 音声書き起こし: ElevenLabs Scribe (scribe_v1)
- 後加工: FFmpeg（EQ/コンプ/リバーブ/ラウドネス正規化）
- ストレージ: Cloudflare R2
- ジョブ永続化: Google Apps Script + Google Sheets（`song_jobs` シート）
- 課金: BP（ブランドポイント）システム

---

## 2. ユーザーフロー（4ステップ）

```
Step 0: 入力フォーム
  → Step 1: 構成確認
    → Step 2: 音楽生成中（ポーリング）
      → Step 3: 完成
```

### Step 0: 入力フォーム

ユーザーが選択する項目:

| 項目 | 種別 | 制約 |
|------|------|------|
| テーマ | テキスト入力 | 必須・任意文字列 |
| ジャンル | 単一選択チップ | 必須・10択 |
| 雰囲気 | 複数選択チップ | 必須・8択・複数可 |
| BPM目安 | 単一選択チップ | 任意・Proのみ表示 |
| ボーカルスタイル | 単一選択チップ | 任意・Proのみ表示 |
| ボーカルムード | 単一選択チップ | 任意・Proのみ表示 |

**定数:**

```
GENRES = [ポップ, ロック, ジャズ, クラシック, EDM, ヒップホップ, R&B, アニメ, ローファイ, シネマティック]
MOODS  = [さわやか, クール, エモい, 明るい, 落ち着いた, ロマンチック,激しい, 切ない]

BPM_OPTIONS = [
  スロー (60-80)      → 70
  ミディアム (90-110) → 100
  アップテンポ (120-140) → 130
  激速 (150+)         → 160
]

VOCAL_STYLES = [女性ボーカル, 男性ボーカル, 混声, ボーカルなし]
VOCAL_MOODS  = [甘い, クール, パワフル, ウィスパー, エモーショナル]
```

**Proモード判定:** `plan ∈ ["500", "1000"]` のとき `isPro = true`。Pro設定UIが表示される。

**生成ボタン有効条件:** `theme.trim() ≠ "" && genre ≠ "" && selectedMoods.length > 0 && !loading && !planLoading`

**BP消費:** 100 BP（`BP_COSTS.music_full`）

### Step 1: 構成確認

`/api/song/start` の同期レスポンスとして受け取った `structureData` を表示。

| 表示項目 | フィールド |
|----------|-----------|
| タイトル | `structureData.title` |
| BPM | `structureData.bpm` |
| Key | `structureData.key` |
| セクション構成 | `structureData.sections[]` |
| サビのポイント | `structureData.hookSummary` |

操作:
- **「これで曲を作る」** → `/api/song/approve-structure` を呼び出しStep 2へ
- **「作り直す」** → Step 0に戻る（BPは消費済み・ジョブは残る）
- **「キャンセル」** → `/api/song/cancel` でBP払い戻し後Step 0へ

### Step 2: 生成中（ポーリング）

- 3秒間隔で `/api/song/status?jobId=` をポーリング
- 最大200tick = 最大10分
- progress計算: `min(90, 5 + ticks * 0.425)`（完了で100%に跳ね上がり）
- 100tick目に「時間がかかっています」の案内メッセージ表示
- `data.stageLabel` をプログレスバーラベルに表示

### Step 3: 完成

- オーディオプレイヤー（`<audio controls>`）
- MP3ダウンロードボタン
- もう1曲作るボタン（全リセット）
- リリースガイドリンク（`/music-release-guide`）
- 売却申請リンク（`/apply-sell`）
- 歌詞ダウンロード（表示用 / 配信用）
  - 配信用: `distributionReady=true` のとき紫カラー、`false` のとき「要確認」表示

**ローカル履歴保存（localStorage）:**

```
Key: lifai_music2_history_v1
最大: 5件（古いものから削除）
フィールド: { jobId, title, audioUrl, downloadUrl, lyrics, createdAt }
```

---

## 3. APIエンドポイント

### 3.1 `POST /api/song/start`

**役割:** BP消費 → 楽曲構成＆歌詞の同期生成

**リクエスト:**
```typescript
{
  id: string          // ユーザーID
  code: string        // 認証コード
  theme: string       // テーマ
  genre: string       // ジャンル
  mood: string        // 雰囲気（"さわやか・ロマンチック" のように結合）
  isPro?: boolean
  bpmHint?: number    // Proのみ
  vocalStyle?: string // Proのみ
  vocalMood?: string  // Proのみ
  language?: string   // デフォルト "ja"
}
```

**レスポンス:**
```typescript
{
  ok: boolean
  jobId: string
  status: "structure_ready" | "failed"
  structureData: {
    bpm: number
    key: string
    sections: string[]
    hookSummary: string
    title: string
  }
}
```

**処理フロー:**
1. 認証・バリデーション
2. GAS経由でBP残高確認（`get_balance`）
3. 100BP以上なければエラー（`insufficient_bp`）
4. GAS経由でBP消費（`deduct_bp`）
5. `song_YYYYMMDD_XXXXXX` 形式でjobId生成
6. GASにジョブ作成（`create_music_job`）
7. OpenAI で構成＋master_lyrics生成（40秒タイムアウト）
8. `buildSingableLyrics` で singable_lyrics生成（25秒タイムアウト）
9. displayLyrics・distributionLyricsを `masterLyrics` で初期化
10. structureDataを返す

**OpenAI プロンプト（gpt-4o-mini / max_tokens: 1500）:**

JSON形式で以下を返させる:
```json
{
  "bpm": 数値,
  "key": "C major 等",
  "sections": ["Intro", "Verse", "Chorus", ...],
  "hookSummary": "サビの一行要約",
  "title": "曲タイトル",
  "lyrics": "[Verse A]\n...\n[Chorus]\n... 形式・最大40行・1行20文字以内"
}
```

Proモード時はプロンプトに追加:
```
BPM目安：{bpmHint or "自由"}
ボーカルスタイル：{vocalStyle or "指定なし"}
ボーカルムード：{vocalMood or "指定なし"}
言語：{language or "日本語"}
※Proモード：歌詞は歌唱表現に優れた自然な日本語を使い、1行12〜16音節に収めてください。
```

**エラーコード:**
| code | HTTP | 意味 |
|------|------|------|
| `auth_required` | 401 | id/code未指定 |
| `theme_genre_mood_required` | 400 | 必須パラメータ不足 |
| `insufficient_bp` | 400 | BP不足 |
| `gas_env_missing` | 500 | 環境変数なし |
| `openai_key_missing` | 500 | OpenAI APIキーなし |

---

### 3.2 `POST /api/song/approve-structure`

**役割:** 4フェーズの音声生成パイプライン（maxDuration: 300秒）

**リクエスト:**
```typescript
{ jobId: string, approved: true }
```

**レスポンス:**
```typescript
{ ok: boolean, status: JobStatus }
```

**パイプライン（全フェーズ）:**

#### Phase 1: ElevenLabs 音声生成
- status: `generating_audio`
- `singableLyrics` があれば `lyricsMode: "manual"` で渡す
- 構成プリセット選択:

```
isPro:
  /激しい|明るい|さわやか/ → "upbeat"
  /ロマンチック|切ない|エモい/ → "ballad"
  /クール|落ち着いた/ → "cinematic"
  その他 → "short_pop"
!isPro → "hook_only"
```

- durationTargetSec: Pro=180秒、Standard=150秒
- raw audio を tmpファイル保存 → R2アップロード

#### Phase 2: 後加工（postprocessing）
- status: `postprocessing`
- `choosePostprocessPreset(genre, mood)` でプリセット選択
- FFmpegで EQ / コンプレッション / リバーブ / ラウドネス正規化
- 分析メトリクス取得: `finalLufs`, `finalPeakDb`
- final audio → R2アップロード
- analysis.json → R2アップロード（失敗は無視）

**後加工フォールバック:** 失敗時は raw audio で完了

#### Phase 3: R2保存完了
- status: `uploading_result`
- `processedAudioUrl` に finalUrl を保存

#### Phase 4: ASR書き起こし（transcribing_lyrics）
- status: `transcribing_lyrics`
- `finalUrl ?? rawUrl` を使用
- ElevenLabs Scribe API (`POST /v1/speech-to-text`) で音声→テキスト
- パラメータ: `model_id: "scribe_v1"`, `timestamps_granularity: "word"`, `language_code: "ja"`
- 60秒タイムアウト
- 単語タイムスタンプを最大1000件に制限

#### Phase 5: 歌詞マージ（merging_lyrics）
- status: `merging_lyrics`
- `compareLyrics(singable, asr)` でスコア算出
- `mergeLyricsForDisplay(singable, asr, score)` で配信可否判定
- `displayLyrics` / `distributionLyrics` は常に `masterLyrics` を使用
- スコア・差分JSON・lyricsSource をジョブに保存

**ASRフォールバック:** 失敗時は `distributionReady: false`, `lyricsReviewRequired: true` でsilent fall-through

#### 最終: completed
- audioUrl には `processedAudioUrl → rawAudioUrl` の順で優先設定
- rightsLog更新

---

### 3.3 `GET /api/song/status`

**パラメータ:** `?jobId=string`

**レスポンス:**
```typescript
{
  ok: boolean
  jobId: string
  status: JobStatus
  progress: number      // 0-100
  stageLabel: string    // 日本語ラベル
  postprocessStatus?: string
  bpLocked: number
  bpFinal: number
}
```

**ステータス→進捗テーブル:**

| status | progress | stageLabel |
|--------|----------|-----------|
| queued | 3 | 準備中… |
| structure_generating | 35 | 楽曲構成を考えています |
| structure_ready | 45 | 構成が決まりました |
| generating_audio | 65 | 音楽を生成しています |
| postprocessing | 88 | 音質を自然に整えています |
| uploading_result | 93 | 最終データを保存しています |
| transcribing_lyrics | 96 | 歌詞を確認しています |
| merging_lyrics | 98 | 歌詞のずれを補正しています |
| completed | 100 | 完成しました |
| failed | 100 | 生成に失敗しました |
| cancelled | 100 | キャンセルされました |

---

### 3.4 `GET /api/song/result`

**パラメータ:** `?jobId=string`

**レスポンス:**
```typescript
{
  ok: boolean
  jobId: string
  title: string
  audioUrl: string              // processedAudioUrl > rawAudioUrl > audioUrl
  downloadUrl: string
  rawAudioUrl?: string
  processedAudioUrl?: string
  usedFallback: boolean
  usedBp: number                // 100
  lyrics: string                // displayLyricsのエイリアス（後方互換）
  displayLyrics: string         // ユーザー表示用（masterLyrics）
  distributionLyrics: string    // 配信提出用（masterLyrics）
  masterLyrics?: string
  singableLyrics?: string
  lyricsMatchScore?: number     // 0-100
  lyricsReviewRequired?: boolean
  distributionReady?: boolean
  lyricsSource?: string
  asrStatus?: string
  postprocessPreset?: string
  postprocessVersion?: string
  finalLufs?: number
  finalPeakDb?: number
}
```

**注意:** `status !== "completed"` のジョブは `ok: false` を返す。

---

### 3.5 `POST /api/song/cancel`

**リクエスト:** `{ jobId: string }`

**BP払い戻し規定:**

| status | 払い戻し率 | 払い戻し額 |
|--------|-----------|-----------|
| lyrics_generating / lyrics_ready | 100% | 100 BP |
| structure_generating / structure_ready | 70% | 70 BP |
| audio_generating / generating_audio | 30% | 30 BP |
| それ以外 | 0% | 0 BP |

---

## 4. ジョブストア（`_jobStore.ts`）

**バックエンド:** GAS + Google Sheets（`song_jobs` シート）

### JobStatus 型
```typescript
type JobStatus =
  | "queued"
  | "lyrics_generating" | "lyrics_ready"
  | "structure_generating" | "structure_ready"
  | "audio_generating"          // 旧ステータス（後方互換）
  | "generating_audio"          // ElevenLabs生成中
  | "postprocessing"
  | "uploading_result"
  | "transcribing_lyrics"       // Phase 2
  | "merging_lyrics"            // Phase 2
  | "review_required"
  | "completed" | "failed" | "cancelled"
```

### SongJob の主要フィールド

**入力:**
```
prompt.theme, genre, mood, language, isPro
prompt.bpmHint, vocalStyle, vocalMood        ← Proのみ
```

**生成結果:**
```
structureData: { bpm, key, sections, hookSummary, title }
masterLyrics          OpenAI生成の自然な日本語歌詞
singableLyrics        ElevenLabs向け発音最適化版（ひらがな等）
asrLyrics             ElevenLabs Scribeによる書き起こし
displayLyrics         ユーザー表示用（= masterLyrics）
distributionLyrics    配信提出用（= masterLyrics）
```

**後加工:**
```
rawAudioUrl           ElevenLabs生成のraw MP3
processedAudioUrl     後加工済みfinal MP3
postprocessStatus     pending / running / done / failed
postprocessPreset, postprocessVersion
finalLufs, finalPeakDb
analysisJson
```

**歌詞品質管理:**
```
lyricsMatchScore      0-100（singable vs ASR一致率）
lyricsDiffJson        4軸スコアの内訳JSON
lyricsTimestampsJson  単語レベルタイムスタンプ（最大1000件）
lyricsReviewRequired  true = 人手確認要
distributionReady     true = 配信可
lyricsSource          "master" | "singable" | "asr_merged" | "manual"
asrStatus             pending / running / done / failed
asrError, asrStartedAt, asrCompletedAt
```

**課金:**
```
bpLocked    消費BP（生成開始時）
bpFinal     最終確定BP（= 100）
```

---

## 5. 歌詞パイプライン詳細

### 5.1 歌詞の種類と用途

```
master_lyrics      → OpenAI生成。自然な日本語（漢字・かな混じり）
                     ユーザーへの表示・配信提出に使用

singable_lyrics    → masterをElevenLabs向けに発音最適化
                     ひらがな化・音節調整済み
                     ElevenLabsへの送信専用（外部には出さない）

asr_lyrics         → ElevenLabsが実際に歌った内容をScribeで書き起こし
                     singable vs ASR の一致率計算に使用

display_lyrics     → ユーザー表示用最終版（= masterLyrics）
distribution_lyrics→ 配信提出用最終版（= masterLyrics）
```

### 5.2 singable_lyrics生成ルール（`buildSingableLyrics`）

OpenAI gpt-4o-mini で以下の変換を適用:
1. 促音（っ）・長音（ー）の多用を避ける
2. 複雑な漢字熟語 → ひらがな/カタカナ
3. 1行あたり12〜16音節（BPM合わせ）
4. 子音連続を避け母音終わり音節を優先
5. セクション構造 `[Verse]` 等は必ず保持
6. 意味より発音を優先
7. タイムアウト: 25秒、失敗時は masterLyrics をそのまま使用

### 5.3 一致率スコアリング（`compareLyrics`）

**前処理（`normalizeLyricsForCompare`）:**
1. セクションタグ `[Verse]` 等を除去
2. 全角英数→半角、全角スペース→半角
3. 小文字化
4. 句読点・記号除去（。、！？!?,.など）
5. 連続空白・改行を単一スペースに
6. trim

**4軸スコアリング（各25点満点、合計100点）:**

| 軸 | 手法 | 計算式 |
|----|------|--------|
| Axis1: 文字レベル | bigram Jaccard類似度 | intersection / union × 25 |
| Axis2: 行一致率 | 正規化後の行集合比較 | 一致行数 / max(行数) × 25 |
| Axis3: 単語一致率 | 頻度マップ比較 | min頻度合計 / max(単語数) × 25 |
| Axis4: 順序保持率 | LCS（最長共通部分列） | LCS長 / max(単語数) × 25 |

**外部ライブラリ不使用（純粋TS実装）**

### 5.4 スコア閾値と配信可否（`mergeLyricsForDisplay`）

| スコア | reviewRequired | distributionReady | lyricsSource |
|--------|---------------|-------------------|--------------|
| ≥ 95 | false | **true** | singable |
| 85〜94 | false | **true** | singable |
| 70〜84 | **true** | false | asr_merged |
| < 70 | **true** | false | singable |

**注意:** `displayLyrics` / `distributionLyrics` にはスコアによらず常に `masterLyrics` を使用する。スコアは `distributionReady` の判定にのみ使う。

---

## 6. ElevenLabsプロバイダー

### エンドポイント
`POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128`

### プロンプト構築

**Standardモード（`buildElevenLabsPrompt`）:**
- ジャンル・雰囲気・テーマ・BPM・Key
- ボーカル指定: "vocal song, Asian female vocal, warm and natural voice, melodic singing style"
- 品質指定: "low noise, clear mix, studio quality"
- 構成プリセット名

**Proモード（`buildElevenLabsProPrompt`）:**
- 詳細なジャンル英語マッピング（J-Pop → "modern Japanese pop music" 等）
- 詳細なムード英語マッピング
- 高品質ボーカル指定: "professional Japanese female vocalist, clear and expressive singing, warm timbre, precise intonation, emotional delivery with natural vibrato, studio vocal recording quality"
- 高品質音質指定: "professional studio production, crystal clear mix, well-balanced frequency spectrum..."
- 詳細な楽曲構成（バー数指定）

---

## 7. 共通コンポーネント（AppSidebar）

`/components/AppSidebar.tsx` は `/music2` ほか各ページで共有するサイドバー。

**表示内容:**
1. **残高カード** - BP / EP をバッジ表示（`/api/wallet/balance` を useEffect で取得）
2. **ナビゲーション** - 5つのリンク（ホーム/音楽生成NEW/BGM生成/団子占い/マーケット）
3. **最近の曲** - localStorage の履歴（最大5件）
   - 曲名・日時・audioプレイヤー・MP3/歌詞ダウンロードボタン

**レスポンシブ:**
- デスクトップ (`lg:`)：常時表示（`hidden lg:block`）
- モバイル：折りたたみアコーディオン（`lg:hidden`）

**使用例（music2/page.tsx）:**
```tsx
<AppSidebar musicHistory={history} activePage="/music2" />
```

---

## 8. タイムアウト・制限値一覧

| 項目 | 値 | 備考 |
|------|----|------|
| API maxDuration (start) | 60秒 | Vercel Function |
| API maxDuration (approve-structure) | 300秒 | Vercel Function |
| OpenAI タイムアウト（構成生成） | 40秒 | AbortController |
| singableLyrics タイムアウト | 25秒 | AbortController |
| ASR タイムアウト | 60秒 | AbortController |
| ポーリング間隔 | 3秒 | setTimeout |
| ポーリング最大tick | 200 | 600秒 = 10分 |
| ポーリング情報表示tick | 100 | 300秒で"時間がかかっています" |
| 単語タイムスタンプ上限 | 1000件 | GAS Sheetsセル上限対策 |
| 履歴最大件数 | 5件 | localStorage |
| BP消費 | 100 BP | music_full |

---

## 9. エラーハンドリング・フォールバック

| フェーズ | 失敗時の挙動 |
|----------|-------------|
| 構成/歌詞生成失敗 | status: "failed"、ユーザーにエラー表示 |
| BP不足 | status: 400 insufficient_bp、生成せず |
| ElevenLabs生成失敗 | status: "failed"、audio_generation_failedエラー |
| 後加工失敗 | raw audioで完了（postprocessStatus: "failed"、フォールバック） |
| R2アップロード失敗 | rawAudioUrlで完了 |
| ASR失敗 | singable_lyricsを使用、distributionReady: false（silent fall-through） |
| ASR用音声URL不明 | ASRスキップ、asrError: "no_audio_url" |
| OpenAI singable変換失敗 | masterLyricsをそのままsingableとして使用 |

---

## 10. 関連ファイル一覧

| ファイル | 役割 |
|---------|------|
| `app/music2/page.tsx` | フロントエンド UI（4ステップワークフロー） |
| `app/api/song/start/route.ts` | BP消費・構成/歌詞生成 |
| `app/api/song/approve-structure/route.ts` | 音声生成パイプライン（4フェーズ） |
| `app/api/song/status/route.ts` | 進捗ポーリング |
| `app/api/song/result/route.ts` | 完成データ取得 |
| `app/api/song/cancel/route.ts` | キャンセル・BP払い戻し |
| `app/api/song/_jobStore.ts` | ジョブCRUD（GASバックエンド） |
| `app/features/music/providers/elevenlabsProvider.ts` | ElevenLabs API統合 |
| `lib/music/lyrics-singable.ts` | master → singable変換 |
| `lib/music/asr.ts` | ElevenLabs Scribe ASR |
| `lib/music/lyrics-compare.ts` | 4軸スコアリング |
| `lib/music/lyrics-merge.ts` | 配信可否判定ロジック |
| `lib/music/lyrics-normalize.ts` | 比較用テキスト正規化 |
| `lib/music/postprocess.ts` | FFmpeg後加工 |
| `lib/music/storage.ts` | R2アップロード |
| `components/AppSidebar.tsx` | 共通サイドバー |
| `app/lib/bp-config.ts` | BP費用・プラン定数 |
| `gas/Code.gs` | GAS: song_jobsシート管理 |
