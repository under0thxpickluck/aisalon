# Multi-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9つの独立したバグ修正・機能追加を順番に実装する

**Architecture:** 各タスクは独立。GASへのメール依頼は新しいGASアクション名を呼ぶだけ（GAS側実装は別途）。フロントエンドは Next.js 14 App Router + React。

**Tech Stack:** Next.js 14, TypeScript, React, Google Apps Script (GAS)

---

## ファイルマップ

| ファイル | 変更内容 |
|---|---|
| `app/market/create/page.tsx` | プレビュー画像URL（最大8枚）入力欄を追加 |
| `app/api/market/create/route.ts` | `preview_images` をGASに渡す |
| `app/market/[item_id]/page.tsx` | `MarketItem`型に`preview_images`追加・サムネイル表示 |
| `app/api/market/sell-request/route.ts` | `id === seller_id` サーバー検証を追加 |
| `app/api/market/buy/route.ts` | 購入成功後にGAS `market_notify_purchase` 呼び出し |
| `components/GachaModal.tsx` | デイリーボタンの二重押し防止（ref + finally） |
| `app/api/staking/route.ts` | GETレスポンス後に`stake_notify_mature`呼び出し |
| `app/api/narasu-agency/pay-bp/route.ts` | `NARASU_BP_COST = 3000` |
| `app/api/narasu-agency/pay-ep/route.ts` | `NARASU_EP_COST = 1000` |
| `app/narasu-agency/terms/page.tsx` | 料金表示を3000BP / 1000EPに更新 |
| `app/narasu-agency/complete/page.tsx` | 完了メッセージを3000BP / 1000EPに更新 |
| `app/mini-games/rumble/page.tsx` | スロット名正規化・分解確認モーダル |
| `app/top/page.tsx` | 「Gift交換」準備中アイコンを追加 |

---

## Task 1: マーケット出品フォームにプレビュー画像を最大8枚追加

**Files:**
- Modify: `app/market/create/page.tsx`
- Modify: `app/api/market/create/route.ts`
- Modify: `app/market/[item_id]/page.tsx`

- [ ] **Step 1: create/page.tsx にプレビュー画像ステートと入力UIを追加**

`app/market/create/page.tsx` で `const [deliveryRef, setDeliveryRef] = useState("");` の下に追加:

```typescript
const [previewImages, setPreviewImages] = useState<string[]>([""]);

const addPreviewImage = () => {
  if (previewImages.length >= 8) return;
  setPreviewImages(prev => [...prev, ""]);
};
const removePreviewImage = (idx: number) => {
  setPreviewImages(prev => prev.filter((_, i) => i !== idx));
};
const updatePreviewImage = (idx: number, val: string) => {
  setPreviewImages(prev => prev.map((v, i) => i === idx ? val : v));
};
```

- [ ] **Step 2: フォームのJSXにプレビュー画像入力欄を追加**

`app/market/create/page.tsx` の「納品URL」欄の下（`{error && ...}` の上）に以下を追加:

```tsx
{/* プレビュー画像 */}
<div>
  <label style={labelStyle}>プレビュー画像URL（任意・最大8枚）</label>
  <p style={{ marginTop: 3, marginBottom: 8, fontSize: 10, color: "rgba(234,240,255,0.3)", lineHeight: 1.5 }}>
    ※ 購入者がコンテンツを確認するためのサンプル画像URLを入力してください。
  </p>
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {previewImages.map((url, idx) => (
      <div key={idx} style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          value={url}
          onChange={e => updatePreviewImage(idx, e.target.value)}
          placeholder={`画像URL ${idx + 1}`}
          style={{ ...inputStyle, flex: 1 }}
        />
        {previewImages.length > 1 && (
          <button
            type="button"
            onClick={() => removePreviewImage(idx)}
            style={{
              flexShrink: 0,
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)",
              padding: "8px 12px",
              fontSize: 12,
              color: "#FCA5A5",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        )}
      </div>
    ))}
    {previewImages.length < 8 && (
      <button
        type="button"
        onClick={addPreviewImage}
        style={{
          borderRadius: 14,
          border: "1px dashed rgba(99,102,241,0.4)",
          background: "transparent",
          padding: "8px",
          fontSize: 12,
          color: "rgba(167,139,250,0.7)",
          cursor: "pointer",
        }}
      >
        ＋ 画像を追加（{previewImages.length}/8）
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 3: handleSubmit で preview_images を送信に含める**

`app/market/create/page.tsx` の `body: JSON.stringify({...})` に以下を追加:

```typescript
preview_images: previewImages.filter(u => u.trim() !== ""),
```

- [ ] **Step 4: APIルートで preview_images をGASに渡す**

`app/api/market/create/route.ts` で:

```typescript
// 変更前
const { id, code, title, desc, item_type, asset_count, currency, price,
        delivery_mode, delivery_ref, stock_total } = body;
