# ランブル改修（ランブル換算）設計仕様

**日付**: 2026-04-02  
**対象機能**: LIFAI Rumble League  
**目的**: 日次BP報酬を「RPを重みにした抽選方式」に変更し、観戦モードを確定済み結果の演出表示に改修する

---

## 背景・目的

現状は参加時RPの累計で勝敗がほぼ読めてしまい、観戦モードの意味が薄い。日次BP報酬を「RPを重みにした重み付き非復元抽選」に変更することで、高RP者が有利ではあるが確実に勝てない緊張感を生み出す。週次EP報酬は現行維持。

---

## 確定仕様（ramblekansen.md 準拠）

1. 参加は100BP、1日1回
2. 参加時にRPを内部確定（公開しない）
3. RP計算式：`RP = 100 + level×2 + equipBonus（上限50） + randomFactor（0〜50）`
4. 毎日19:00 JSTの締切後、その日の参加者から日次BP報酬当選者を決定
5. 当選方式は重み付き非復元抽選
6. 重み：`weight = Math.floor(Math.sqrt(RP) * 1000)`（整数化で再現性確保）
7. 1位〜5位まで順番に抽選、当選者は都度除外（参加者5人未満は人数に応じて縮小）
8. 日次BP報酬：1位1000BP / 2位700BP / 3位400BP / 4位250BP / 5位200BP
9. 週次EP報酬（月〜金累計RPランキング）は現行維持、wallet_ledger記録を追加
10. 観戦モード：既存バトル演出を維持し、終了後に確定済み抽選結果を追加表示
11. 観戦中はRP詳細・weight・抽選ロジックを非表示
12. 抽選結果は seed = sha256(date + RUMBLE_SALT) で再現可能
13. 日次報酬配布は冪等（同日二重配布不可）
14. wallet_ledger に日次BP・週次EP報酬を記録

---

## Section 1：データ層

### 新シート `rumble_daily_result`

| 列名 | 型 | 内容 |
|---|---|---|
| `date` | YYYY-MM-DD | 対象日 |
| `seed` | string | sha256(date + RUMBLE_SALT) |
| `rank` | number | 1〜5 |
| `user_id` | string | 当選者ID |
| `display_name` | string | 当選者表示名 |
| `rp` | number | 当選者RP（内部保存のみ、APIには返さない） |
| `weight` | number | 抽選時の重み（Math.floor(sqrt(rp)×1000)） |
| `bp_amount` | number | 配布BP（1000/700/400/250/200） |
| `distributed` | boolean | 配布済みフラグ |
| `participant_count` | number | 当日参加者数 |
| `created_at` | ISO | 記録日時 |

### 冪等性判定ロジック

```
該当dateの全行を取得
→ rank1〜winnerCount がすべて存在
→ かつ全行 distributed=true
→ 上記を満たす場合のみスキップ
→ それ以外は未完了として再実行
```

### データ整合ルール

- `(date, rank)` の重複行禁止
- rankごとに1行で書き込み
- 途中失敗→再実行可能（部分書き込み状態を許容し、再実行で補完）
- `distributed=true` への更新はBP付与成功後のみ

### wallet_ledger 追加エントリ

| kind | 内容 |
|---|---|
| `rumble_daily_bp` | 日次BP報酬（amount: 1000/700/400/250/200） |
| `rumble_weekly_ep` | 週次EP報酬（amount: 1500/1000/700/400/80/10） |

---

## Section 2：GASロジック

### 新規関数：`rumbleDailyLottery_(date)`

```
1. rumble_entry から date一致 かつ created_at <= 当日19:00:00 JST の参加者取得
2. 参加者ゼロなら即終了
3. 冪等性チェック：rank1〜winnerCount全存在 かつ 全distributed=true → スキップ
4. seed = sha256(date + RUMBLE_SALT)  ← ScriptProperties "RUMBLE_SALT"
5. seededRandom_(seed) で xorshift系RNG生成
6. weight = Math.floor(Math.sqrt(rp) * 1000) で各参加者の重みを整数計算
7. winnerCount = Math.min(5, participants.length)
8. 1位〜winnerCount位まで1人ずつ以下を実行：
   a. rumble_daily_result に書き込み（distributed=false）
      既存行あれば更新、なければ新規追加
   b. applies.bp_balance にBP付与
   c. wallet_ledger に rumble_daily_bp 記録
   d. distributed=true に更新
9. Logger.log出力：date / participant_count / winnerCount / 各rank詳細
```

