# narasu代理申請 音楽URL曲名自動取得 設計書

Date: 2026-06-04

## 概要

narasu代理申請フォームで音楽URLを貼り付けると、LIFAIの `music_history` から曲名を自動取得して入力欄に補完する機能。見つからない場合は手入力にフォールバック。

## データモデル変更

### `AudioUrlEntry`（lib/narasu-agency/types.ts）

```ts
// before
type AudioUrlEntry = { id: string; url: string }

// after
type AudioUrlEntry = { id: string; url: string; title: string }
```

### GAS narasu_agency シート

`audio_urls`（改行区切りURL）と並行して `audio_titles`（改行区切り曲名）列を追加。
インデックスが対応：`audio_urls` の N 行目の URL が `audio_titles` の N 行目の曲名を持つ。

## APIルート

### `POST /api/narasu-agency/resolve-title`

**リクエスト**
```json
{ "url": "https://pub-xxx.r2.dev/songs/song_xxx/final.wav", "loginId": "user123" }
```

**処理**
1. GAS `music_history_list` を `loginId` で呼び出す
2. `audio_url` または `download_url` フィールドが一致するエントリを検索
3. 一致すれば `title` を返す

**レスポンス**
```json
{ "ok": true, "title": "曲名" }       // 見つかった場合
{ "ok": true, "title": null }          // 見つからない場合
```

## フォームUI（app/narasu-agency/form/page.tsx）

- 各URL行の下に「曲名」テキスト入力欄を追加
- URL input の `onBlur` で `/api/narasu-agency/resolve-title` を呼び出す
- 取得中はスピナー表示
- 取得成功時は title 欄に自動入力（編集可能）
- 取得失敗・未ヒット時は空欄のまま手入力

## confirm画面（app/narasu-agency/confirm/page.tsx）

各URL行に対応する曲名を表示（曲名が空の場合は「（タイトル未入力）」と表示）

## submit route（app/api/narasu-agency/submit/route.ts）

`audio_titles` フィールドを追加（改行区切りの曲名文字列）として GAS に送信。

## GAS（gas/Code.gs）

- `narasu_agency_submit` ハンドラに `audio_titles` カラムを追加
- 新規シートのヘッダーに追加
- 既存シートのマイグレーション対象に追加
- `newRow` への書き込みに追加

## エラーハンドリング

- resolve-title APIのタイムアウト・エラーは無視してフォームをブロックしない
- 曲名は任意項目（バリデーション不要）
