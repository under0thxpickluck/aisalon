# Tap Mining バッチ処理アーキテクチャ 設計書
作成日: 2026-04-02
参照仕様: docs/superpowers/plans/tapgame0401.md

---

## 目的

1タップ=1APIコールの現行実装を、クライアント蓄積＋サーバーバッチ確定方式へ移行する。
- API呼び出し数を約1/10に削減
- GAS/Sheets負荷軽減（tap_logs行数 約90%削減）
- タップレスポンスを即時化（APIレイテンシ非同期化）

---

## 変更スコープ

| ファイル | 変更種別 |
|---|---|
| `app/mini-games/tap/page.tsx` | 大幅変更（バッチ化＋パスワードゲート） |
| `app/api/minigames/tap/batch-play/route.ts` | 新規作成 |
| `gas/Code.gs` | 追記（`tapBatchPlay_` + シート2つ追加） |
| `app/api/minigames/tap/play/route.ts` | deprecated コメント追記のみ（削除しない） |

---

## パスワードゲート

- パスワード: `nagoya01@`（ハードコード）
- 認証状態: `sessionStorage.getItem("tap_authed") === "1"`
- ブラウザを閉じるとリセット（再入力が必要）
- `tapAuthed` state が false の間はゲートUIのみ表示

---

## フロント：バッチ処理仕様

### Refs（非state、再レンダリングなし）

| Ref | 役割 |
|---|---|
| `pendingTapsRef` | 未送信タップ数カウンタ |
| `flushTimerRef` | 2秒デバウンスタイマー |
| `isFlushingRef` | 並列flush防止フラグ |
| `sessionIdRef` | ページロード毎に1回生成するセッションID |
| `batchStartRef` | 現バッチの最初のタップ時刻 |
| `maxComboInBatchRef` | バッチ内最大コンボ |
| `userIdRef` | 非同期・クリーンアップ内で安全にuserIdを参照 |

### flush条件

1. `pendingTapsRef >= 10` → 即時flush（明示呼び出し）
2. タップから2秒経過 → デバウンスflush（明示呼び出し）
3. ページ離脱 → 以下の優先順位で送信（後述）
4. コンポーネントunmount → flush試行（完了保証なし）

### 離脱時flush（優先順位）

- **最優先**: `pagehide` イベント
- **補助**: `visibilitychange`（hidden へ遷移時）
- **補助**: `beforeunload`
- 送信方式: `navigator.sendBeacon` が使えれば使う。使えない場合は `fetch(..., { keepalive: true })` で代替
- unmount時のflushは「試行」に留める。完了保証を前提としない

### 楽観的残数（optimisticRemaining）

- タップごとに `-1`（ただし `0` 未満にしない）
- サーバー応答後に必ず実残数（`data.tapsRemaining`）で同期補正する
- `daily_limit_reached` エラー時は `0` に強制セット

### タップ時の即時UI

- `⛏️` フロートアニメーション（金額表示なし）
- `optimisticRemaining` を楽観的に `-1`（`max(0, prev - 1)`）
- コンボ・フィーバーはこれまで通り純クライアント

### flush後のUI更新

- `status.today_taps` / `today_bp` / `today_ep` / `taps_remaining` をサーバー値で上書き
- `rareRewards` があれば RARE演出（既存アニメーション流用）

### 禁止事項（仕様書 §8.3）

- 報酬額のクライアント確定（EP値はサーバー確認後のみ表示）
- 楽観的なEP加算

---

## GAS：tapBatchPlay_() 仕様

### 入力パラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| userId | string | 必須 |
| sessionId | string | ページロード単位の識別子 |
| tapCount | number | バッチ内タップ数（上限50で切り捨て） |
| maxCombo | number | バッチ内最大コンボ |
| startedAt | number | バッチ開始timestamp |
| endedAt | number | バッチ終了timestamp |

### 処理フロー

1. `tapCount > 50` → `suspicious_flag = true`、50に切り捨て
2. `remaining = 500 - today_taps`、`processCount = min(tapCount, remaining)`
3. BP残高チェック → `affordable = min(processCount, floor(bp))`
4. BP一括消費（`-processCount`）
5. 抽選ループ × processCount（既存 REWARD_TABLE 流用）
6. BP/EP一括付与
7. `tap_game` シート更新（`max_combo`・`today_max_combo` を初めて正確に更新）
8. `tap_batch_logs` に1行記録
9. `rare_logs` に レア（EP>=50）のみ個別記録
10. `tap_ticker` にレアを記録（既存と同様）

### 返却データ

```json
{
  "ok": true,
  "processedTapCount": 10,
  "bpCost": 10,
  "bpReward": 2.1,
  "epReward": 4,
  "rareRewards": [],
  "todayTaps": 120,
  "tapsRemaining": 380,
  "bpBalance": 910.1,
  "epBalance": 54,
  "today_bp": 21.5,
  "today_ep": 8
}
```

---

## 新設 Sheets

### tap_batch_logs（tap_logsの集約版）

| カラム | 内容 |
|---|---|
| session_id | バッチ識別子 |
| user_id | ユーザー |
| requested_tap_count | クライアントから送信されたタップ数（切り捨て前） |
| processed_tap_count | 実際に処理したタップ数 |
| bp_cost | 消費BP |
| bp_reward | 獲得BP |
| ep_reward | 獲得EP |
| rare_count | レア数 |
| max_combo | バッチ内最大コンボ |
| suspicious_flag | 異常検知フラグ |
| started_at | バッチ開始 |
| ended_at | バッチ終了 |
| created_at | レコード作成時刻（JST） |

### rare_logs（レア個別記録）

| カラム | 内容 |
|---|---|
| id | UUID |
| user_id | ユーザー |
| reward | EP量 |
| type | "EP" |
| session_id | バッチ識別子 |
| created_at | 発生時刻 |

---

## tapPlay_（旧API）の扱い

- **削除しない**・**挙動を壊さない**
- `gas/Code.gs` の `tapPlay_` の冒頭にコメント追記:
  `// @deprecated: Use tapBatchPlay_ instead. Kept for debug/fallback/rollback only.`
- `app/api/minigames/tap/play/route.ts` の冒頭にコメント追記:
  `// @deprecated: Batch endpoint is /api/minigames/tap/batch-play`
- フロントからの新規参照は追加しない

---

## デイリーボーナス

- GAS側に実装なし。今回のリリースでは**UIを非表示**とする
- 表示したまま付与されないと誤認を招くため、セクションごと削除する
- 将来GAS実装が完了した時点でUIを復活させる

---

## 既存機能への影響なし

- `tap_status` / `tap_ranking` / `tap_ticker` API: 変更なし
- `tap_logs` シート: 既存行はそのまま（新規バッチは `tap_batch_logs` へ）
- コンボ・フィーバーUI: 変更なし

---

## 実装順序

1. GAS: `tapBatchPlay_()` + シート関数 + routing追加 + deprecated コメント
2. API Route: `batch-play/route.ts` 新規作成
3. API Route: `play/route.ts` に deprecated コメント追記
4. Frontend: `tap/page.tsx` バッチ化＋パスワードゲート＋デイリーボーナスUI削除
