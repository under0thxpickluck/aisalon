# Music Boost アーティスト情報フォーム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Music Boost 契約中のユーザーがブースト対象のアーティスト名・楽曲名を登録・編集でき、管理者が admin ページでリアルタイムに確認できるようにする。

**Architecture:** GAS の applies シートに `music_boost_artist` / `music_boost_album` カラムを追加し、新規 API エンドポイント `/api/music-boost/info` (GET/PATCH) 経由で読み書きする。music-boost ページはブースト契約中のみ 2 カラムに広がり、右側にアーティスト情報フォームを表示する。admin ページは `admin_get_members` レスポンスにこの 2 フィールドを追加して表示する。

**Tech Stack:** Next.js 14 App Router, TypeScript, Google Apps Script, Tailwind CSS

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | 修正 | `music_boost_get_info` / `music_boost_update_info` 追加、`admin_get_members` に 2 フィールド追加 |
| `app/api/music-boost/info/route.ts` | 新規作成 | GET / PATCH エンドポイント |
| `app/music-boost/page.tsx` | 修正 | チュートリアル追加・2 カラム化・フォーム追加 |
| `app/admin/page.tsx` | 修正 | `MemberRow` 型追加・artist/album 表示 |

---

## Task 1: GAS — `boost_get_info` / `boost_update_info` アクション追加

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1: アクションディスパッチャーに 2 行追加**

`gas/Code.gs` の以下の行を探す（`music_boost_cancel` の行のすぐ下）:
```javascript
    if (action === 'music_boost_cancel')     return musicBoostCancel_(body);
    if (action === 'music_boost_admin_list') return musicBoostAdminList_(body);
```

この 2 行の直後に追加:
```javascript
    if (action === 'music_boost_get_info')    return musicBoostGetInfo_(body);
    if (action === 'music_boost_update_info') return musicBoostUpdateInfo_(body);
```

- [ ] **Step 2: `admin_get_members` のレスポンスオブジェクトに 2 フィールド追加**

`gas/Code.gs` の以下の行を探す:
```javascript
        music_boost_expires_at: boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].expires_at : null,
```

この行の直後（`});` の前）に追加:
```javascript
        music_boost_artist:     str_(r[idx["music_boost_artist"]] || ""),
        music_boost_album:      str_(r[idx["music_boost_album"]]  || ""),
```

結果（変更後のブロック）:
```javascript
      approved.push({
        login_id:          str_(r[idx["login_id"]]),
        name:              str_(r[idx["name"]]),
        email:             str_(r[idx["email"]]),
        plan:              str_(r[idx["plan"]]),
        status:            "approved",
        created_at:        r[idx["created_at"]] ? new Date(r[idx["created_at"]]).toISOString() : "",
        bp_balance:        Number(r[idx["bp_balance"]] || 0),
        ep_balance:        Number(r[idx["ep_balance"]] || 0),
        login_streak:      Number(r[idx["login_streak"]] || 0),
        total_login_count: Number(r[idx["total_login_count"]] || 0),
        subscription_plan: str_(r[idx["subscription_plan"]]),
        last_login_at:     r[idx["last_login_at"]] ? new Date(r[idx["last_login_at"]]).toISOString() : "",
        music_boost_plan:       boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].plan_id    : null,
        music_boost_expires_at: boostMap[str_(r[idx["login_id"]])] ? boostMap[str_(r[idx["login_id"]])].expires_at : null,
        music_boost_artist:     str_(r[idx["music_boost_artist"]] || ""),
        music_boost_album:      str_(r[idx["music_boost_album"]]  || ""),
      });
```

- [ ] **Step 3: `musicBoostGetInfo_` 関数を追加**

`gas/Code.gs` のファイル末尾（最後の `}` の前）または `musicBoostAdminList_` 関数の直後に追加:

```javascript
// action: music_boost_get_info（アーティスト・楽曲情報取得）
function musicBoostGetInfo_(params) {
  var userId = String(params.userId || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });
  var sheet  = getOrCreateSheet_();
  var values = getValuesSafe_(sheet);
  var header = values[0];
  ensureCols_(sheet, header, ["music_boost_artist", "music_boost_album"]);
  var idx = indexMap_(header);
  for (var i = 1; i < values.length; i++) {
    if (str_(values[i][idx["login_id"]]) === userId) {
      return json_({
        ok:     true,
        artist: str_(values[i][idx["music_boost_artist"]] || ""),
        album:  str_(values[i][idx["music_boost_album"]]  || ""),
      });
    }
  }
  return json_({ ok: false, error: "user_not_found" });
}
```

- [ ] **Step 4: `musicBoostUpdateInfo_` 関数を追加**

