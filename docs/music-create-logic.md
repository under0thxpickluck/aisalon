# Music Create ロジック 詳細仕様

## 概要

音楽生成は **3段階生成（Verse → Chorus → Bridge）+ マージ** 方式で、Replicate APIを使用して楽曲を生成する。OpenAI（gpt-4o-mini）で日本語歌詞を並列生成し、外部マージサーバーで音声ファイルを結合して最終出力を作る。

---

## ファイル構成

```
app/api/music/
├── generate/route.ts   # メイン生成エンドポイント
├── status/route.ts     # ポーリング・ステート管理
├── history/route.ts    # GAS経由の履歴保存・取得
├── download/route.ts   # セキュアなファイルプロキシ
└── _cache.ts           # インメモリキャッシュ・レートリミット

lib/music-download.ts   # ダウンロード・共有ヘルパー
```

---

## 1. 生成リクエスト（POST /api/music/generate）

### リクエストボディ

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `prompt` | string | 必須 | テーマ・ムード（日本語可） |
| `mode` | `"standard"` \| `"pro"` | 必須 | 生成モード |
| `bpm` | number | 120 | テンポ（PROのみ有効） |
| `waveform` | string | `"sine"` | 波形タイプ（PROのみ有効） |
| `vocal` | string | `"none"` | ボーカルスタイル（PROのみ有効） |
| `userId` | string | なし | レートリミット適用用 |

### 処理フロー

```
1. REPLICATE_API_TOKEN 存在確認
2. レートリミットチェック（userId 指定時のみ）
3. prompt バリデーション
4. 歌詞生成（OpenAI gpt-4o-mini、20秒タイムアウト、失敗しても続行）
5. jobId 発行（`music_${Date.now()}`）
6. プロンプト構築（mode に応じて分岐）
7. Replicate 予測を3件並列作成（verse / chorus / bridge）
8. ジョブをキャッシュに保存
9. { ok: true, predictionId: jobId, lyrics } を返す
```

### プロンプト構築

#### STANDARDモード
```
humanizePrompt(prompt)
  + FEMALE_VOCALS_SUFFIX（除外KWなければ）
  + HUMANIZE_SUFFIX
  + セクション固有サフィックス（verse/chorus/bridge）
```

#### PROモード
```
buildProPrompt({ prompt, bpm, waveform, vocal })
  + HUMANIZE_SUFFIX
  + セクション固有サフィックス
```

### humanizePrompt（日本語→英語変換）

| 日本語 | 英語変換 |
|---|---|
| さわやか | refreshing, bright, uplifting |
| 落ち着く | calm, relaxing, ambient |
| 激しい | energetic, intense, driving |
| 悲しい | melancholic, emotional, slow |
| 楽しい | fun, playful, bouncy |
| 集中 | focus, concentration, minimal electronic |
| 眠れる | sleep, gentle, soft ambient |
| ロック | rock, electric guitar, drums |
| ジャズ | jazz, piano, upright bass |
| ポップ | pop, catchy, upbeat |
| （他25種） | ... |

変換後は共通で `, natural feel, humanized rhythm, warm acoustics, professional music production` を付加。

### 女性ボーカル自動付加（STANDARDのみ）

以下キーワードが prompt に**含まれない**場合のみ自動付加：
- `男性` / `インスト` / `ボーカルなし` / `ボーカル無し`

付加内容：
```
female vocals, sung lyrics, lead singer, vocal melody, singing voice,
human performance, natural singing, organic feel, slight timing variations,
expressive dynamics, studio recording
```

### ヒューマナイズサフィックス（両モード共通）

```
avoid quantized beats, slight tempo rubato, breath sounds, natural reverb,
imperfect timing, human-like expression
```

### waveformMap（PROモード）

| waveform | 変換内容 |
|---|---|
| sine | smooth sine-wave synthesizer |
| sawtooth | aggressive sawtooth synth |
| square | retro 8-bit square wave |
| triangle | warm triangle wave pads |
| noise | white noise texture, atmospheric noise layer |
| organic | organic acoustic texture, natural wooden instruments |

### vocalMap（PROモード）

