# Rumble 週次報酬表示 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 週次EP報酬を「予測（月〜金18:50前）→ 確定（金曜18:50以降）」の2段階で表示し、参加人数取得を `ranking.length` 依存から脱却する

**Architecture:** GAS の `rumbleStatus_` に `week_participant_count` を追加し、フロントは status fetch 時にその値をStateで保持。カウントダウン計算の中で「金曜かつ18:50以降」フラグを更新。報酬帯UIはこの2つのStateを使って予測/確定を切り替える。

**Tech Stack:** Google Apps Script (GAS), Next.js 14 App Router, TypeScript, Tailwind CSS

---

## 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | 修正 | `rumbleStatus_()` line 7054付近：`week_participant_count` をレスポンスに追加 |
| `app/mini-games/rumble/page.tsx` | 修正 | State追加・status fetch・calcCountdown・報酬帯UI |

---

## Task 1: GAS `rumbleStatus_` に `week_participant_count` を追加

**Files:**
- Modify: `gas/Code.gs:7022-7064`

- [ ] **Step 1: `weekData` ループ内で週参加人数をカウントする変数を追加**

`gas/Code.gs` の `rumbleStatus_` 関数、`weekRp` を求めるループ（現在 line 7030〜7036）を以下に置き換える：

```javascript
  var weekRp = 0;
  var weekParticipantCount = 0;
  for (var j = 1; j < weekData.length; j++) {
    if (String(weekData[j][wIdx["week_id"]]) === weekId) {
      weekParticipantCount++;
      if (String(weekData[j][wIdx["user_id"]]) === userId) {
        weekRp = Number(weekData[j][wIdx["total_rp"]] || 0);
      }
    }
  }
```

- [ ] **Step 2: `return json_({...})` に `week_participant_count` を追加**

line 7054〜7063 の `return json_({...})` を以下に置き換える：

```javascript
  return json_({
    ok:                    true,
    entered_today:         todayEntry !== null,
    today_score:           todayEntry ? todayEntry.score : null,
    today_rp:              todayEntry ? todayEntry.rp    : null,
    week_rp:               weekRp,
    week_id:               weekId,
    bp_balance:            bpBalance,
    display_name:          displayName,
    week_participant_count: weekParticipantCount,
  });
```

- [ ] **Step 3: 動作確認**

GAS エディタで `rumbleStatus_` を直接テストするか、ローカルで以下を実行して `week_participant_count` が返ることを確認：

```
GET /api/minigames/rumble/status?userId=<自分のID>
→ レスポンスに week_participant_count: <数値> が含まれること
```

- [ ] **Step 4: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(rumble): rumbleStatus_にweek_participant_countを追加"
```

---

## Task 2: フロント State 追加・status fetch に week_participant_count を反映

**Files:**
- Modify: `app/mini-games/rumble/page.tsx`

- [ ] **Step 1: State 2つを追加**

`page.tsx` のState宣言群（`const [isAfter1850Jst, ...]` の近く）に以下を追加：

```typescript
const [weekParticipantCount, setWeekParticipantCount] = useState(0);
const [isFriAfter1850Jst,   setIsFriAfter1850Jst]    = useState(false);
```

- [ ] **Step 2: status fetch 時に `week_participant_count` を取得**

`page.tsx` の status fetch `useEffect`（`fetch('/api/minigames/rumble/status?userId=...')` のコールバック）内、`if (d.bp_balance !== undefined) ...` の近くに以下を追加：

```typescript
if (d.week_participant_count !== undefined) {
  setWeekParticipantCount(d.week_participant_count);
}
```

- [ ] **Step 3: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): weekParticipantCountとisFriAfter1850JstのState追加"
```

---

## Task 3: カウントダウン計算に「金曜18:50以降」判定を追加

**Files:**
- Modify: `app/mini-games/rumble/page.tsx`

- [ ] **Step 1: `calcCountdown` 内に `isFriAfter1850Jst` の更新を追加**

`calcCountdown` 関数内、`setIsAfter1850Jst(...)` の直後に以下を追加：

```typescript
// 現在時刻の曜日をJSTで取得（UTC環境でもズレない）
const dowJst = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  weekday: "short",
}).format(now);
setIsFriAfter1850Jst(
  dowJst === "金" &&
  (jstHour > 18 || (jstHour === 18 && jstMinute >= 50))
);
```

- [ ] **Step 2: 動作確認方法**

