# Music Boost EP決済・管理画面強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Music Boost にEP決済フロー（100 EP = $1）を接続し、管理画面の会員一覧に Music Boost 列とサーバーサイドソートを追加する。

**Architecture:** GAS側でEP差引・Boostデータ結合・ソートを処理し、Next.js APIルートはパラメータをGASに透過転送するだけ。フロントはEP残高取得・確認モーダルを追加し、既存の`handleSubscribe`ロジックを再利用する。

**Tech Stack:** Google Apps Script (GAS), Next.js 14 App Router (TypeScript), Tailwind CSS

---

## ファイルマップ

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | Modify | `musicBoostSubscribe_`: EP差引追加 / `admin_get_members`: Boost結合・ソート追加 |
| `app/api/music-boost/subscribe/route.ts` | Modify | `paymentMethod` を GAS に転送 |
| `app/api/admin/members/route.ts` | Modify | `sortKey` / `sortOrder` を GAS に転送 |
| `app/music-boost/page.tsx` | Modify | EP残高state・確認モーダル・決済ボタン2種追加 |
| `app/admin/page.tsx` | Modify | `MemberRow`型にboost列追加・`SortTh`コンポーネント・ソート状態・loadMembers更新・テーブル列追加 |

---

### Task 1: GAS — `musicBoostSubscribe_` にEP差引を追加

**Files:**
- Modify: `gas/Code.gs`（`musicBoostSubscribe_` 関数、行8498〜8564）

**注意:** 既存の枠チェック・キャンセル処理・行追加・返却値は一切変更しない。EP差引処理を「枠チェック通過後、既存アクティブをcanceledにする前」に挿入するだけ。

- [ ] **Step 1: `musicBoostSubscribe_` の先頭で `paymentMethod` を受け取る**

`var planId = String(params.planId || "");` の次の行に追加する：

```javascript
  var paymentMethod = String(params.paymentMethod || "ep");
```

- [ ] **Step 2: 枠チェック通過後（`if (deltaSlots > availSlots)` ブロックの直後）にEP差引処理を挿入する**

`var nowJst = new Date(...)` の直前に以下を挿入する：

```javascript
  // ── EP決済処理 ────────────────────────────────────────────
  if (paymentMethod === "ep") {
    var epCost = plan.price * 100;

    // applies シートからユーザーのEP残高を確認
    var appliesSheet = getOrCreateSheet_();
    var appliesData  = appliesSheet.getDataRange().getValues();
    var appliesHdr   = appliesData[0];
    var appliesIdx   = {};
    appliesHdr.forEach(function(h, i) { appliesIdx[h] = i; });

    var userEp    = 0;
    var userEmail = "";
    for (var ai = 1; ai < appliesData.length; ai++) {
      if (String(appliesData[ai][appliesIdx["login_id"]]) === userId) {
        userEp    = Number(appliesData[ai][appliesIdx["ep_balance"]] || 0);
        userEmail = String(appliesData[ai][appliesIdx["email"]] || "");
        break;
      }
    }

    if (userEp < epCost) {
      return json_({ ok: false, error: "insufficient_ep", balance: userEp, needed: epCost });
    }

    var epResult = mktAdjustEp_(userId, userEmail, -epCost, "music_boost_ep",
                                "Music Boost " + planId + " EP支払い");
    if (!epResult.ok) {
      return json_({ ok: false, error: "ep_deduct_failed", detail: epResult.error });
    }
  }
  // ── EP決済処理ここまで ────────────────────────────────────
```

- [ ] **Step 3: 返却値に `ep_cost` を追加する（paymentMethod === "ep" のとき）**

`return json_({ ok: true, boost_id: newId, ... })` を以下に差し替える（既存フィールドをすべて維持しつつ追加）：

```javascript
  var returnPayload = {
    ok:         true,
    boost_id:   newId,
    plan_id:    planId,
    percent:    plan.percent,
    price_usd:  plan.price,
    slots_used: plan.slots,
    started_at: nowJst,
    expires_at: expiresAt,
  };
  if (paymentMethod === "ep") {
    returnPayload.ep_cost = plan.price * 100;
  }
  return json_(returnPayload);
```