| vocal | 変換内容 |
|---|---|
| none | no vocals, instrumental only |
| pop | pop female vocals, sung lyrics, lead singer... |
| whisper | soft whisper vocals |
| rap | rap vocals, rhythmic flow |
| opera | operatic soprano vocals |

### セクション別サフィックス

| セクション | サフィックス |
|---|---|
| verse | `verse section, melodic introduction, building energy` |
| chorus | `chorus section, hook, emotional peak, same vocalist` |
| bridge | `bridge section, variation, leading to finale, same vocalist` |

共通一貫性サフィックス: `same vocalist, consistent melody, same song, continuous`

### Replicate API（MusicGen）

```
POST https://api.replicate.com/v1/predictions
version: 671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb
input:
  model_version: "stereo-large"
  duration: 30
  output_format: "mp3"
  normalization_strategy: "peak"
```

3セクション（verse/chorus/bridge）を**並列**で Replicate に投げる。

### 歌詞生成（OpenAI）

```
model: gpt-4o-mini
max_tokens: 800
timeout: 20秒

出力フォーマット:
[Verse]
（Aメロ歌詞 4〜6行）

[Chorus]
（サビ歌詞 4〜6行）

[Bridge]
（Bメロ・アウトロ歌詞 4〜6行）
```

歌詞生成が失敗しても音楽生成は続行される（非致命的）。

---

## 2. ステータスポーリング（GET /api/music/status?id=...）

### ステートマシン

```
verse → chorus → bridge → merging → done
                                   ↘ failed
```

| stage | progress | 説明 |
|---|---|---|
| verse | 0.2 | Verse生成中 |
| chorus（verse完了直後） | 0.37 | Chorus移行 |
| chorus | 0.55 | Chorus生成中 |
| bridge（chorus完了直後） | 0.67 | Bridge移行 |
| bridge | 0.75 | Bridge生成中 |
| merging | 0.9 | マージサーバーに送信中 |
| done | 1.0 | 完成 |

### ポーリング時の状態遷移

```
getJob(id) でキャッシュ参照
  ↓
現ステージの predictionId を Replicate でポーリング
  ↓
succeeded → 次ステージへ遷移（URL をキャッシュに保存）
  ↓ bridge 完了時
マージサーバー POST /merge へ送信
  { sections: [verseUrl, chorusUrl, bridgeUrl], job_id }
  ↓
mergeData.url or mergeData.outputUrl を取得
  ↓
done → outputUrl をキャッシュに保存
```

### マージサーバー

- URL: `MERGE_SERVER_URL`（環境変数）
- エンドポイント: `POST /merge`
- ボディ: `{ sections: [string, string, string], job_id: string }`
- レスポンス: `{ url: string }` または `{ outputUrl: string }`

### 後方互換（単一予測ポーリング）

キャッシュに jobId が存在しない場合、旧システムとして Replicate 予測IDで直接ポーリング。

---

## 3. インメモリキャッシュ（_cache.ts）

### 3層構造

| キャッシュ | キー | TTL | 内容 |
|---|---|---|---|
| `cache`（歌詞） | jobId | 2時間 | 歌詞文字列 |
| `jobCache`（ジョブ） | jobId | 4時間 | JobState オブジェクト |
| `rateLimitStore` | userId | 3時間 | 生成回数カウンタ |

### JobState 型

```typescript
type JobState = {
  verseId: string;    // Replicate prediction ID
  chorusId: string;
  bridgeId: string;
  stage: JobStage;    // "verse" | "chorus" | "bridge" | "merging" | "done" | "failed"
  lyrics: string;
  verseUrl?: string;
  chorusUrl?: string;
  bridgeUrl?: string;
  outputUrl?: string; // 最終出力URL
}
```

### レートリミット仕様

- 対象: `userId` が指定されたリクエストのみ
- 制限: **3時間ウィンドウで5回まで**
- ウィンドウは最初のリクエスト時点からスタート（スライディングではなく固定）

---

## 4. 履歴管理（/api/music/history）

### GET（履歴取得）

```
GET /api/music/history?userId=xxx
→ GAS action: music_history_list
→ expires_at > now のみ返却（デフォルト50件）
```

