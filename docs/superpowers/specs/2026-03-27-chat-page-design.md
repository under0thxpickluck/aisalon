# Design Spec: リファ猫チャットページ

**Date:** 2026-03-27
**Status:** Approved

## Overview

「相談する」ボタンから遷移するフルページAIチャット画面を新設する。
ChatGPT/GeminiライクなUIで、OpenAI API (`gpt-4o-mini`) を使用。
リファ猫キャラを維持しつつ何でも答えられる汎用AIとして動作する。
履歴はセッション中のみ保持（localStorage保存なし）。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `app/chat/page.tsx` | 新規作成 — フルページチャットUI |
| `app/api/cat-chat/route.ts` | max_tokens拡張・システムプロンプト更新・historyフォーマット変更 |
| `components/LifaiCat.tsx` | 「相談する」ボタンをrouter.pushに変更・インパネルチャット関連コード削除 |

---

## 1. チャットページ (`app/chat/page.tsx`)

### UIレイアウト

- **背景**: `#0A0A0A`（ダーク）
- **ヘッダー（固定）**: 左に「← 戻る」（`router.push('/top')` で遷移）、中央にリファ猫アイコン＋「リファ猫に相談」
- **メッセージエリア**: flex-col、画面いっぱい使用・縦スクロール
  - ユーザーメッセージ: 右寄せ、インディゴ背景バブル
  - 猫メッセージ: 左寄せ、猫アイコン付き、ダークグレーバブル
  - 送信中: 「…」タイピングインジケーター（assistantバブルとして追加）
  - 新メッセージ追加時: 底部アンカー要素に `scrollIntoView` で自動スクロール
- **入力エリア（固定下部）**: `<input type="text">` + 送信ボタン、Enterで送信

### 状態管理

```typescript
type Message = { role: 'user' | 'assistant'; content: string }
const [messages, setMessages] = useState<Message[]>([GREETING])
const [input, setInput] = useState('')
const [isLoading, setIsLoading] = useState(false)
const bottomRef = useRef<HTMLDivElement>(null)
```

### 初期メッセージ（messagesの第1要素としてハードコード）

```typescript
const GREETING: Message = {
  role: 'assistant',
  content: 'やあ！何でも聞いてね。AI・副業・LIFAIのことも、日常のことも答えるよ🐱',
}
```

グリーティングは `messages` 配列の初期値として設定し、APIへのhistoryにも含める（自然な会話文脈として機能する）。

### 自動スクロール

```typescript
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

### LifaiCatウィジェット非表示

`/chat` ページには `LifaiCat` コンポーネントを描画しない（再帰的遷移を防止）。
`LifaiCat` は `/top` ページで直接レンダリングされているため、`/chat` ページには含めるだけでよい。

---

## 2. APIルート (`app/api/cat-chat/route.ts`)

### historyフォーマット変更

現行: `{ from: 'user'|'cat', text: string }[]`
新形式: `{ role: 'user'|'assistant', content: string }[]`

新ページから新形式で送信し、APIルートも新形式で受け取るように更新する。
（LifaiCatのインパネルチャットは同時に削除するため後方互換は不要）

### 変更点まとめ

- `max_tokens`: 150 → 800
- `history` の受け取りフォーマット: `{role, content}` に統一
- システムプロンプト更新
- モデル: `gpt-4o-mini`（変更なし）
- キャッシュ: 既存のインメモリキャッシュロジック維持（デプロイ時に自動クリアされるため問題なし）
- Vercelタイムアウト: gpt-4o-miniは800トークンでも通常3〜5秒以内。デフォルト10s制限で十分。

### 新システムプロンプト

```
あなたは「リファ猫」というAIサロン「LIFAI」のマスコットキャラクターです。
フレンドリーで親しみやすいトーンで、何でも日本語で答えてください。
AI・副業・プログラミング・日常の悩みなど、幅広い質問に対応します。
LIFAIの機能（団子占い・BGM生成・マーケット・ガチャ・ミッション・ステーキング・ノート生成）についても詳しいです。
回答は簡潔にまとめつつ、必要なら詳しく説明してください。
```

---

## 3. LifaiCatコンポーネント変更 (`components/LifaiCat.tsx`)

### 削除するstate・関数・型

- `isChat` state
- `chatHistory` state
- `chatInput` state
- `isWaiting` state
- `handleChatSend` 関数
- `getCatReply` 関数（インパネルチャット用のキーワードマッチャー）
- `ChatEntry` 型エイリアス

### 描画ロジック変更

現行の `{isChat ? <チャット画面> : <通常画面>}` の三項分岐を削除し、
`<通常画面>` のみを残す。

### 「相談する」ボタン変更

```tsx
// Before
<button onClick={() => setIsChat(true)}>💬 相談する</button>

// After
<button onClick={() => { setIsOpen(false); router.push('/chat'); }}>💬 相談する</button>
```

---

## エラーハンドリング

- API失敗時: `{ role: 'assistant', content: 'ごめんね、うまく答えられなかったよ🙀 もう一度試してみて！' }` をmessagesに追加
- ネットワークエラー: 同上

## 認証・レート制限

- `/chat` は認証不要（LifaiCatは未ログインユーザーにも表示されるため）
- レート制限は現時点では未実装。コスト管理は将来的な課題として保留。