- [ ] **Step 4: GASをデプロイして動作確認（Apps Script エディタから「デプロイ」→「既存のデプロイを管理」→更新）**

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): music_boost_subscribe にEP差引処理を追加"
```

---

### Task 2: GAS — `admin_get_members` に Music Boost 結合とサーバーサイドソートを追加

**Files:**
- Modify: `gas/Code.gs`（`admin_get_members` ブロック、行1052〜1100）

**注意:** 既存の返却フィールドはすべて維持する。追加のみ。

- [ ] **Step 1: `approved` 配列のビルド前に Music Boost マップを作成する**

`const page = Math.max(...)` の直後に以下を挿入する：

```javascript
    // ── Music Boost マップ構築（userId → {plan_id, expires_at}）──
    var boostMap = {};
    try {
      var bSS    = SpreadsheetApp.getActiveSpreadsheet();
      var bSheet = bSS.getSheetByName("music_boost");
      if (bSheet) {
        var bData = bSheet.getDataRange().getValues();
        var bHdr  = bData[0];
        var bIdx  = {};
        bHdr.forEach(function(h, i) { bIdx[h] = i; });
        for (var bi = 1; bi < bData.length; bi++) {
          if (String(bData[bi][bIdx["status"]]) === "active") {
            boostMap[String(bData[bi][bIdx["user_id"]])] = {
              plan_id:    String(bData[bi][bIdx["plan_id"]]),
              expires_at: String(bData[bi][bIdx["expires_at"]]),
            };
          }
        }
      }
    } catch (e) { /* シートなければ空マップのまま */ }
    // ─────────────────────────────────────────────────────────
```

- [ ] **Step 2: `approved.push(...)` の各フィールドに `music_boost_plan` と `music_boost_expires_at` を追加する**

既存の `approved.push({...})` の末尾に2フィールドを追加する（`last_login_at: ...` の後）：

```javascript
        music_boost_plan:       boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].plan_id    : null,
        music_boost_expires_at: boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].expires_at : null,
```

- [ ] **Step 3: ソートパラメータを受け取り、ソートロジックを差し替える**

`approved.sort(function(a, b) { ... })` 全体を以下に差し替える：

```javascript
    // ── サーバーサイドソート ──────────────────────────────────
    var ALLOWED_SORT_KEYS = ["created_at", "ep_balance", "bp_balance",
                             "login_streak", "total_login_count", "last_login_at"];
    var sortKey   = ALLOWED_SORT_KEYS.indexOf(str_(body.sortKey)) !== -1
                    ? str_(body.sortKey) : "created_at";
    var sortOrder = str_(body.sortOrder) === "asc" ? "asc" : "desc";

    approved.sort(function(a, b) {
      var av = a[sortKey];
      var bv = b[sortKey];
      // 数値列は数値比較
      if (typeof av === "number" && typeof bv === "number") {
        return sortOrder === "asc" ? av - bv : bv - av;
      }
      // 文字列（日時含む）は文字列比較
      var as = String(av || "");
      var bs = String(bv || "");
      if (sortOrder === "asc") return as < bs ? -1 : as > bs ? 1 : 0;
      else                     return bs < as ? -1 : bs > as ? 1 : 0;
    });
    // ─────────────────────────────────────────────────────────
```

- [ ] **Step 4: GASをデプロイして動作確認**

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): admin_get_members にMusic Boost結合とサーバーサイドソートを追加"
```

---

### Task 3: APIルート — `subscribe` に `paymentMethod` 転送を追加

**Files:**
- Modify: `app/api/music-boost/subscribe/route.ts`

- [ ] **Step 1: `paymentMethod` をボディから受け取りGASに転送する**

現在の `const { userId, planId } = body ?? {};` を以下に変更する：

```typescript
  const { userId, planId, paymentMethod } = body ?? {};
```

`body: JSON.stringify({ action: "music_boost_subscribe", key: GAS_API_KEY, userId, planId })` を以下に変更する：

```typescript
      body: JSON.stringify({ action: "music_boost_subscribe", key: GAS_API_KEY, userId, planId, paymentMethod: paymentMethod ?? "ep" }),
```

- [ ] **Step 2: コミット**

```bash
git add app/api/music-boost/subscribe/route.ts
git commit -m "feat(api): music-boost/subscribe に paymentMethod パラメータを転送"
```