### POST（履歴保存）

```
POST /api/music/history
body: { userId, jobId, title, audioUrl, downloadUrl, lyrics, createdAt, expiresAt }
→ GAS action: music_history_save
→ 同一 jobId は上書き（冪等）
```

TTLは呼び出し元（フロント）が設定する（31日が標準）。

---

## 5. ダウンロード（/api/music/download）

セキュアプロキシ。以下ドメインのURLのみ許可：
- `replicate.delivery`
- `CLOUDFLARE_R2_PUBLIC_URL`（環境変数のドメイン）
- `MERGE_SERVER_URL`（環境変数のドメイン）

`Content-Disposition: attachment; filename*=UTF-8''<encoded>` で日本語ファイル名対応。

---

## 6. フロントエンドのポーリング仕様

### /app/music/standard/page.tsx・/app/music/pro/page.tsx

- 2秒間隔でポーリング
- 最大 MAX_TICKS = 210（= 7分）
- 90%（progress ≥ 0.9）到達でタイムアウト警告を表示
- Replicate API エラー時は最大3回リトライ

### ポーリング進捗表示

| stage レスポンス | 表示 |
|---|---|
| Verse生成中 | Aメロを生成中... |
| Chorus生成中 | サビを生成中... |
| Bridge生成中 | Bメロを生成中... |
| 結合中 | 楽曲を結合中... |
| 完成 | 完成 |

---

## 7. タイムアウト設定

| 場所 | 設定 | 値 |
|---|---|---|
| `generate/route.ts` | `export const maxDuration = 300` | 5分 |
| `status/route.ts` | `export const maxDuration = 300` | 5分 |
| `vercel.json` | `app/api/music/**` | 300秒 |

---

## 8. 環境変数

| 変数名 | 用途 |
|---|---|
| `REPLICATE_API_TOKEN` | MusicGen（音楽生成） |
| `OPENAI_API_KEY` | gpt-4o-mini（歌詞生成） |
| `MERGE_SERVER_URL` | 音声結合サーバーURL |
| `CLOUDFLARE_R2_PUBLIC_URL` | ダウンロード許可ドメイン |
| `GAS_WEBAPP_URL` / `GAS_API_KEY` | 履歴保存（GAS連携） |

---

## 9. データフロー全体図

```
[ユーザー操作]
    ↓ POST /api/music/generate
    
[generate/route.ts]
  ├─ OpenAI gpt-4o-mini → 歌詞生成（並列・非致命的）
  ├─ プロンプト構築（mode別）
  └─ Replicate × 3並列 → verseId, chorusId, bridgeId
        ↓ cacheJob(jobId, {...})
        ↓ return { predictionId: jobId, lyrics }

[フロント: 2秒間隔でポーリング]
    ↓ GET /api/music/status?id=jobId

[status/route.ts]
  ├─ stage=verse:   Replicate polling → 完了したら stage=chorus に遷移
  ├─ stage=chorus:  Replicate polling → 完了したら stage=bridge に遷移
  ├─ stage=bridge:  Replicate polling → 完了したら mergeサーバーに POST
  └─ stage=merging: mergeサーバーのレスポンスを待つ → done + outputUrl

[完成後]
    ↓ POST /api/music/history （GAS経由でSheets保存）
    ↓ GET /api/music/download?url=...（セキュアプロキシでDL）
```

---

## 10. 制限・注意事項

| 項目 | 値・説明 |
|---|---|
| レートリミット | userId毎 3時間に5回まで |
| ジョブTTL | 4時間（キャッシュ消滅後はポーリング不可） |
| 歌詞TTL | 2時間 |
| 音声1セクションあたりの長さ | 30秒 × 3 = 最大90秒（マージ後） |
| Replicate model | `stereo-large`（MusicGen） |
| キャッシュはインメモリ | サーバー再起動でジョブが消える。Vercelのサーバーレス環境ではインスタンス共有不可のため、複数インスタンスにまたがるポーリングはキャッシュミスが起きうる |
| userId なしでの呼び出し | レートリミット適用なし（制限なし） |
