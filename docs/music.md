# 音楽生成フロー（music2 / ElevenLabs版）

> `app/music2/page.tsx` を起点とする現行フロー。旧フロー（Replicate版）は末尾に記載。

---

## 概要

```
ユーザー入力
  → OpenAI で構成・歌詞生成
  → ユーザーが構成を確認・承認
  → ElevenLabs で音声生成（最大2回）
  → ffmpeg で後処理（EQ / Comp / Loudness）
  → Whisper ASR で歌詞書き起こし
  → 品質チェック → completed / review_required
  → Cloudflare R2 に保存 → ユーザーへ返却
```

---

## ステップ詳細

### Step 0 — 入力フォーム（クライアント）

| 項目 | 内容 |
|---|---|
| テーマ | 自由テキスト |
| ジャンル | ポップ / ロック / ジャズ / クラシック / EDM / ヒップホップ / R&B / アニメ / ローファイ / シネマティック |
| 雰囲気 | さわやか / クール / エモい / 明るい / 落ち着いた / ロマンチック / 激しい / 切ない（複数可） |
| Pro専用 | BPMヒント / ボーカルスタイル / ボーカルムード |

Proモード判定: ユーザーのプラン番号が `["500", "1000"]` に含まれる場合。

---

### Step 1 — 構成・歌詞生成 `POST /api/song/start`

**ファイル**: `app/api/song/start/route.ts`

1. **BP残高確認** → `GAS action: get_balance`
2. **BP引落** → `GAS action: deduct_bp`（`BP_COSTS.music_full` 分）
3. **ジョブ作成** → GAS `song_jobs` シートに保存（`_jobStore.ts`）
4. **OpenAI `gpt-4o-mini`** で構成＋歌詞を JSON 一括生成（タイムアウト: 40秒）
   - 出力: `bpm`, `key`, `sections`, `hookSummary`, `title`, `lyrics`
5. **歌唱用歌詞（singableLyrics）生成** → `buildSingableLyrics()` で歌いやすい形式に変換
6. **anchorWords / hookLines 抽出** → ElevenLabs プロンプトに埋め込む拘束キーワード

ジョブステータス: `queued` → `structure_ready`

レスポンス: `{ ok, jobId, status: "structure_ready", structureData }`

---

### Step 2 — 構成確認（クライアント）

`GET /api/song/structure?jobId=...` でBPM・キー・セクション・サビ要約・タイトルを表示。  
ユーザーが「生成開始」または「作り直す」を選択。

---

### Step 3 — 音声生成パイプライン `POST /api/song/approve-structure`

**ファイル**: `app/api/song/approve-structure/route.ts`  
`maxDuration: 300`（5分）

#### Phase 1: ElevenLabs 音声生成

- **プロバイダー**: `ElevenLabsProvider` (`app/features/music/providers/elevenlabsProvider.ts`)
- **API**: `POST https://api.elevenlabs.io/v1/music?output_format=pcm_44100`
- **モデル**: `music_v1`
- **出力**: 生PCM（44100Hz / stereo / 16-bit）→ RIFF/WAV ヘッダーを付与して ArrayBuffer に変換
- **プロンプト構築**:
  - Standard: `buildElevenLabsPrompt()` — ジャンル・ムード・ボーカルスタイル・BPM・Key・構成プリセット
  - Pro: `buildElevenLabsProPrompt()` — より詳細な英語表現にマッピング
- **歌詞付与**: `singableLyrics` がある場合 `lyricsMode: "manual"` で渡す
- **拘束プロンプト**: `anchorWords` / `hookLines` / `maxChorusRepeats` で歌詞の内容を固定
- **尺**: Standard=150秒 / Pro=180秒

raw WAV を Cloudflare R2 `songs/{jobId}/raw.wav` に保存。

ジョブステータス: `generating_audio`

#### Phase 2: 後処理（postprocess）

- **ファイル**: `lib/music/postprocess.ts`
- ffmpeg で EQ・コンプレッサー・リバーブ・ラウドネス正規化を実行
- プリセット選択: `choosePostprocessPreset()` がジャンル・ムードから自動選択
- 後処理済み WAV を R2 `songs/{jobId}/final.wav` に保存
- `analysis.json` も R2 に保存（LUFS・Peak dB など）

