# Rumble デバッグ調査メモ
> 作成日: 2026-04-16  
> 症状: 観戦タブに参加者が表示されない / バトルが生成されない

---

## 調査結果サマリー

### 確認済み事実

| 項目 | 結果 |
|---|---|
| `rumble_daily_result` (今日) | `participant_count: 0, participants: []` |
| `rumble_daily_result` (過去7日) | 全日 `participant_count: 0` |
| `rumble_spectator` (今日) | `status: "no_data"` |
| `rumble_run_now` 実行後 | `{ ok: true, date: "2026-04-16" }` ← `distributed` フィールドなし |
| `rumble_status` | **クラッシュ** `ReferenceError: getAppSheet_ is not defined` |
| `rumble_entry` (存在しないユーザー) | `{ ok: false, error: "user_not_found" }` → 正常動作 |

---

## 発見したバグ

### バグ1 【確定・重大】`rumbleStatus_` が常にクラッシュ

**場所**: `gas/Code.gs` 7030行目  
**エラー**: `ReferenceError: getAppSheet_ is not defined`  
**原因**: `getAppSheet_()` という関数が呼ばれているが、Code.gs 全体に定義が存在しない

```js
// gas/Code.gs:7030
var appSheet  = getAppSheet_();  // ← getAppSheet_ は未定義！
```

**影響**:
- `/api/minigames/rumble/status` が常にエラーを返す
- `status.entered_today` が常に undefined → サーバー側での参加確認が不可能
- `status.bp_balance` も取得できない
- エントリーボタンが `!status` で無効化されない（エラーオブジェクトは truthy）
- ユーザーは localStorage の `localEnteredToday` だけで参加状態を把握している

**修正方法**:
```js
// 誤り
var appSheet = getAppSheet_();

// 正しい
var appSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies");
```

---

### バグ2 【確定】`rumble_run_now` の戻り値パースが壊れている

**場所**: `gas/Code.gs` 8413〜8425行目  
**原因**: `json_()` は `ContentService.TextOutput` オブジェクトを返すが、`typeof result` が `"string"` にならないため `JSON.parse` されない

```js
function rumbleRunNow_(params) {
  var result = rumbleDailyLottery_({ ... });
  // json_() は ContentService.TextOutput を返す → typeof は "object"
  var parsed = (typeof result === "string") ? JSON.parse(result) : result;
  // parsed = TextOutput オブジェクト → parsed.ok = undefined → parsed.distributed = undefined
  return json_({ ok: parsed.ok !== false, ... distributed: parsed.distributed });
  // 結果: ok は常に true, distributed は常に undefined
}
```

**影響**:
- 管理者が「バトル実行」を押すと、ロッテリーが成功しても失敗しても `{ ok: true, date: "...", distributed: undefined }` が返る
- 管理者がエラーに気付けない
- ただし **実際にロッテリーが実行されるかどうかはバグ3次第**

**修正方法**: `rumbleDailyLottery_` の内部呼び出し用に plain object を返す版を作るか、TextOutput から値を取り出す

---

### バグ3 【推定・未確認】`rumble_entry` シートに参加者が存在しない

**根拠**: 過去7日すべてで `participant_count: 0` → `rumble_entry` シートが空か、日付比較が失敗している

**仮説A（日付フォーマット変換）**:
- GAS が `appendRow([..., "2026-04-16", ...])` でシートに書き込む際、Google Sheets が日付文字列を Date 型に自動変換する可能性がある
- `getValues()` で読み返すと Date オブジェクトが返り、`String(dateObj)` が `"2026-04-16"` と一致しない
- → フィルタがすべての行をスキップ → `participant_count: 0`

**仮説B（シートが本当に空）**:
- `rumble_entry` シートが何らかの理由でクリアされた、またはまだ誰も参加していない
- `rumbleStatus_` クラッシュのため、サーバー側の「参加済み」確認が常に失敗していたため、ユーザーが参加ボタンを押せていない可能性

**確認方法**: 実際のユーザーIDで `rumble_entry` アクションを呼び、その後 `rumble_daily_result` で participant_count が増えるか確認

---

## 未調査事項（続きの作業）

- [ ] `rumble_week` シートにデータがあるか（`rumble_ranking` 呼び出しで確認）
- [ ] 実際のユーザーIDで `rumble_status` の代替確認
- [ ] `rumble_entry` シートの生データ確認（日付の実際の保存形式）
- [ ] GAS デプロイ済みバージョンが最新 Code.gs と一致しているか確認

---

## 修正すべき箇所（優先順）

1. **最優先**: `getAppSheet_()` → `SpreadsheetApp.getActiveSpreadsheet().getSheetByName("applies")` に修正
2. **次**: `rumble_run_now` の戻り値パース修正
3. **確認後**: `rumble_entry` の日付比較が失敗している場合はその修正
4. GAS を再デプロイ

---

## 関連ファイル

| ファイル | 行 | 内容 |
|---|---|---|
| `gas/Code.gs` | 7030 | `getAppSheet_()` 未定義バグ |
| `gas/Code.gs` | 8413-8425 | `rumble_run_now` 戻り値パース |
| `gas/Code.gs` | 7399-7587 | `rumbleDailyLottery_` |
| `gas/Code.gs` | 7597-7709 | `rumbleDailyResult_` |
| `app/api/minigames/rumble/status/route.ts` | - | status API |
| `app/mini-games/rumble/page.tsx` | 204-221 | status fetch / localEnteredToday |
| `app/mini-games/rumble/page.tsx` | 291-318 | spectator fetch |
| `app/mini-games/rumble/page.tsx` | 1199-1311 | 観戦タブ pending 表示 |
