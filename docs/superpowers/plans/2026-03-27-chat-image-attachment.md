# チャット画像添付機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/chat` ページのチャットに最大3枚の画像を添付してgpt-4o-miniのvision機能で解析できるようにする。

**Architecture:** フロントエンドでFileReaderによりbase64エンコードし、既存の `/api/cat-chat` JSONペイロードに `images: string[]` を追加して送信。APIルートでは画像の有無に応じてOpenAIのcontent形式（string vs ContentPart配列）を切り替える。外部ストレージ不使用。

**Tech Stack:** Next.js 14 App Router, React useState/useRef, FileReader API, OpenAI SDK (gpt-4o-mini vision), TypeScript

---

### Task 1: APIルートに画像対応を追加

**Files:**
- Modify: `app/api/cat-chat/route.ts`

**Background:** 現在のルートはテキストのみ受け取る。`images` フィールドを追加し、画像がある場合はOpenAIへ渡すメッセージのcontentを配列形式（ContentPart[]）に変換する。

現在の `route.ts` の構造（59行）：
- `POST` ハンドラーで `{ message, history }` をデストラクト
- `messages` 配列を構築してOpenAIに送信
- インメモリキャッシュあり（`replyCache`）

- [ ] **Step 1: `images` のデストラクトを追加**

`const { message, history } = await req.json();` を以下に変更：

```typescript
const { message, history, images } = await req.json();
// images: string[] | undefined — base64 data URLs (e.g. "data:image/jpeg;base64,...")
```

- [ ] **Step 2: キャッシュ条件に画像チェックを追加**

現在のキャッシュチェック（line 23）：
```typescript
if (!history?.length && replyCache.has(cacheKey)) {
```

を以下に変更：
```typescript
if (!history?.length && !images?.length && replyCache.has(cacheKey)) {
```

下のキャッシュ書き込み（line 45）：
```typescript
if (!history?.length) {
```

を以下に変更：
```typescript
if (!history?.length && !images?.length) {
```

- [ ] **Step 3: ユーザーメッセージのcontent構築ロジックを変更**

現在の `messages` 配列構築の最後の行（`{ role: "user", content: message }`）を削除し、以下のロジックに置き換える。

```typescript
// 画像あり: content配列形式（vision対応）
// 画像なし: 従来通り文字列
let userMessageContent: string | OpenAI.Chat.ChatCompletionContentPart[];
if (images?.length) {
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
  for (const img of images.slice(0, 3)) {
    parts.push({ type: "image_url", image_url: { url: img, detail: "auto" } });
  }
  parts.push({ type: "text", text: message });
  userMessageContent = parts;
} else {
  userMessageContent = message;
}
```

`messages` 配列の末尾に追加：
```typescript
{ role: "user" as const, content: userMessageContent },
```

- [ ] **Step 4: ファイル全体を確認して一貫性をチェック**

`route.ts` を読んで、以下を確認：
- `images` のデストラクトが追加されている
- キャッシュ条件が2箇所とも更新されている
- `userMessageContent` 変数が正しく構築・使用されている
- `OpenAI.Chat.ChatCompletionContentPart[]` 型が使えている（既に `import OpenAI from "openai"` があるため追加import不要）

- [ ] **Step 5: コミット**

```bash
git add app/api/cat-chat/route.ts
git commit -m "feat: cat-chatにvision対応（images配列受け取り）"
```

---

### Task 2: フロントエンドに画像添付UIを追加

**Files:**
- Modify: `app/chat/page.tsx`

**Background:** 現在の `page.tsx` は265行。Message型・状態・handleSend・入力エリアの4箇所を変更する。

- [ ] **Step 1: `Message` 型に `images` を追加**

現在（line 7）：
```typescript
type Message = { id: string; role: "user" | "assistant"; content: string };
```

を以下に変更：
```typescript
type Message = { id: string; role: "user" | "assistant"; content: string; images?: string[] };
```

- [ ] **Step 2: 状態と ref を追加**

`const bottomRef = useRef<HTMLDivElement>(null);` の直後に追加：