ジョブステータス: `postprocessing` → `uploading_result`

#### Phase 3: ASR（歌詞書き起こし）

- **ファイル**: `lib/music/asr.ts`
- OpenAI Whisper API で音声から歌詞を自動書き起こし

ジョブステータス: `transcribing_lyrics`

#### Phase 4: 歌詞マージ・品質チェック

| モジュール | 役割 |
|---|---|
| `lyrics-compare.ts` | singableLyrics ↔ ASR歌詞 の一致率スコア |
| `lyrics-merge.ts` | 表示用・配信用歌詞を合成 |
| `lyrics-repeat.ts` | サビ反復の過剰検知 |
| `lyrics-quality.ts` | 総合品質スコア（0〜100）算出 |
| `lyrics-gate.ts` | `pass` / `review` / `reject` 判定 |

ジョブステータス: `merging_lyrics` → `quality_checking`

#### Phase 5: 自動再生成（条件付き）

- 品質スコア < 65 **または** 反復スコア ≥ 60 の場合、Attempt 2 を実行
- Attempt 2 は `maxChorusRepeats: 1`（反復制限を強化）
- Attempt 2 も ASR で品質確認し、良い方を採用

ジョブステータス: `regenerating_audio`

#### Phase 6: 完了判定

| 条件 | ステータス |
|---|---|
| 音源あり ＋ gate が `pass` か `review` | `completed` |
| それ以外 | `review_required` |

---

### Step 4 — 結果取得（クライアント）

ポーリング: `GET /api/song/status?jobId=...`（3秒間隔、最大200回 = 10分）

完了後: `GET /api/song/result?jobId=...`

返却データ:
- `audioUrl` — 再生・試聴用（processed優先、fallbackはraw）
- `downloadUrl` — DL用（同上）
- `displayLyrics` — 表示用歌詞（ASRマージ後）
- `distributionLyrics` — 配信用歌詞
- `lyricsGateResult` — `pass` / `review` / `reject` / `null`
- `lyricsReviewRequired` — 人手確認フラグ
- `generationAttempt` — 1 or 2

---

## ジョブ永続化

**ファイル**: `app/api/song/_jobStore.ts`

GAS の `song_jobs` シートにジョブを保存。Vercel サーバーレスのインスタンス切れ対策。  
`createJob` / `getJob` / `updateJob` が GAS `action: song_job_*` を呼ぶ。

---

## ストレージ（Cloudflare R2）

**ファイル**: `lib/music/storage.ts`

| パス | 内容 |
|---|---|
| `songs/{jobId}/raw.wav` | ElevenLabs 生成の生音源 |
| `songs/{jobId}/final.wav` | 後処理済み音源 |
| `songs/{jobId}/analysis.json` | LUFS・Peak などの音源解析データ |

環境変数: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`

---

## 環境変数（music2関連）

| 変数 | 用途 |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs 音声生成 |
| `OPENAI_API_KEY` | 構成・歌詞生成 (gpt-4o-mini) / ASR (Whisper) |
| `CLOUDFLARE_R2_*` | 音源ファイル保存 |
| `GAS_WEBAPP_URL`, `GAS_API_KEY`, `GAS_ADMIN_KEY` | BP管理・ジョブ永続化 |

---

## 履歴（クライアント）

`localStorage` キー: `lifai_music2_history_v1`  
最大50件 / 31日で自動失効 / URLコピー機能あり

---

## 旧フロー（Replicate版）

**UIページ**: `app/music/` など  
**APIエンドポイント**: `app/api/music/generate/route.ts`, `app/api/music/status/route.ts`

- **モデル**: Replicate `meta/musicgen` (stereo-large, 30秒)
- **フロー**: Verse / Chorus / Bridge を並列で3ジョブ生成 → 外部マージサーバー (`MERGE_SERVER_URL/merge`) で結合
- **歌詞生成**: OpenAI `gpt-4o-mini` で事前生成（非致命的、失敗しても続行）
- **音声フォーマット**: MP3
- **ポーリング**: `GET /api/music/status?id=...`（2秒間隔、最大150回 = 5分）

現在は music2（ElevenLabs版）が主系。
