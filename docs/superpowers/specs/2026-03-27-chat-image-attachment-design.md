# Design Spec: チャット画像添付機能

**Date:** 2026-03-27
**Status:** Approved

## Overview

`/chat` ページのリファ猫チャットに画像添付機能を追加する。1メッセージにつき最大3枚の画像を添付してAIに送信できる。バックエンドはOpenAI gpt-4o-miniのvision機能を使用する。外部ストレージは使用せず、base64エンコードでJSONに含めて送信する。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `app/chat/page.tsx` | 画像添付UI追加（クリップボタン・サムネイルプレビュー・送信ロジック） |
| `app/api/cat-chat/route.ts` | `images` フィールド受け取り・OpenAI content配列形式対応 |

---

## 1. フロントエンド (`app/chat/page.tsx`)

### 状態追加

```typescript
const [attachedImages, setAttachedImages] = useState<string[]>([]); // base64 data URLs, max 3
const fileInputRef = useRef<HTMLInputElement>(null);
```

### 添付UI

- 入力エリア左端にクリップアイコンボタン（📎）を追加
- クリックで非表示 `<input type="file" accept="image/*" multiple ref={fileInputRef}>` をトリガー
- 選択後、FileReaderでbase64変換して `attachedImages` に追加（3枚上限チェック）
- 既に3枚ある場合は追加しない

### サムネイルプレビュー

- `attachedImages.length > 0` のとき、入力ボックスの上にサムネイル行を表示
- 各サムネイル: `<img>` (40×40px, rounded) + 右上に × ボタン
- × ボタンクリックで該当画像を `attachedImages` から削除

### 送信ロジック変更

```typescript
// handleSend内
const res = await fetch("/api/cat-chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: text,
    history: updatedMessages.slice(-10),
    images: attachedImages, // 追加
  }),
});
// 送信後にattachedImagesをクリア
setAttachedImages([]);
```

### メッセージ表示

- ユーザーメッセージバブルに添付画像がある場合、テキストの上に画像を表示（最大幅200px, rounded）
- `Message` 型に `images?: string[]` を追加してバブルに紐付ける

### ファイルサイズ制限

- 1ファイルあたり4MB超の場合は添付をスキップ（アラートなし、単に無視）

---

## 2. APIルート (`app/api/cat-chat/route.ts`)

### リクエスト変更

```typescript
const { message, history, images } = await req.json();
// images: string[] | undefined — base64 data URLs
```

### OpenAIへのメッセージ構築

画像がある場合、ユーザーメッセージの `content` を配列形式にする：

```typescript
const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [];

if (images?.length) {
  for (const img of images.slice(0, 3)) {
    userContent.push({ type: "image_url", image_url: { url: img, detail: "auto" } });
  }
}
userContent.push({ type: "text", text: message });

const userMessage = { role: "user" as const, content: userContent };
```

画像がない場合は従来通りの文字列 `content` を使用：

```typescript
const userMessage = { role: "user" as const, content: message };
```

### 履歴の扱い

会話履歴（`history`）に含まれる過去メッセージは画像を含まずテキストのみで送信する（既存の `history` マッピングロジックを変更しない）。画像は現在のメッセージのみに付与される。

### キャッシュ

画像付きメッセージはキャッシュしない（`images?.length` がある場合はキャッシュスキップ）。

---

## エラーハンドリング

- 4MB超の画像: クライアントサイドで**意図的に**無視（アラートなし・追加しない）。ユーザーには何も通知しない設計。
- 3枚超の選択: 最初の3枚のみ使用
- テキストなし・画像のみのメッセージ: 送信不可（テキスト入力は必須。送信ボタンは `!input.trim()` のとき disabled のまま）
- API失敗時: 既存のエラーハンドリングがそのまま適用される

## 制約・注意点

- gpt-4o-miniはvision対応済み（`detail: "auto"` で自動最適化）
- App Router の Route Handler はリクエストボディをストリームで受け取るため、Pages Routerの `bodyParser` 設定は不要。ただし実際のVercelデプロイでは関数のメモリ・タイムアウトに影響する可能性あり（3枚×4MB = 最大12MB）