ブラウザの DevTools で `React DevTools` もしくは以下で確認できる（テスト用に一時的に曜日条件を外してtrueになることを検証してもよい）：

```typescript
// 一時テスト用（確認後は削除）
console.log("isFriAfter1850:", dowJst === "金", jstHour, jstMinute);
```

- [ ] **Step 3: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): calcCountdownに金曜18:50以降フラグを追加"
```

---

## Task 4: 報酬帯UIを「予測/確定」2段階表示に変更

**Files:**
- Modify: `app/mini-games/rumble/page.tsx:1078-1107`

- [ ] **Step 1: 報酬帯セクション全体を置き換え**

現在の `{/* 報酬帯 */}` ブロック（`<div className="bg-white/5 rounded-xl p-4">` から `</div>` まで、およそ line 1079〜1107）を以下に置き換える：

```tsx
{/* 報酬帯 */}
<div className="bg-white/5 rounded-xl p-4">
  <div className="flex items-center justify-between mb-2">
    <p className="text-xs font-bold text-white/60">🏆 週次報酬</p>
    {isFriAfter1850Jst
      ? <span className="text-[10px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">✅ 確定</span>
      : <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-full">📊 予測</span>
    }
  </div>
  {(() => {
    const n = weekParticipantCount;
    const tiers = n <= 2
      ? [{ label: "🥇 1位", ep: 400 }, { label: "🥈 2位", ep: 300 }]
      : n <= 4
      ? [{ label: "🥇 1位", ep: 350 }, { label: "🥈 2位", ep: 230 }, { label: "🥉 3位", ep: 120 }]
      : n <= 9
      ? [{ label: "🥇 1位", ep: 300 }, { label: "🥈 2位", ep: 200 }, { label: "🥉 3位", ep: 120 }, { label: "4〜5位", ep: 40 }]
      : [{ label: "🥇 1位", ep: 280 }, { label: "🥈 2位", ep: 190 }, { label: "🥉 3位", ep: 120 }, { label: "4〜5位", ep: 45 }, { label: "6〜10位", ep: 4 }];
    return tiers.map(r => (
      <div key={r.label} className="flex justify-between text-xs py-1">
        <span className="text-white/60">{r.label}</span>
        <span className={`font-bold ${isFriAfter1850Jst ? "text-yellow-400" : "text-yellow-400/50"}`}>
          {r.ep.toLocaleString()} EP
        </span>
      </div>
    ));
  })()}
  <p className="text-[10px] text-white/25 mt-2 pt-2 border-t border-white/10">
    {isFriAfter1850Jst
      ? `今週の参加: ${weekParticipantCount}人`
      : `現在 ${weekParticipantCount}人参加中 / 金曜18:50に確定`
    }
  </p>
</div>
```

- [ ] **Step 2: `ranking.length` を使っていた旧ロジックが残っていないことを確認**

```bash
grep -n "ranking.length" app/mini-games/rumble/page.tsx
```

報酬帯以外で使っている箇所があれば意図的なものなので変更不要。報酬帯の `const n = ranking.length` が消えていることだけ確認。

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/mini-games/rumble` を開き：
- バトルタブの「🏆 週次報酬」に `📊 予測` バッジが表示される
- EP金額が `text-yellow-400/50`（薄い黄色）で表示される
- 下部に「現在 N人参加中 / 金曜18:50に確定」が表示される
- `weekParticipantCount` が0の場合（status未取得）は `≤2` ティアが表示される（これは正常）

- [ ] **Step 4: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): 週次報酬帯を予測/確定の2段階表示に変更"
```

---

## Task 5: RUMBLE_SPECを更新してコミット

**Files:**
- Modify: `RUMBLE_SPEC.md`

- [ ] **Step 1: RUMBLE_SPEC の週次EP報酬セクションに注記を追加**

`RUMBLE_SPEC.md` の「週次EP報酬」セクションにある未解決課題の注記を以下に書き換える（`> **未解決課題...` のブロックを置き換え）：

```markdown
> **表示仕様（2026-04-17実装）:** 月〜金曜18:50前は `📊 予測` ラベル付きで現在参加人数ベースの金額を薄表示。金曜18:50以降に `✅ 確定` ラベルに切り替わり金額がフル表示される。参加人数は `rumble_status` APIの `week_participant_count` フィールドから取得（`ranking.length` 依存を廃止）。
```

- [ ] **Step 2: コミット**

```bash
git add RUMBLE_SPEC.md
git commit -m "docs: RUMBLE_SPEC 週次報酬表示仕様を更新"
```