`musicBoostGetInfo_` の直後に追加:

```javascript
// action: music_boost_update_info（アーティスト・楽曲情報更新）
function musicBoostUpdateInfo_(params) {
  var userId = String(params.userId || "");
  var artist = String(params.artist || "");
  var album  = String(params.album  || "");
  if (!userId) return json_({ ok: false, error: "userId_required" });
  var sheet  = getOrCreateSheet_();
  var values = getValuesSafe_(sheet);
  var header = values[0];
  ensureCols_(sheet, header, ["music_boost_artist", "music_boost_album"]);
  // ensureCols_ がカラムを追加した可能性があるため再読み込み
  values = getValuesSafe_(sheet);
  header = values[0];
  var idx = indexMap_(header);
  for (var i = 1; i < values.length; i++) {
    if (str_(values[i][idx["login_id"]]) === userId) {
      sheet.getRange(i + 1, idx["music_boost_artist"] + 1).setValue(artist);
      sheet.getRange(i + 1, idx["music_boost_album"]  + 1).setValue(album);
      return json_({ ok: true });
    }
  }
  return json_({ ok: false, error: "user_not_found" });
}
```

- [ ] **Step 5: GAS をデプロイ**

GAS エディタで「デプロイ」→「デプロイを管理」→「新しいバージョンでデプロイ」。

- [ ] **Step 6: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add music_boost_get_info / update_info actions and artist fields to admin_get_members"
```

---

## Task 2: API エンドポイント `/api/music-boost/info` 新規作成

**Files:**
- Create: `app/api/music-boost/info/route.ts`

- [ ] **Step 1: ファイルを新規作成**

`app/api/music-boost/info/route.ts` を以下の内容で作成:

```typescript
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

