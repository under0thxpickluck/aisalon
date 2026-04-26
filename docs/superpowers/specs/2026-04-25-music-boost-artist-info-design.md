# Music Boost アーティスト情報入力フォーム — 設計書

**作成日**: 2026-04-25  
**対象**: `app/music-boost/page.tsx`, `app/admin/page.tsx`, `app/api/music-boost/info/route.ts`, `gas/Code.gs`

---

## 概要

Music Boost 契約後、ユーザーがブースト対象のアーティスト名と楽曲名を登録・編集できるフォームを追加する。入力内容は GAS の applies シートに保存され、admin ページでリアルタイムに確認できる。

---

## 1. Music Boost ページ（`app/music-boost/page.tsx`）

### レイアウト変更

- ブースト**契約中**（`status?.current_boost` が存在）の場合のみ、ページ全体を 2 カラムに変更
  - `max-w-lg` → `max-w-3xl`、`flex-row` で左右分割
  - **左カラム**: 既存コンテンツ全体（説明・枠状況・現在プラン・プラン一覧・注意書き）
  - **右カラム**: アーティスト情報フォーム（下記）
- 未契約時は従来どおりシングルカラム（`max-w-lg`）

### 右カラム: アーティスト情報フォーム

**表示条件**: ブースト契約中のみ

**入力フィールド**:
- `アーティスト名` — テキスト input（必須）
- `楽曲名` — テキスト input（必須）

**状態管理**（追加 useState）:
- `artist: string` — アーティスト名
- `album: string` — 楽曲名
- `infoSaving: boolean` — 保存中フラグ
- `infoLog: string` — ログメッセージ

**初期値読み込み**:
- ページロード時に `/api/music-boost/info?userId=...` GET で既存値を取得してフォームに表示

**「編集完了」ボタン挙動**:
1. `infoSaving = true`、`infoLog = "変更を保存しています..."` を表示
2. `/api/music-boost/info` PATCH に `{ userId, artist, album }` を送信
3. 成功時: `infoLog = "✅ 保存しました"`
4. 失敗時: `infoLog = "❌ 保存に失敗しました"`
5. 2 秒後に `infoLog` をクリア

### チュートリアル スライド追加

既存 5 枚の末尾（"Music Boostを始める" の直前）に 1 枚追加:

```
icon: "🎵"
title: "配信したい楽曲を登録しよう"
body: "契約後に表示されるフォームから、ブーストしたいアーティスト名と楽曲名を入力できます。\n\n入力内容は運営に即時反映されます。\n\n✏️ いつでも変更可能です\n契約期間中は何度でも楽曲情報を更新できます。"
```

---

## 2. 新規 API: `/api/music-boost/info`

**ファイル**: `app/api/music-boost/info/route.ts`

### GET `?userId=xxx`
- GAS `boost_get_info` アクションを呼び出し
- レスポンス: `{ ok: true, artist: string, album: string }`

### PATCH
- ボディ: `{ userId: string, artist: string, album: string }`
- GAS `boost_update_info` アクションを呼び出し
- レスポンス: `{ ok: true }` or `{ ok: false, error: string }`

認証: `GAS_API_KEY` をクエリパラムとして付与（既存パターンと同様）

---

## 3. GAS: 新規アクション

### `boost_get_info`

- パラメータ: `userId`
- applies シートからユーザー行を検索
- `music_boost_artist` / `music_boost_album` カラムの値を返す
- カラムが存在しない場合は空文字を返す

### `boost_update_info`

- パラメータ: `userId`, `artist`, `album`
- applies シートからユーザー行を検索
- `music_boost_artist` / `music_boost_album` カラムを `ensureCols_` で確保して書き込む
- 成功: `{ ok: true }`、ユーザーが見つからない場合: `{ ok: false, error: "user_not_found" }`

**追加カラム**: `music_boost_artist`, `music_boost_album`（applies シート）

---

## 4. Admin ページ（`app/admin/page.tsx`）

### `MemberRow` 型に追加

```ts
music_boost_artist?: string | null;
music_boost_album?: string | null;
```

### 表示

既存の `music_boost_plan` 表示セル内に追記:
- `music_boost_artist` と `music_boost_album` を小さいテキストで表示
- 両方空の場合は非表示

### データ取得

admin list API（`/api/admin/list`）がこれらフィールドを返すよう GAS の `admin_list` アクションを更新。

---

## 5. データフロー

```
ユーザー入力（music-boost page）
  → PATCH /api/music-boost/info
    → GAS boost_update_info
      → applies シート music_boost_artist / music_boost_album 書き込み

admin page リロード
  → GET /api/admin/list
    → GAS admin_list（music_boost_artist / music_boost_album を含む）
      → admin UI に表示
```

---

## 6. 変更ファイル一覧

| ファイル | 変更種別 |
|---|---|
| `app/music-boost/page.tsx` | 2カラム化・フォーム追加・チュートリアル追記 |
| `app/api/music-boost/info/route.ts` | 新規作成（GET / PATCH） |
| `app/admin/page.tsx` | 型追加・表示追記 |
| `gas/Code.gs` | `boost_get_info` / `boost_update_info` / `admin_list` 更新 |

---

## 7. 非機能要件

- フォームはブースト契約中のみ表示（未契約時は一切表示しない）
- 保存中は「編集完了」ボタンを disabled にして二重送信防止
- admin のリアルタイム反映はページリロードで実現（WebSocket 不要）