// 変更後
const { id, code, title, desc, item_type, asset_count, currency, price,
        delivery_mode, delivery_ref, stock_total, preview_images } = body;
```

callGas の payload に追加:
```typescript
preview_images: Array.isArray(preview_images) ? preview_images.slice(0, 8).join(",") : "",
```

- [ ] **Step 5: 商品詳細ページの MarketItem 型に preview_images を追加**

`app/market/[item_id]/page.tsx` の `type MarketItem = {` に:
```typescript
preview_images?: string;
```

- [ ] **Step 6: 商品詳細ページにサムネイル表示を追加**

`app/market/[item_id]/page.tsx` の `{/* 購入セクション */}` の前に追加:

```tsx
{/* プレビュー画像 */}
{item.preview_images && item.preview_images.trim() !== "" && (() => {
  const imgs = item.preview_images!.split(",").filter(u => u.trim() !== "");
  if (imgs.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(234,240,255,0.45)", marginBottom: 10 }}>
        プレビュー画像
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 8,
      }}>
        {imgs.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)", aspectRatio: "1/1" }}>
            <img
              src={url}
              alt={`プレビュー ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </a>
        ))}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 7: 動作確認**

`npm run dev` で開発サーバーを起動し、`/market/create` にアクセスして画像URL入力欄が最大8枚まで追加できることを確認。

- [ ] **Step 8: コミット**

```bash
git add app/market/create/page.tsx app/api/market/create/route.ts app/market/[item_id]/page.tsx
git commit -m "feat: add up to 8 preview images to market listing"
```

---

## Task 2: 売却申請のアクセス制御を修正（自分の出品のみ申請可）

**Files:**
- Modify: `app/api/market/sell-request/route.ts`

- [ ] **Step 1: APIルートに所有者チェックを追加**

`app/api/market/sell-request/route.ts` の `if (!item_id || !seller_id)` ブロックの下に追加:

```typescript
// 申請者と出品者が一致しているか検証
if (id !== seller_id) {
  return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
}
```

- [ ] **Step 2: 動作確認**

`curl -X POST http://localhost:3000/api/market/sell-request -H "Content-Type: application/json" -d '{"id":"userA","code":"xxx","item_id":"item1","seller_id":"userB"}'` を実行して `{"ok":false,"error":"forbidden"}` が返ることを確認。

- [ ] **Step 3: コミット**

```bash
git add app/api/market/sell-request/route.ts
git commit -m "fix: prevent sell-request for items owned by other users"
```

---

## Task 3: 市場購入時に購入者・出品者へメール通知

**Files:**
- Modify: `app/api/market/buy/route.ts`

- [ ] **Step 1: 購入成功後にGASのメール通知アクションを呼び出す**

`app/api/market/buy/route.ts` を以下のように変更。GASが `market_notify_purchase` アクションを実装済みであることを前提とする（GAS側で購入者・出品者へのメール送信と納品URLの購入者転送を行う）:

```typescript
import { NextResponse } from "next/server";

async function callGas(gasUrl: string, gasKey: string, payload: object) {
  const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: "bad_gas_json" }; }
}

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const { id, code, item_id } = body;

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "missing_auth" }, { status: 400 });
    }
    if (!item_id) {
      return NextResponse.json({ ok: false, error: "missing_item_id" }, { status: 400 });
    }

    const gas = await callGas(gasUrl, gasKey, { action: "market_buy", id, code, item_id });

    // 購入成功時にメール通知をトリガー（GASに委託）
    if (gas.ok && gas.order_id) {
      // fire-and-forget: メール送信失敗は購入完了に影響しない
      callGas(gasUrl, gasKey, {
        action: "market_notify_purchase",
        order_id: gas.order_id,
        buyer_id: id,
        item_id,
      }).catch(() => {});
    }

    return NextResponse.json(gas, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: GAS側の実装メモを追加（コメント）**

上記コードの `market_notify_purchase` コメントは以下の仕様をGAS開発者に伝える:
```
GAS action "market_notify_purchase":
  - 購入者 (buyer_id) にメール: 注文ID、商品名、納品URL（delivery_ref）を含む
  - 出品者にメール: 注文ID、商品名、購入者IDを含む購入通知
```

- [ ] **Step 3: コミット**

```bash
git add app/api/market/buy/route.ts
git commit -m "feat: trigger purchase email notification via GAS after market buy"
```

---

## Task 4: ガチャのデイリーが複数回押せる不具合を修正

**Files:**
- Modify: `components/GachaModal.tsx`

- [ ] **Step 1: クリック重複防止のためのref追加と finally での確実な無効化**

`components/GachaModal.tsx` の `useState` インポートの後にuseRefを追加し、`handleDaily` を修正:

`export default function GachaModal(...)` の中の `useState` 宣言の下に追加:
```typescript
const dailyCalledRef = useRef(false);
```

`handleDaily` 関数全体を以下に置き換え:
```typescript
const handleDaily = async () => {
  if (spinning || dailyUsed || !loginId || dailyCalledRef.current) return;
  dailyCalledRef.current = true;  // ← 即座にフラグをセット（二重呼び出し防止）
  setSpinning(true);
  setErrMsg("");
  try {
    const res = await fetch("/api/gacha/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    if (!data.ok) {
      if (data.error === "daily_already_used") {
        setDailyUsed(true);
        setErrMsg("本日のデイリーガチャは使用済みです");
      } else {
        const reason = data.reason || data.error || "failed";
        setErrMsg(reason === "insufficient_bp" ? "BPが不足しています（80BP必要）" : `エラー: ${reason}`);
        dailyCalledRef.current = false;  // エラー時は再試行を許可
      }
      return;
    }
    setDailyUsed(true);
    setResult({
      prize_bp:    data.prize_bp,
      net:         data.net,
      bp_balance:  data.bp_balance,
      fragments:   data.fragments,
      gacha_count: data.gacha_count,
      rarity:      data.rarity,
      to_pity:     data.to_pity,
    });
    onBpEarned(data.prize_bp);
  } catch {
    setErrMsg("通信エラーが発生しました");
    dailyCalledRef.current = false;  // 通信エラーは再試行を許可
  } finally {
    setSpinning(false);
  }
};
```

useRefのインポートを確認（`import { useEffect, useState, useRef } from "react";`）。

- [ ] **Step 2: 動作確認**

`npm run dev` でGachaModalを開き、デイリーボタンを素早く複数回クリックしてもAPIが1回しか呼ばれないことを確認。

- [ ] **Step 3: コミット**

```bash
git add components/GachaModal.tsx
git commit -m "fix: prevent multiple daily gacha submissions via ref guard"
```

---

## Task 5: ステーキング満期時のメール通知

**Files:**
- Modify: `app/api/staking/route.ts`

- [ ] **Step 1: GETでステーク情報を取得した後、満期通知をGASに依頼**

`app/api/staking/route.ts` の `GET` ハンドラーを以下に変更:

```typescript
// GET: ステーク状況取得
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const loginId = searchParams.get("loginId");

  if (!loginId) {
    return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
  }

  const result = await postToGas({ action: "get_stakes", loginId });

  // 満期ステークがあればGASにメール通知を依頼（fire-and-forget）
  // GAS側で重複送信防止（1日1回など）を実装すること
  postToGas({ action: "stake_notify_mature", loginId }).catch(() => {});

  return result;
}
```

> **GAS実装メモ:**
> `stake_notify_mature` アクション:
> - 該当ユーザーのステーク一覧から `mature_at <= 今日` かつ `status = "active"` のものを取得
> - 1日1回のみ通知（`last_notified_at` を記録して重複防止）
> - ユーザーのメールアドレスに「ステーキング満期のお知らせ」を送信

- [ ] **Step 2: コミット**

```bash
git add app/api/staking/route.ts
git commit -m "feat: notify user via GAS when staking matures on view"
```

---

## Task 6: narasu申請代行の金額を値上げ（BP: 3000 / EP: 1000）

**Files:**
- Modify: `app/api/narasu-agency/pay-bp/route.ts`
- Modify: `app/api/narasu-agency/pay-ep/route.ts`
- Modify: `app/narasu-agency/terms/page.tsx`
- Modify: `app/narasu-agency/complete/page.tsx`

- [ ] **Step 1: APIルートのコスト定数を更新**

`app/api/narasu-agency/pay-bp/route.ts`:
```typescript
// 変更前
const NARASU_BP_COST = 2600;
// 変更後
const NARASU_BP_COST = 3000;
```

`app/api/narasu-agency/pay-ep/route.ts`:
```typescript
// 変更前
const NARASU_EP_COST = 400;
// 変更後
const NARASU_EP_COST = 1000;
```

- [ ] **Step 2: 利用規約ページの料金表示を更新**

`app/narasu-agency/terms/page.tsx` で "2600BP" → "3000BP"、"400EP" → "1000EP" に変更（2箇所）。

- [ ] **Step 3: 完了ページの料金表示を更新**

`app/narasu-agency/complete/page.tsx` で:
- `"2600BP の支払いが完了しました！"` → `"3000BP の支払いが完了しました！"`
- `"400EP の支払いが完了しました！"` → `"1000EP の支払いが完了しました！"`
- `"2600BP消費 — 即時完了"` → `"3000BP消費 — 即時完了"`
- `"400EP消費 — 即時完了"` → `"1000EP消費 — 即時完了"`

- [ ] **Step 4: コミット**

```bash
git add app/api/narasu-agency/pay-bp/route.ts app/api/narasu-agency/pay-ep/route.ts app/narasu-agency/terms/page.tsx app/narasu-agency/complete/page.tsx
git commit -m "feat: raise narasu agency fee to 3000 BP / 1000 EP"
```

---

## Task 7: ランブル装備スロットの表示修正（スロット名正規化）

**Files:**
- Modify: `app/mini-games/rumble/page.tsx`

**背景:** GASが返すスロット名と、フロントエンドが期待するスロット名（"head"/"body"/"hand"/"leg"）が一致していない可能性がある。正規化マップを追加して、どのような名前で来ても正しく表示されるようにする。

- [ ] **Step 1: スロット名正規化マップを追加**

`app/mini-games/rumble/page.tsx` の `const RARITY_COLOR = ...` の前に追加:

```typescript
// GASから返されるスロット名が異なる場合も吸収する
const SLOT_NORMALIZE: Record<string, string> = {
  // 標準名（そのままパス）
  head: "head", body: "body", hand: "hand", leg: "leg",
  // 代替名（GASがこれらを使っていても正しく対応）
  helmet: "head", chest: "body", armor: "body",
  glove: "hand", gloves: "hand",
  boot: "leg", boots: "leg", feet: "leg",
};

function normalizeSlot(slot: string): string {
  return SLOT_NORMALIZE[slot?.toLowerCase()] ?? slot;
}
```

- [ ] **Step 2: equipment データ読み込み時にスロットを正規化**

`app/mini-games/rumble/page.tsx` の `useEffect` で equipment を読み込む箇所:

```typescript
// 変更前
.then(d => { if (d.ok) setEquipment(d.items); })

// 変更後
.then(d => {
  if (d.ok) {
    setEquipment((d.items as Equipment[]).map(item => ({
      ...item,
      slot: normalizeSlot(item.slot),
    })));
  }
})
```

同様に `handleEquip` の後の equipment 再取得箇所も変更:

```typescript
// 変更前
const eqRes  = await fetch(`/api/minigames/rumble/equipment?userId=${encodeURIComponent(userId)}`);
const eqData = await eqRes.json();
if (eqData.ok) setEquipment(eqData.items);

// 変更後
const eqRes  = await fetch(`/api/minigames/rumble/equipment?userId=${encodeURIComponent(userId)}`);
const eqData = await eqRes.json();
if (eqData.ok) {
  setEquipment((eqData.items as Equipment[]).map((item: Equipment) => ({
    ...item,
    slot: normalizeSlot(item.slot),
  })));
}
```

- [ ] **Step 3: ガチャ結果の slot 表示も正規化後の日本語表示にする**

`app/mini-games/rumble/page.tsx` のガチャ結果表示部分:

```tsx
// 変更前
<p className="text-sm text-white/60">{gachaResult.item.slot} / +{gachaResult.item.bonus}ボーナス</p>

// 変更後
<p className="text-sm text-white/60">
  {(() => {
    const s = normalizeSlot(gachaResult.item.slot);
    return s === "head" ? "頭" : s === "body" ? "胴" : s === "hand" ? "手" : "足";
  })()} / +{gachaResult.item.bonus}ボーナス
</p>
```

- [ ] **Step 4: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "fix: normalize rumble equipment slot names to prevent wrong slot display"
```

---

## Task 8: ランブル分解の確認をカスタムモーダルに変更

**Files:**
- Modify: `app/mini-games/rumble/page.tsx`

**背景:** 現在は `confirm()` を使用しているため、ブラウザのネイティブダイアログがページ上部に表示されて違和感がある。強化モーダルと同様のカスタムモーダルに変更する。

- [ ] **Step 1: 分解確認モーダルの state を追加**

`app/mini-games/rumble/page.tsx` の `const [enhanceModal, setEnhanceModal] = ...` の下に追加:

```typescript
// 分解確認モーダル
const [dismantleModal, setDismantleModal] = useState<{ itemId: string; itemName: string } | null>(null);
const [dismantling, setDismantling] = useState(false);
const [dismantleMsg, setDismantleMsg] = useState("");
```

- [ ] **Step 2: handleDismantle を修正してモーダルを開くだけにする**

```typescript
// 変更前
const handleDismantle = async (itemId: string) => {
  if (!userId || busy) return;
  if (!confirm("本当に分解しますか？")) return;
  setBusy(true);
  try {
    // ...
  }
};

// 変更後
const handleDismantle = (itemId: string) => {
  const item = equipment.find(e => e.id === itemId);
  if (!item || !userId || busy) return;
  setDismantleModal({ itemId, itemName: item.name });
  setDismantleMsg("");
};
```

- [ ] **Step 3: handleDismantleConfirm を追加（実際のAPI呼び出し）**

```typescript
const handleDismantleConfirm = async () => {
  if (!dismantleModal || !userId || dismantling) return;
  setDismantling(true);
  setDismantleMsg("");
  try {
    const res = await fetch("/api/minigames/rumble/dismantle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, itemId: dismantleModal.itemId }),
    });
    const data = await res.json();
    if (data.ok) {
      setShards(data.remaining_shard);
      setEquipment(prev => prev.filter(e => e.id !== dismantleModal.itemId));
      setMsg(`🔨 分解完了！ +${data.gained_shard} 力のかけら`);
      setDismantleModal(null);
    } else {
      setDismantleMsg(data.error === "item_locked" ? "ロック中は分解できません" : "エラーが発生しました");
    }
  } catch {
    setDismantleMsg("通信エラー");
  } finally {
    setDismantling(false);
  }
};
```

- [ ] **Step 4: 分解確認モーダルのJSXを追加**

強化モーダル（`{enhanceModal && ...}`）の直後に追加:

```tsx
{/* 分解確認モーダル */}
{dismantleModal && (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
      <h2 className="text-base font-black mb-1 text-center">🔨 装備を分解しますか？</h2>
      <p className="text-sm text-white/60 text-center mb-4">
        「{dismantleModal.itemName}」を分解します。<br />
        <span className="text-orange-400 font-bold">この操作は取り消せません。</span>
      </p>
      {dismantleMsg && (
        <p className="text-xs text-red-400 text-center mb-3">{dismantleMsg}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => { setDismantleModal(null); setDismantleMsg(""); }}
          disabled={dismantling}
          className="flex-1 py-2.5 rounded-xl border border-white/20 text-sm text-white/60 hover:bg-white/5 disabled:opacity-40"
        >
          キャンセル
        </button>
        <button
          onClick={handleDismantleConfirm}
          disabled={dismantling}
          className="flex-1 py-2.5 rounded-xl bg-orange-700/80 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40"
        >
          {dismantling ? "分解中…" : "分解する"}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "fix: replace native confirm() with custom dismantle confirmation modal"
```

---

## Task 9: ミニアプリ欄に「Gift交換」準備中アイコンを追加

**Files:**
- Modify: `app/top/page.tsx`

- [ ] **Step 1: アプリ配列に「Gift交換」を追加**

`app/top/page.tsx` の `{ id: "gift", label: "GiftEP", ... }` の後（または前）に以下を追加:

```typescript
{ id: "gift-exchange", label: "Gift交換", icon: "🎀", color: "from-rose-400 to-pink-500", href: "#", desc: "ギフトポイントの交換・利用（近日公開）", badge: "準備中", disabled: true },
```

- [ ] **Step 2: アプリクリック処理で `disabled: true` のものを無効化**

アプリアイコンのクリックハンドラー部分で `disabled` チェックを確認。
`app/top/page.tsx` の `onClick` 処理（`onOpen` や `href` ナビゲーション）に以下を追加。

アプリグリッドのボタン/リンク部分を探し（line ~670あたり）、onClick の先頭に:
```typescript
if (app.disabled) return;
```
を追加する。もしくはアプリ型定義に `disabled?: boolean` を加え、`cursor: app.disabled ? "not-allowed" : "pointer"` とスタイルを設定する。

**具体的な変更箇所:**
`app/top/page.tsx` の `AppItem` 型に `disabled?: boolean` を追加し、アプリグリッドのレンダリング部分でdisabledなら `opacity-50 cursor-not-allowed` スタイルを適用し、クリック時何も起きないようにする。

- [ ] **Step 3: 動作確認**

`npm run dev` でTOPページを開き、「Gift交換」アイコンが表示されていること、クリックしても何も起きないことを確認。「準備中」バッジが表示されることを確認。

- [ ] **Step 4: コミット**

```bash
git add app/top/page.tsx
git commit -m "feat: add Gift Exchange placeholder icon with coming soon badge to mini apps"
```

---

## 実装完了チェックリスト

- [ ] Task 1: マーケットプレビュー画像（8枚）
- [ ] Task 2: 売却申請アクセス制御
- [ ] Task 3: 購入メール通知
- [ ] Task 4: ガチャデイリー二重押し防止
- [ ] Task 5: ステーキング満期通知
- [ ] Task 6: narasu代行費値上げ（3000BP/1000EP）
- [ ] Task 7: ランブル装備スロット正規化
- [ ] Task 8: ランブル分解確認モーダル
- [ ] Task 9: Gift交換アイコン追加（準備中）

## GAS側で別途実装が必要なもの

以下はGAS（Google Apps Script）側での実装が必要。Next.js側のAPIは呼び出すだけの設計にしてある:

1. **`market_notify_purchase` アクション** (Task 3)
   - `order_id`, `buyer_id`, `item_id` を受け取る
   - 購入者に「購入完了・納品URL」メール送信
   - 出品者に「商品が購入されました」通知メール送信

2. **`stake_notify_mature` アクション** (Task 5)
   - `loginId` を受け取る
   - 満期済みステーク（`mature_at <= today` かつ `status = "active"`）をチェック
   - 1日1回のみ通知（重複防止）
   - 「ステーキングが満期を迎えました」メール送信

3. **`market_item` GASアクションで `preview_images` を返す** (Task 1)
   - `market_create` で保存した `preview_images` カラムを `market_item` GETで返す

4. **装備スロット名の確認** (Task 7)
   - GASが返しているスロット名（"head"/"helmet" etc.）を確認してフロントの正規化マップと照合