---

### Task 4: APIルート — `admin/members` に `sortKey` / `sortOrder` 転送を追加

**Files:**
- Modify: `app/api/admin/members/route.ts`

- [ ] **Step 1: クエリパラメータを受け取りGASに転送する**

現在の `const page = ...` / `const pageSize = ...` の後に追加する：

```typescript
  const sortKey   = searchParams.get("sortKey")   ?? "created_at";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";
```

`body: JSON.stringify({ action: "admin_get_members", adminKey: gasAdminKey, page, pageSize })` を以下に変更する：

```typescript
      body: JSON.stringify({ action: "admin_get_members", adminKey: gasAdminKey, page, pageSize, sortKey, sortOrder }),
```

- [ ] **Step 2: コミット**

```bash
git add app/api/admin/members/route.ts
git commit -m "feat(api): admin/members に sortKey/sortOrder パラメータを転送"
```

---

### Task 5: フロント — `music-boost/page.tsx` EP残高・確認モーダル・決済ボタン

**Files:**
- Modify: `app/music-boost/page.tsx`

**注意:** 既存の state・useEffect・`handleCancel`・チュートリアルUI・プラン一覧レンダリングは変更しない。追加と局所的な置き換えのみ。

- [ ] **Step 1: 新規 state を `tutorialStep` state の直後に追加する**

```typescript
  const [epBalance, setEpBalance]       = useState<number | null>(null);
  const [confirmPlan, setConfirmPlan]   = useState<typeof PLANS[number] | null>(null);
```

- [ ] **Step 2: EP残高取得 useEffect を `userId` 依存の既存 useEffect の直後に追加する**

```typescript
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/wallet/balance?id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setEpBalance(Number(d.ep ?? 0)); })
      .catch(() => {});
  }, [userId]);
```

- [ ] **Step 3: `handleSubscribe` に `paymentMethod` 引数を追加する**

現在：
```typescript
  const handleSubscribe = async (planId: string) => {
```

変更後：
```typescript
  const handleSubscribe = async (planId: string, paymentMethod = "ep") => {
```

`body: JSON.stringify({ userId, planId })` を以下に変更する：
```typescript
        body: JSON.stringify({ userId, planId, paymentMethod }),
```

エラーハンドリングに `insufficient_ep` ケースを追加する（`no_slots_available` の `else if` の後）：

```typescript
        else if (data.error === "insufficient_ep") setMsg(`❌ EPが不足しています（残り${data.balance} EP、必要${data.needed} EP）`);
```

- [ ] **Step 4: EP残高表示を説明エリアに追加する**

既存の説明エリア `<div className="bg-white/5 rounded-xl p-4 mb-6 text-sm text-white/60">` 内の最後の `<p>` の後に追加する：

```tsx
        {epBalance !== null && (
          <p className="mt-2 text-white/50 text-xs font-bold">
            現在のEP残高: <span className="text-purple-300">{epBalance.toLocaleString()} EP</span>
          </p>
        )}
```

- [ ] **Step 5: プラン展開エリアのボタン部分を差し替える**

現在（`selected === plan.id && !isCurrent` ブロック内の button）：

```tsx
              {selected === plan.id && !isCurrent && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSubscribe(plan.id); }}
                  disabled={busy || !canAfford}
                  className={`w-full mt-3 py-2 rounded-lg text-sm font-bold transition ${
                    canAfford
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}>
                  {busy ? "処理中..." : canAfford ? `${plan.label}プランを契約` : "枠不足"}
                </button>
              )}
