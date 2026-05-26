````md
# LIFAI Square Webhook 自動BP付与システム 実装メモ
作成日: 2026-05-26

---

# 目的

現在のLIFAIでは Square の決済リンク（square.link）を利用しているが、
「支払い完了」をアプリ側で受信していないため、
BP付与が手動運用になっている。

この仕組みを改善し、

- Square決済完了
- Webhook受信
- GAS payment_update
- approveRowCore_
- BP自動付与

までを完全自動化する。

---

# 現状の構成（実装前）

## 現在の仕組み

membership/page.tsx や music-boost/page.tsx では：

```ts
squareUrl: "https://square.link/u/xxxxxxxx"
````

という外部リンクを開いているのみ。

そのため：

* ユーザーが支払っても
* LIFAI側には通知されない
* 支払い情報を取得できない
* 自動BP付与不可

となっている。

---

# 現在の決済状態

| 決済方式        | 状態               |
| ----------- | ---------------- |
| NOWPayments | IPN Webhook実装済み  |
| Square      | リンクのみ・Webhook未実装 |

---

# 今回の目標

Square決済時に：

```txt
Square
↓
Webhook
↓
Vercel API
↓
GAS payment_update
↓
approveRowCore_
↓
BP付与
```

を構築する。

---

# Square Developer 設定

## 作成したアプリ

Application Name:

```txt
LIFAI
```

Audience:

```txt
Myself
```

用途:

```txt
Accept payments
```

---

# Square Webhook 設定

## Subscription Name

```txt
LIFAI Payments
```

---

## Notification URL

```txt
https://lifai.vercel.app/api/square/webhook
```

※ 後で route.ts を実装する

---

## 使用イベント

```txt
payment.updated
```

のみ使用。

---

# なぜ payment.updated を使うのか

Squareでは：

```txt
payment.completed
```

ではなく、

```txt
payment.updated
```

で status の変更を監視するのが推奨。

支払い完了時：

```json
{
  "payment": {
    "status": "COMPLETED"
  }
}
```

になる。

---

# 取得する認証情報

## Production Credentials

取得済み：

* Production Application ID
* Production Access Token
* Webhook Signature Key

---

# Vercel 環境変数

```env
SQUARE_ACCESS_TOKEN=
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_LOCATION_ID=
```

必要に応じて：

```env
GAS_WEBHOOK_SECRET=
GAS_ENDPOINT=
```

も追加。

---

# 実装予定ファイル

## 新規作成

```txt
app/api/square/webhook/route.ts
```

---

# route.ts の役割

## 処理フロー

1. Square Webhook受信
2. Signature検証
3. payment.updated 判定
4. payment.status === COMPLETED 判定
5. payment_id 取得
6. amount_money 取得
7. metadata/order note 取得
8. GAS payment_update 呼び出し
9. BP付与

---

# 署名検証

Squareは：

```txt
x-square-hmacsha256-signature
```

ヘッダを送る。

検証には：

* Raw Body
* Notification URL
* Signature Key

を使用。

---

# 二重付与対策

必須。

## 保存する値

```txt
square_payment_id
```

同じIDなら再付与しない。

---

# 推奨 metadata 設計

Square Checkout Link 作成時に：

```json
{
  "metadata": {
    "user_id": "xxx",
    "bp": "500"
  }
}
```

を保存。

Webhook時に取得可能。

---

# 仮のWebhook受信例

```json
{
  "type": "payment.updated",
  "data": {
    "object": {
      "payment": {
        "id": "PAYMENT_ID",
        "status": "COMPLETED",
        "amount_money": {
          "amount": 5000,
          "currency": "JPY"
        }
      }
    }
  }
}
```

---

# route.ts 実装イメージ

```ts
export async function POST(req: Request) {
  const rawBody = await req.text()

  const signature = req.headers.get(
    "x-square-hmacsha256-signature"
  )

  // signature verify

  const body = JSON.parse(rawBody)

  if (body.type !== "payment.updated") {
    return Response.json({ ok: true })
  }

  const payment = body.data.object.payment

  if (payment.status !== "COMPLETED") {
    return Response.json({ ok: true })
  }

  // GAS payment_update 呼び出し

  return Response.json({ ok: true })
}
```

---

# GAS 側の役割

既存：

```txt
payment_update
approveRowCore_
```

を利用。

Square用に：

```txt
provider=square
```

を追加する想定。

---

# 今後やること

## 1. route.ts 作成

```txt
app/api/square/webhook/route.ts
```

---

## 2. Signature検証実装

Square公式方式。

---

## 3. GAS連携

payment_update 呼び出し。

---

## 4. Square metadata設計

user_id
bp
plan_id
など。

---

## 5. Checkout Link API化

現在：

```txt
square.link
```

固定URL。

将来的には：

```txt
Square Checkout API
```

で動的生成。

---

# 将来的な改善案

## 動的Checkout生成

ユーザーごとに：

* user_id
* BP量
* プラン
* metadata

を埋め込む。

---

## 管理画面

* 支払い履歴
* 失敗一覧
* 再送
* 手動承認
* chargeback監視

---

# 現在の状態

✅ Square Developer App 作成済み
✅ Production Access Token 取得可能
✅ Webhook Subscription 作成中
✅ payment.updated 選定済み
✅ Notification URL 決定済み

未実装：

❌ route.ts
❌ Signature検証
❌ GAS連携
❌ 自動BP付与

---

# 最終完成イメージ

```txt
ユーザー
↓
Square Checkout
↓
Square Webhook
↓
Vercel route.ts
↓
署名検証
↓
payment.updated
↓
COMPLETED確認
↓
GAS payment_update
↓
approveRowCore_
↓
BP付与
↓
LIFAI反映
```

```
```
