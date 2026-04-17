# Rumble 週次報酬表示 設計仕様

**日付**: 2026-04-17  
**対象機能**: Rumble League バトルタブ 週次報酬帯  
**目的**: 週次EP報酬を「予測（月〜金18:50前）→ 確定（金曜18:50以降）」の2段階で表示する

---

## 背景・問題

- 週次報酬は参加人数によってティアが変動するが、参加人数は週が終わるまで増え続ける
- 現状は `isAfter1850Jst`（毎日18:50）で報酬額を公開しており、月〜木に出しても「まだ参加者が増えるのに確定値扱い」になる
- さらに参加人数取得が `ranking.length` 依存（ランキングタブを未開のとき0人扱い）

---

## 確定仕様

### データ層（GAS）

**`rumbleStatus_()` にフィールド追加:**

```js
// rumble_week シートから現在 weekId のユニーク行数をカウント
var weekCount = 0;
for (var i = 1; i < weekData.length; i++) {
  if (String(weekData[i][wIdx["week_id"]]) === weekId) weekCount++;
}
// レスポンスに追加
return json_({ ok: true, ..., week_participant_count: weekCount });
```

- `rumble_week` は参加のたびに upsert されるため、weekId 一致行数 = 今週のユニーク参加者数

### フロントエンド（`app/mini-games/rumble/page.tsx`）

**追加 State:**

```typescript
const [weekParticipantCount, setWeekParticipantCount] = useState(0);
const [isFriAfter1850Jst, setIsFriAfter1850Jst] = useState(false);
```

**`status` fetch 時:**

```typescript
if (d.week_participant_count !== undefined) {
  setWeekParticipantCount(d.week_participant_count);
}
```

**カウントダウン計算内（既存の `calcCountdown` に追記）:**

```typescript
const dow = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", weekday: "short"
}).format(now);
setIsFriAfter1850Jst(dow === "金" && (jstHour > 18 || (jstHour === 18 && jstMinute >= 50)));
```

**ティア計算の参照先変更:**

```typescript
// Before: const n = ranking.length;
const n = weekParticipantCount;
```

**報酬帯 UI:**

```
金曜18:50以降（isFriAfter1850Jst === true）:
  🏆 週次報酬  ✅ 確定
  🥇 1位  XXX EP   ← フル表示（text-yellow-400）
  ...

それ以外（月〜木、または金曜18:50前）:
  🏆 週次報酬  📊 予測
  🥇 1位  XXX EP   ← opacity-50 で薄表示
  ...
  現在 N 人参加 / 金曜18:50に確定
```

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | 修正 | `rumbleStatus_()` に `week_participant_count` を追加 |
| `app/mini-games/rumble/page.tsx` | 修正 | state追加・status fetch・カウントダウン判定・報酬帯UI |

---

## 変更しないもの

- `rumble_week` シート構造
- `rumbleEntry_()` / `rumbleRewardDistribute_()` の既存ロジック
- 他タブ（観戦・ランキング・装備・ガチャ）
- ランキングタブの報酬帯表示（`rankContext.current_tier` 等）

---

## 注意事項

- `week_participant_count` は `status` API 経由で取得するため、ページロード直後から正確な値が使える
- `ranking.length` への依存は報酬帯計算からのみ除去する（ランキング表示自体は変更しない）
- 金曜18:50の判定は既存の `calcCountdown` 内で `isFriAfter1850Jst` を更新する（1秒ごとに再評価）