```

変更後：

```tsx
              {selected === plan.id && !isCurrent && (
                <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                  {/* EP決済ボタン */}
                  {(() => {
                    const epCost      = plan.price * 100;
                    const hasEnoughEp = epBalance !== null && epBalance >= epCost;
                    const epDisabled  = busy || !canAfford || !hasEnoughEp;
                    return (
                      <button
                        onClick={() => setConfirmPlan(plan)}
                        disabled={epDisabled}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition ${
                          !canAfford
                            ? "bg-white/10 text-white/30 cursor-not-allowed"
                            : !hasEnoughEp
                            ? "bg-white/10 text-red-400/70 cursor-not-allowed"
                            : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"
                        }`}>
                        {busy
                          ? "処理中..."
                          : !canAfford
                          ? "枠不足"
                          : !hasEnoughEp
                          ? `EP不足（残り ${epBalance?.toLocaleString() ?? "?"} EP）`
                          : `EPで支払う（${epCost.toLocaleString()} EP）`}
                      </button>
                    );
                  })()}
                  {/* クレジットカードボタン（準備中） */}
                  <button
                    disabled
                    className="w-full py-2 rounded-lg text-sm font-bold bg-white/5 text-white/20 cursor-not-allowed border border-white/10 flex items-center justify-center gap-2">
                    <span>💳 クレジットカード</span>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">準備中</span>
                  </button>
                </div>
              )}
```

- [ ] **Step 6: 確認モーダルを JSX の末尾（チュートリアルオーバーレイの直前）に追加する**

`{/* ── チュートリアルオーバーレイ ──────────────────────────────────── */}` の直前に挿入する：

```tsx
      {/* ── EP決済確認モーダル ─────────────────────────────────────── */}
      {confirmPlan !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setConfirmPlan(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-[#18181b] border border-white/10 p-7 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-extrabold text-white mb-5 text-center">ご確認ください</h2>

            <div className="space-y-3 text-sm text-white/70">
              <div className="flex justify-between">
                <span>プラン</span>
                <span className="font-bold text-white">{confirmPlan.label}（{confirmPlan.percent}%）</span>
              </div>
              <div className="flex justify-between">
                <span>費用</span>
                <span className="font-bold text-purple-300">{(confirmPlan.price * 100).toLocaleString()} EP</span>
              </div>
              <div className="flex justify-between">
                <span>有効期間</span>
                <span className="font-bold text-white">30日間</span>
              </div>
              <div className="flex justify-between">
                <span>有効期限</span>
                <span className="font-bold text-white">
                  {(() => {
                    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
                  })()}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-xs text-yellow-300/80 leading-relaxed">
              ⚠️ 本機能は収益・利益を保証するものではありません。<br />
              Music Boost は認知拡大を目的とした広告サービスです。<br />
              期限到来後は自動更新されません。
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirmPlan(null)}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5 transition">
                キャンセル
              </button>
              <button
                onClick={() => {
                  const plan = confirmPlan;
                  setConfirmPlan(null);
                  handleSubscribe(plan.id, "ep");
                }}
                disabled={busy}
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-50">
                確認して支払う
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 7: コミット**

```bash
git add app/music-boost/page.tsx
git commit -m "feat(ui): Music Boost にEP残高・確認モーダル・決済ボタン2種を追加"
```

---

### Task 6: フロント — `admin/page.tsx` MemberRow・SortTh・ソート・Boost列

**Files:**
- Modify: `app/admin/page.tsx`

**注意:** 既存の `Th`・`Td` コンポーネント、`MemberRow` 型の既存フィールドは変更しない。追加のみ。

- [ ] **Step 1: `MemberRow` 型に boost フィールドを追加する**

現在の `MemberRow` 型の末尾（`last_login_at: string;` の後）に追加する：

```typescript
  music_boost_plan?: string | null;
  music_boost_expires_at?: string | null;
```

- [ ] **Step 2: `SortTh` コンポーネントを `Td` の直後に追加する（`EmptyState` の前）**

```tsx
function SortTh({
  children, sortKey, currentSortKey, currentSortOrder, onSort, className,
}: {
  children: React.ReactNode;
  sortKey: string;
  currentSortKey: string;
  currentSortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <th
      className={clsx(
        "whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-zinc-400 cursor-pointer select-none hover:text-zinc-200 transition",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      {children}
      <span className="ml-1 text-zinc-600">
        {isActive ? (currentSortOrder === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );
}
```

- [ ] **Step 3: ソート state を `membersLoading` state の直後に追加する**

```typescript
  const [membersSortKey,   setMembersSortKey]   = useState<string>("created_at");
  const [membersSortOrder, setMembersSortOrder] = useState<"asc" | "desc">("desc");
```

- [ ] **Step 4: `loadMembers` 関数を更新して `sortKey` / `sortOrder` をクエリに追加する**

現在：
```typescript
  const loadMembers = async (page = 0) => {
    setMembersLoading(true);
    try {
      const res  = await fetch(`/api/admin/members?page=${page}&pageSize=${PAGE_SIZE}`, { credentials: "include", cache: "no-store" });
```

変更後：
```typescript
  const loadMembers = async (page = 0, sortKey = membersSortKey, sortOrder = membersSortOrder) => {
    setMembersLoading(true);
    try {
      const res  = await fetch(
        `/api/admin/members?page=${page}&pageSize=${PAGE_SIZE}&sortKey=${encodeURIComponent(sortKey)}&sortOrder=${encodeURIComponent(sortOrder)}`,
        { credentials: "include", cache: "no-store" }
      );
```

- [ ] **Step 5: ソートハンドラー `handleMembersSort` を `loadMembers` の直後に追加する**

```typescript
  const handleMembersSort = (key: string) => {
    const nextOrder = membersSortKey === key && membersSortOrder === "desc" ? "asc" : "desc";
    setMembersSortKey(key);
    setMembersSortOrder(nextOrder);
    loadMembers(0, key, nextOrder);
  };
```

- [ ] **Step 6: テーブルのヘッダー行を更新する（ソート可能列を `SortTh` に変更、Boost列を追加）**

現在のヘッダー行：
```tsx
                    <tr>
                      <Th>ログインID</Th>
                      <Th>氏名</Th>
                      <Th>プラン</Th>
                      <Th>サブスク</Th>
                      <Th>BP残高</Th>
                      <Th>EP残高</Th>
                      <Th>連続ログイン</Th>
                      <Th>累計ログイン</Th>
                      <Th>最終ログイン</Th>
                      <Th>ステータス</Th>
                    </tr>
```

変更後（`Th` はそのまま、ソート対象列のみ `SortTh` に変更、末尾に Music Boost 列追加）：

```tsx
                    <tr>
                      <Th>ログインID</Th>
                      <Th>氏名</Th>
                      <Th>プラン</Th>
                      <Th>サブスク</Th>
                      <SortTh sortKey="bp_balance"        currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>BP残高</SortTh>
                      <SortTh sortKey="ep_balance"        currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>EP残高</SortTh>
                      <SortTh sortKey="login_streak"      currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>連続ログイン</SortTh>
                      <SortTh sortKey="total_login_count" currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>累計ログイン</SortTh>
                      <SortTh sortKey="last_login_at"     currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>最終ログイン</SortTh>
                      <Th>ステータス</Th>
                      <Th>Music Boost</Th>
                    </tr>
```

- [ ] **Step 7: テーブルのデータ行に Music Boost 列を追加する**

現在のデータ行の末尾（`<Td><span ...>{m.status}</span></Td>` の後）に追加する：

```tsx
                        <Td>
                          {m.music_boost_plan ? (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                                {m.music_boost_plan}
                              </span>
                              {m.music_boost_expires_at && (
                                <span className="text-[10px] text-zinc-500">
                                  〜{new Date(m.music_boost_expires_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </Td>
```

- [ ] **Step 8: `min-w-[900px]` を `min-w-[1100px]` に変更して横スクロール余裕を確保する**

```tsx
                <table className="w-full min-w-[1100px] text-left">
```

- [ ] **Step 9: コミット**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): 会員一覧にMusic Boost列・サーバーサイドソートを追加"
```

---

## 動作確認チェックリスト

- [ ] Music Boost ページでEP残高が表示される
- [ ] プランを選択したとき「EPで支払う（XXX EP）」ボタンと「クレジットカード 準備中」ボタンが表示される
- [ ] EP不足のときボタンが無効化される
- [ ] 「EPで支払う」を押すと確認モーダルが開く
- [ ] モーダルにプラン・費用・期限・免責事項が表示される
- [ ] 「確認して支払う」でEPが差し引かれてブーストが有効化される
- [ ] `wallet_ledger` に `kind: "music_boost_ep"` のレコードが追加される
- [ ] 管理画面の会員一覧に「Music Boost」列が表示される
- [ ] ブースト中の会員にはプランIDと期限が表示される
- [ ] BP残高・EP残高・連続/累計ログイン・最終ログイン列のヘッダークリックでソートが切り替わる
- [ ] ソート後に1ページ目に戻る