### 新規関数：`seededRandom_(seed)`

```javascript
// xorshiftベースRNG（32bit）
function seededRandom_(seed) {
  let x = seedToInt_(seed); // sha256を数値化（先頭8桁16進数→parseInt）
  return function() {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
```

同一seedで必ず同一の抽選結果を再現可能。

### 修正関数：`rumbleRewardDistribute_()` → 週次EP

既存ロジックを維持しつつ以下を追加：
- 冪等性チェック（weekIdで配布済み確認）
- wallet_ledger に `rumble_weekly_ep` を記録

### GASタイムトリガー設定

| トリガー関数 | タイミング |
|---|---|
| `rumbleDailyLotteryTrigger_` | 毎日 19:00〜20:00 JST |
| `rumbleWeeklyRewardTrigger_` | 金曜 23:00〜24:00 JST |

### ScriptProperties 追加

| キー | 内容 |
|---|---|
| `RUMBLE_SALT` | seed生成用秘密鍵（管理者が設定、外部非公開） |

---

## Section 3：APIルート＆フロントエンド

### 新規APIルート：`GET /api/minigames/rumble/daily-result/route.ts`

**クエリ**: `?date=YYYY-MM-DD`（省略時はJSTの今日を自動採用）

```typescript
const date = searchParams.get("date") ?? getTodayJST();
const isToday = date === getTodayJST();
```

**GAS action**: `rumble_daily_result`（新規追加）

**status判定**（厳格）:
- `"ready"`: rank1〜winnerCount 全存在 かつ 全 `distributed=true`
- `"pending"`: それ以外すべて（部分書き込み・GAS未実行・データなし含む）

**返却フォーマット**:

```typescript
// 共通フィールド
{
  status: "pending" | "ready",
  date: string,
  participant_count: number,
  winnerCount: number,
  isToday: boolean
}

// pending 時に追加
{
  participants: Array<{ user_id: string; display_name: string }>
  // created_at昇順ソート
}

// ready 時に追加
{
  replay_seed: string,  // sha256ハッシュのみ（RUMBLE_SALTは絶対含めない）
  winners: Array<{ rank: number; user_id: string; display_name: string; bp_amount: number }>
  // rank昇順ソート、rp/weightは含めない
}
```

**エラー時**: すべて `status: "pending"` として返す（500エラーを外部に露出しない）

**セキュリティ**:
- `RUMBLE_SALT` は絶対に返さない
- `rp` / `weight` はAPIレスポンスに含めない
- `replay_seed`（sha256ハッシュ）のみ公開

---

### 観戦UI変更（`app/mini-games/rumble/page.tsx`）

#### `status: "pending"` 時
```
本日の参加人数: ◯人
[参加者一覧] display_nameのみ表示
抽選は19:00以降に実施されます
```
禁止事項: RP表示・勝敗表示・weight表示

#### `status: "ready"` 時
```
1. 既存のバトル演出をそのまま再生（変更なし）
2. 再生完了後に当選者発表セクションを追加表示：
   🏆 1位: ○○ → 1000BP
   🥈 2位: ○○ → 700BP
   🥉 3位: ○○ → 400BP
      4位: ○○ → 250BP
      5位: ○○ → 200BP
```
禁止事項: RP・weight・抽選ロジックの表示

**「もう一度見る」ボタン**: 既存ロジック維持、`replay_seed` を使って再生

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gas/Code.gs` | 修正・追加 | `rumbleDailyLottery_`, `seededRandom_`, `seedToInt_`, `rumbleWeeklyReward_`修正, GAS action `rumble_daily_result` 追加 |
| `app/api/minigames/rumble/daily-result/route.ts` | 新規作成 | 日次抽選結果取得API |
| `app/mini-games/rumble/page.tsx` | 修正 | 観戦タブUI（pending/ready分岐、当選者発表セクション追加） |

---

## 実装上の注意

- 既存コード・API・構造は削除・省略しない
- 修正は指示箇所のみに限定
- GAS側はScriptLockで排他制御（既存の`rumbleEntry_`と同様）
- GASタイムトリガーは±1時間の誤差があるため、締切フィルタ（created_at <= 19:00 JST）で厳密に管理
- 週次EP報酬の既存ロジック（ランク→EP額のマッピング）は変更しない