```typescript
const [attachedImages, setAttachedImages] = useState<string[]>([]);
const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: 画像選択ハンドラーを追加**

`handleSend` 関数の直前に以下を追加：

```typescript
function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? []);
  // リセット（同じファイルを再選択できるよう）
  e.target.value = "";
  const remaining = 3 - attachedImages.length;
  if (remaining <= 0) return;
  const toAdd = files.slice(0, remaining);
  toAdd.forEach((file) => {
    if (file.size > 4 * 1024 * 1024) return; // 4MB超は無視
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImages((prev) => {
        if (prev.length >= 3) return prev;
        return [...prev, reader.result as string];
      });
    };
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 4: `handleSend` に画像送信とクリアを追加**

`handleSend` 内の `const userMessage` 定義を変更：

現在：
```typescript
const userMessage: Message = { id: `msg-${Date.now()}`, role: "user", content: text };
```

変更後：
```typescript
const currentImages = [...attachedImages];
const userMessage: Message = { id: `msg-${Date.now()}`, role: "user", content: text, images: currentImages.length ? currentImages : undefined };
```

`setMessages(updatedMessages);` の後に追加：
```typescript
setAttachedImages([]);
```

`body: JSON.stringify({...})` のオブジェクトに `images` を追加：

```typescript
body: JSON.stringify({
  message: text,
  history: updatedMessages.slice(-10),
  images: currentImages.length ? currentImages : undefined,
}),
```

- [ ] **Step 5: 入力エリアに添付UIを追加**

入力エリア (`{/* 入力エリア */}`) の `<div className="flex-shrink-0 ...">` の中、`<div className="flex gap-2 items-center rounded-2xl ...">` の直前に、サムネイルプレビューを追加：

```tsx
{/* 添付画像プレビュー */}
{attachedImages.length > 0 && (
  <div className="flex gap-2 flex-wrap mb-2">
    {attachedImages.map((img, i) => (
      <div key={i} className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={`添付画像${i + 1}`}
          width={40}
          height={40}
          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
        />
        <button
          onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))}
          className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-white"
          style={{ background: "rgba(0,0,0,0.7)", fontSize: 10, lineHeight: 1 }}
          aria-label="画像を削除"
        >
          ×
        </button>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 6: 非表示ファイルinputとクリップボタンを追加**

`<input type="text" ...>` の直前に追加：

```tsx
{/* 非表示ファイル選択 */}
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  multiple
  className="hidden"
  onChange={handleFileSelect}
  disabled={isLoading}
/>
{/* クリップボタン */}
<button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={isLoading || attachedImages.length >= 3}
  className="flex-shrink-0 text-base transition-opacity"
  style={{
    color: "rgba(255,255,255,0.4)",
    opacity: isLoading || attachedImages.length >= 3 ? 0.3 : 1,
    cursor: isLoading || attachedImages.length >= 3 ? "not-allowed" : "pointer",
    background: "none",
    border: "none",
    padding: 0,
  }}
  aria-label="画像を添付"
>
  📎
</button>
```

- [ ] **Step 7: ユーザーメッセージバブルに画像表示を追加**

メッセージ一覧のレンダリング部分で、ユーザーバブルの `<div className="rounded-2xl px-4 py-3 ...">` の内部を変更：

現在：
```tsx
{msg.content}
```

変更後：
```tsx
{msg.images?.length ? (
  <div className="flex gap-1 flex-wrap mb-2">
    {msg.images.map((img, i) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={i}
        src={img}
        alt={`画像${i + 1}`}
        style={{ maxWidth: 200, borderRadius: 8, display: "block" }}
      />
    ))}
  </div>
) : null}
{msg.content}
```

- [ ] **Step 8: ページ全体を読んで変更箇所を確認**

`app/chat/page.tsx` を読んで以下を確認：
- `Message` 型に `images?: string[]` がある
- `attachedImages` state と `fileInputRef` がある
- `handleFileSelect` 関数がある
- `handleSend` で `currentImages` を使い、送信後に `setAttachedImages([])` している
- 非表示input・クリップボタン・サムネイルプレビューが入力エリアにある
- ユーザーバブルに画像表示がある

- [ ] **Step 9: コミット**

```bash
git add app/chat/page.tsx
git commit -m "feat: チャットに画像添付UI追加（最大3枚・base64・vision対応）"
```

---

### Task 3: 動作確認とプッシュ

- [ ] **Step 1: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/chat` を開き、以下を手動確認：
- 📎ボタンが表示される
- 画像を選択するとサムネイルが表示される
- ×ボタンで削除できる
- 3枚選択後は📎ボタンがdisabledになる
- テキスト＋画像を送信するとユーザーバブルに画像が表示される
- AIが画像の内容について回答する

- [ ] **Step 2: プッシュ**

```bash
git push origin main
```