async function callGas(bodyObj: object) {
  const bodyStr = JSON.stringify(bodyObj);
  const url     = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  const res     = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) },
    body: bodyStr,
    redirect: "follow",
    cache: "no-store",
  });
  return res.json();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  try {
    return NextResponse.json(await callGas({ action: "music_boost_get_info", key: GAS_API_KEY, userId }));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const { userId, artist, album } = body ?? {};
  if (!userId) return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  try {
    return NextResponse.json(
      await callGas({ action: "music_boost_update_info", key: GAS_API_KEY, userId, artist: artist ?? "", album: album ?? "" })
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add app/api/music-boost/info/route.ts
git commit -m "feat(api): add /api/music-boost/info GET and PATCH endpoints"
```

---

## Task 3: Music Boost ページ — チュートリアル追加・2 カラム化・フォーム追加

**Files:**
- Modify: `app/music-boost/page.tsx`

- [ ] **Step 1: チュートリアルスライドを追加**

`app/music-boost/page.tsx` の `BOOST_TUTORIAL_SLIDES` 配列の最後の要素（`"Music Boostを始める"` スライド）の**直前**に追加:

```typescript
  {
    icon: "🎵",
    title: "配信したい楽曲を登録しよう",
    body: `契約後に表示されるフォームから、ブーストしたいアーティスト名と楽曲名を入力できます。\n\n入力内容は運営に即時反映されます。\n\n✏️ いつでも変更可能\n契約期間中は何度でも更新できます。`,
  },
```

追加後、`BOOST_TUTORIAL_SLIDES` は 6 枚になる。`as const` はそのまま維持。

- [ ] **Step 2: state 変数を追加**

`app/music-boost/page.tsx` の既存 state 宣言群（`const [confirmPlan, ...]` の直後）に追加:

```typescript
  const [artist, setArtist]         = useState("");
  const [album, setAlbum]           = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoLog, setInfoLog]       = useState("");
```

- [ ] **Step 3: 初期値ロードの useEffect を追加**

既存の `useEffect`（wallet balance を取得するもの）の直後に追加:

```typescript
  useEffect(() => {
    if (!userId || !status?.current_boost) return;
    fetch(`/api/music-boost/info?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) { setArtist(d.artist ?? ""); setAlbum(d.album ?? ""); } })
      .catch(() => {});
  }, [userId, status]);
```

- [ ] **Step 4: 保存ハンドラーを追加**

`handleCancel` 関数の直後に追加:

```typescript
  const handleSaveInfo = async () => {
    if (infoSaving) return;
    setInfoSaving(true);
    setInfoLog("変更を保存しています...");
    try {
      const res  = await fetch("/api/music-boost/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, artist, album }),
      });
      const data = await res.json();
      setInfoLog(data.ok ? "✅ 保存しました" : "❌ 保存に失敗しました");
    } catch {
      setInfoLog("❌ 通信エラー");
    } finally {
      setInfoSaving(false);
      setTimeout(() => setInfoLog(""), 2000);
    }
  };
```

- [ ] **Step 5: JSX — ルートの div をブースト中に 2 カラム化**

`return (` 直後の最外 div を以下のように変更:

**変更前:**
```tsx
    <div className={`min-h-screen ${th.page} px-4 py-8 max-w-lg mx-auto`}>
```

**変更後:**
```tsx
    <div className={`min-h-screen ${th.page} px-4 py-8 mx-auto transition-all ${status?.current_boost ? "max-w-3xl" : "max-w-lg"}`}>
      <div className={`${status?.current_boost ? "flex gap-8 items-start" : ""}`}>
```

そして `return` ブロックの最後（`</div>` の閉じタグ）直前（チュートリアルオーバーレイの**外側**）に閉じタグを追加:

```tsx
      </div>{/* flex wrapper */}
```

つまり、`{/* ── チュートリアルオーバーレイ ──...*/}` のブロックはフレックスラッパーの**外**に置く。

- [ ] **Step 6: JSX — 既存コンテンツを左カラムの div で囲む**

ヘッダーから `{/* 注意書き */}` ブロックの末尾まで（`</div>` まで）を以下で囲む:

```tsx
        <div className={status?.current_boost ? "flex-1 min-w-0" : ""}>
          {/* ヘッダー */}
          ...（既存コンテンツをすべてここへ）...
          {/* 注意書き */}
        </div>
```

- [ ] **Step 7: JSX — 右カラム（アーティスト情報フォーム）を追加**

左カラムの `</div>` の直後、フレックスラッパーの `</div>` の直前に追加:

```tsx
        {status?.current_boost && (
          <div className={`w-72 shrink-0 ${th.card} border ${th.cardBorder} rounded-2xl p-5`}>
            <h2 className="font-bold text-sm mb-4">🎵 配信楽曲情報</h2>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${th.muted} block mb-1`}>アーティスト名</label>
                <input
                  type="text"
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  placeholder="例: 山田太郎"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${th.inputBg}`}
                />
              </div>
              <div>
                <label className={`text-xs ${th.muted} block mb-1`}>楽曲名</label>
                <input
                  type="text"
                  value={album}
                  onChange={e => setAlbum(e.target.value)}
                  placeholder="例: 夜明けのメロディ"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${th.inputBg}`}
                />
              </div>
              <button
                onClick={handleSaveInfo}
                disabled={infoSaving}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {infoSaving ? "保存中..." : "編集完了"}
              </button>
              {infoLog && (
                <p className={`text-xs text-center ${infoLog.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
                  {infoLog}
                </p>
              )}
            </div>
          </div>
        )}
```

- [ ] **Step 8: 動作確認**

```bash
npm run dev
```

ブラウザで `/music-boost` を開き:
1. ブースト未契約時 → シングルカラム、右フォームなし
2. ブースト契約後 → 2 カラムになり右にフォームが出る
3. アーティスト名・楽曲名を入力して「編集完了」→「変更を保存しています...」→「✅ 保存しました」が表示される

- [ ] **Step 9: コミット**

```bash
git add app/music-boost/page.tsx
git commit -m "feat(music-boost): 2カラム化・アーティスト情報フォーム・チュートリアルスライド追加"
```

---

## Task 4: Admin ページ — artist / album フィールドの表示

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: `MemberRow` 型に 2 フィールドを追加**

`app/admin/page.tsx` の `MemberRow` 型（`music_boost_expires_at` の行の直後）に追加:

```typescript
  music_boost_artist?: string | null;
  music_boost_album?: string | null;
```

- [ ] **Step 2: 表示セルに artist / album を追記**

`app/admin/page.tsx` で `music_boost_plan` を表示している `<Td>` ブロックを探す:

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
```

このブロックの `</span>` （`inline-flex` の閉じタグ）の直前に追加:

```tsx
                              {m.music_boost_artist && (
                                <span className="text-[10px] text-zinc-400">
                                  🎤 {m.music_boost_artist}
                                </span>
                              )}
                              {m.music_boost_album && (
                                <span className="text-[10px] text-zinc-400">
                                  🎵 {m.music_boost_album}
                                </span>
                              )}
```

- [ ] **Step 3: 動作確認**

```bash
npm run dev
```

ブラウザで `/admin` → Members タブを開き、ブースト契約済みかつアーティスト情報入力済みのユーザーの行に `🎤 アーティスト名` と `🎵 楽曲名` が表示されることを確認。

- [ ] **Step 4: コミット**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): music boostカラムにアーティスト名・楽曲名を表示"
```
