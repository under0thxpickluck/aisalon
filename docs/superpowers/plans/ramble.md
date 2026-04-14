
# `rumble_spectator_stabilization_spec.md`

````md
# LIFAI ランブル 観戦機能安定化 実装指示書
作成日: 2026-04-01
目的: 既存実装を大きく壊さずに、観戦機能を安定化・再現性向上・UI改善する
対象: Claude Code 実装用
重要方針: 不要な設計変更や新機能拡張を行わず、この仕様に厳密に従うこと

---

## 0. 最重要ルール

### この実装で絶対にやってはいけないこと
- `rumble_entry` / `rumble_week` のシート構造を変更しない
- `rumbleEntry_()` の score計算式を変更しない
- `rumbleEntry_()` の BP消費仕様を変更しない
- `rumbleEntry_()` の二重参加防止仕様を変更しない
- `rumbleRewardDistribute_()` の報酬テーブルを変更しない
- バトルをリアルタイム実行型に変更しない
- 新しい大規模シート追加をしない
- 新しい複雑なAPI群を増やさない
- 既存の `SpectatorData` の基本形を壊さない
- 既存タブ（バトル / ランキング / 装備 / ガチャ）を壊さない
- 既存のscore順確定ロジックを壊さない
- 既存のwaveベース演出を全面刷新しない

### この実装でやること
- タイマー修正
- 観戦データ再取得条件の改善
- `rumbleSpectator_()` のイベント安定化（seeded random）
- 少人数分岐追加
- 観戦UI文言と操作導線の改善
- battleLogs保持件数の拡張
- 生存者リストと演出ルールの明確化

---

## 1. 現状設計の維持方針

### バトルの本質
- ランブルの勝敗の元になる結果は参加時点で score によりほぼ確定している
- 観戦は「その確定済み結果を演出として再生する」仕組み
- この設計は維持する
- 「19:00に実際の戦闘計算が走る」方式にはしない

### score順
- `rumbleSpectator_()` は従来通り当日の `rumble_entry` を取得
- `score` 降順でソート
- rank付与
- 脱落順は原則スコア下位から
- 上位者が最後まで残る構図は維持

### event構造
- 既存の `events[]` を返してフロントで再生する方式を維持
- `players / events / self / ranking / total` は維持する

---

## 2. 対象ファイル

### フロント
- `app/mini-games/rumble/page.tsx`

### API Route
- `app/api/minigames/rumble/spectator/route.ts`
- 必要なら軽微修正のみ可（必須ではない）

### GAS
- `gas/Code.gs`
- 主に `rumbleSpectator_()` を修正
- `rumbleEntry_()` は変更禁止
- `rumbleRewardDistribute_()` は変更禁止

---

## 3. タイマー修正仕様

### 現状の禁止実装
以下のような「now + 9h + setHours」の擬似JST実装は禁止
```ts
const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const target = new Date(nowJst);
target.setHours(19, 0, 0, 0);
````

### 新方式

Asia/Tokyo基準で年月日を取得し、
`YYYY-MM-DDT19:00:00+09:00`
を文字列で組み立てて target を作ること

### 仕様

* カウントダウンは JST 기준
* 目標時刻は平日19:00
* 土日は次回月曜19:00を目標にする
* 19:00を過ぎたら次の開催日へ進める

### 表示文言

#### 平日19:00前

* `参加受付中`
* `開始まで HH:MM:SS`

#### 平日19:00以降

* 観戦前: `本日の観戦データを準備中…`
* 再生中: `観戦中`
* 再生終了後: `結果確定`

#### 土日

* `次回開催は月曜19:00`

### 実装条件

* countdownは既存stateを活かしてよい
* 既存UIレイアウトはなるべく維持
* UTC環境でもズレないこと

---

## 4. 観戦データ再取得仕様

### 現状の禁止実装

以下を廃止すること

```ts
if (tab !== "観戦" || !userId || spectatorData) return;
```

### 追加state

`page.tsx` に以下を追加

* `spectatorFetchedAt: number | null`
* `spectatorDate: string | null`

### 再fetch条件

以下のいずれかで spectator データを再取得すること

1. `tab === "観戦"` に入った時点で `spectatorData === null`
2. `spectatorDate !== 今日のJST日付`
3. `spectatorData.status === "no_data"`
4. `spectatorFetchedAt === null`
5. `Date.now() - spectatorFetchedAt > 30000`
6. ユーザーが「最新を取得」を押した
7. 再生開始前にデータが古いと判断された

### 再fetchしなくていいケース

* 当日データである
* `status !== "no_data"`
* 取得から30秒以内
* 強制更新ボタン未押下

### 更新時に保存するもの

fetch成功時:

* `spectatorData`
* `spectatorFetchedAt = Date.now()`
* `spectatorDate = response.date`

### no_data時の扱い

* `status === "no_data"` でもキャッシュ固定しない
* 観戦タブにいる間、一定条件で再取得可能にする
* これにより、後から参加者が増えたとき反映されるようにする

---

## 5. rumbleSpectator_() 安定化仕様

### 目的

同じ日・同じ参加者・同じscoreなら、
`events[]` が毎回同じ内容になるようにする

### 変更方針

* wave計算は維持
* score降順ソートは維持
* event typeは維持
* return shapeは維持
* ランダム要素だけ seed 化する

### seed生成ルール

以下情報を連結して seed 文字列を作る

* `date`
* `total`
* `player.id`
* `player.score`
* 順位順の並び

#### 例

```text
2026-04-01|42|uid1:188|uid2:176|uid3:170|...
```

### 疑似乱数

GAS内で軽量な seeded random 関数を自作すること
要件:

* 同じ seed なら同じ乱数列
* 外部ライブラリ不要
* `Math.random()` 直使用は禁止（演出決定部分）

### seed対象

以下は seed ベースで決める

* 注目戦の相手選出
* 注目戦の攻撃者/防御者の選び分け
* damage補正の乱数
* critical判定
* ログ文言の分岐（複数テンプレがある場合）
* 少人数時の演出分岐

### seed不要

以下は seed不要（従来仕様維持）

* score順ソート
* wave脱落人数
* 下位からの脱落順そのもの

---

## 6. 少人数分岐仕様

### 参加者0人

返却:

```json
{
  "ok": true,
  "status": "no_data",
  "players": [],
  "events": [],
  "self": null,
  "ranking": []
}
```

### 参加者1人

#### 意図

無理にwave処理しない
短い専用演出で終える

#### events構成

1. intro
2. log（唯一の挑戦者が現れた）
3. result（自動優勝）

#### 例文

* `ランブルが はじまる！`
* `唯一の挑戦者が戦場に立った！`
* `◯◯ が本日の勝者となった！`

### 参加者2人

#### events構成

1. intro
2. battle
3. result

#### 仕様

* score上位が勝者
* battleは1本
* criticalはseedで決めてよい

### 参加者3人

#### events構成

1. intro
2. battle or log
3. batch_eliminate（1人脱落）
4. battle
5. result

#### 仕様

* 最下位を先に落とす
* 上位2人で決着
* 長くしすぎない

### 参加者4人以上

* 既存のwaveロジックを維持する
* 既存の4波構成を継続する

---

## 7. wave演出仕様（4人以上）

### 基本方針

* 現行の4波構成を維持
* 脱落順は score 下位から
* 上位は最後まで残る
* 観戦の「見どころ」を作るため、各wave内に注目戦を混ぜる

### 維持するフェーズ

* intro
* wave1（序盤戦）
* wave2（中盤戦）
* wave3（終盤戦）
* wave4（決戦）
* top3〜final
* ranking
* result

### 脱落処理

* 既存の `batch_eliminate` を維持
* 下位から順にまとめて落とす
* players側の生存状態と一致させること

### 注目戦の意図

* 実際の勝敗を変えるものではない
* score順結果を演出的に見せるためのログ
* 注目戦の結果で rank が変動してはいけない

### 注目戦ルール

* playerA: 自分 or 上位から優先
* playerB: 下位側から選ぶ
* damage = 基本値 + seed乱数
* is_crit = seed乱数で決定

### result

* 最終勝者は rank1
* result文言は勝者表示のみでよい
* ランキングイベントで順位確定を知らせる

---

## 8. イベント型仕様

既存型を維持すること

```ts
type SpectatorEvent = {
  type: "intro" | "batch_eliminate" | "battle" | "log" | "ranking" | "result";
  text?: string;
  ids?: string[];
  a?: string;
  b?: string;
  is_crit?: boolean;
  phase?: string;
  delay: number;
};
```

### 型変更ルール

* 新しい必須フィールドは追加しない
* 既存フロントが壊れる変更は禁止
* 必要な追加は任意フィールドのみ検討可だが、基本は増やさない

---

## 9. battleLogs仕様

### 現状変更

* 最新8件保持 → 最新20件保持に変更する

### 理由

* 脱落情報や結果ログが流れやすいため
* 20件あれば最低限の観戦履歴を保持できる

### 実装条件

現在の

```ts
.slice(-8)
```

を

```ts
.slice(-20)
```

に変更するだけでよい
他の複雑な履歴保存は不要

---

## 10. 観戦再生UI仕様

### 既存構造は維持

観戦タブの大枠は壊さない

### 上部ステータスカード

表示項目:

* フェーズ文言
* 参加人数
* 生存数
* 脱落数
* 自分の状態（参加している場合）

### フェーズ文言

#### 再生前・19:00前

* `参加受付中`

#### 再生前・19:00後

* `本日の観戦データを準備中…`

#### 再生中

* `観戦中`

#### 再生終了

* `結果確定`

### バトルログ領域

* 現在の見た目を大きく壊さない
* 最新20件を表示
* 色分けは現行準拠でよい
* resultとrankingは目立たせる

### ボタン構成

以下3つに整理する

1. `観戦スタート`

* 初回再生用
* `spectatorData.status !== "no_data"` のとき押せる

2. `もう一度見る`

* 同じ `spectatorData.events` を最初から再生する
* 再fetchしない
* 同じ日の演出は完全一致すること

3. `最新を取得`

* 強制再fetch
* no_data時でも押せる
* 取得後は `spectatorFetchedAt / spectatorDate / spectatorData` を更新

### ボタン挙動

#### 観戦スタート

* battleLogs 初期化
* spectatorPlayers を全員 alive に戻す
* spectatorPhase = live
* events を順再生

#### もう一度見る

* battleLogs 初期化
* spectatorPlayers を全員 alive に戻す
* 取得済み events を順再生
* ネットワーク再取得しない

#### 最新を取得

* API再fetch
* 取得成功後は再生しない
* ボタンはデータ更新専用

---

## 11. 生存者リスト仕様

### 目的

観戦中に「誰がまだ残っているか」を見せる
既存のプレイヤー一覧表示を活かす

### 基本ルール

* `spectatorPlayers` を画面表示のソースとする
* 初期状態は全員 `alive`
* `batch_eliminate` イベントで対象者を `eliminated` にする
* `battle` イベントでは状態を変えない
* ranking / result 時点で勝者以外が落ちている状態であることが望ましい

### 見た目ルール

* TOP10: 金系の目立つ表示（既存踏襲）
* 自分: 紫系で強調（既存踏襲）
* 脱落者: 打ち消し線 + opacity低下
* 生存者: 通常表示

### ソート

* 基本は rank順で表示
* 再生中も並び替えは不要
* 見た目だけ alive/eliminated を変える

### カード化は不要

* 既存タグ表示ベースでよい
* 無駄なUI刷新は不要

---

## 12. ログ文言仕様

### 方針

過剰に増やさず、既存の文体を維持する
RPG風の短文で統一する

### intro候補

* `ランブルが はじまる！`
* `戦場に緊張が走る……！`

### log候補

* `参加者たちが にらみ合っている……`
* `激しい衝突が始まった！`
* `上位勢が 一気に前へ出る！`

### battle候補

* `◯◯ の一撃！`
* `◯◯ が ◯◯ に斬りかかる！`
* `◯◯ が強烈な攻撃を放った！`

### critical付き

* `会心の一撃！`
* `強烈な一発が決まった！`

### batch_eliminate候補

* `◯名が戦線から離脱した！`
* `下位グループがまとめて吹き飛ばされた！`

### ranking候補

* `━━━━━━━━━━━━━━━━`
* `🏆 今日の順位が確定！`

### result候補

* `◯◯ が本日の勝者となった！`
* `◯◯ が最後まで立ち続けた！`

### ルール

* 文言候補は複数あってよい
* ただし seed により同じ日なら同じ文言を選ぶこと

---

## 13. handleSpectatorPlay 実装ルール

### 基本方針

現在の `handleSpectatorPlay` をベースに最小修正する

### 維持する動き

* `isPlaying` ガード
* `spectatorPhase = live`
* `battleLogs` 初期化
* `spectatorPlayers` alive 初期化
* eventsを順に `await setTimeout` で再生
* result到達後 `spectatorPhase = result`

### 変更点

1. 最新20件保持
2. 再生ボタンの分離
3. 初回再生前のデータ取得条件改善
4. 可能なら event再生開始前に `spectatorData.status === "no_data"` を再確認

### delay

* 既存仕様を維持してよい
* 極端な高速化や複雑な倍速機能追加は不要
* 今回は倍速機能を追加しない

---

## 14. SpectatorData 互換性要件

以下は維持すること

```ts
{
  ok: true,
  status,
  date,
  players,
  events,
  self,
  ranking,
  total
}
```

### players

* `id`
* `display_name`
* `score`
* `rp`
* `rank`
* `is_self`

### 重要

* フロントが現在期待している基本構造を壊さない
* フィールド名変更禁止
* rankingの形も変えない

---

## 15. 実装順序（必須）

以下の順で実装すること

### Step 1

`page.tsx` の countdown ロジック修正

### Step 2

`page.tsx` の spectator 再取得条件修正

* `spectatorFetchedAt`
* `spectatorDate`
  追加

### Step 3

`gas/Code.gs` の `rumbleSpectator_()` に seeded random 導入

* 完全ランダム排除
* 同日同条件で events固定化

### Step 4

`rumbleSpectator_()` に少人数分岐追加

* 0 / 1 / 2 / 3人

### Step 5

`page.tsx` の battleLogs 保持件数を20件化

### Step 6

観戦ボタンを

* 観戦スタート
* もう一度見る
* 最新を取得
  へ整理

### Step 7

フェーズ文言の調整

* 参加受付中
* 本日の観戦データを準備中…
* 観戦中
* 結果確定

---

## 16. 品質条件

### 必須

* 既存の entry / ranking / equipment / gacha タブが壊れない
* 同じ日なら `もう一度見る` で全く同じ演出になる
* no_data 状態でも後から参加者が増えたら `最新を取得` で反映される
* UTC環境でも countdown がJSTとして正しく動く
* `rumbleEntry_()` の既存挙動に影響を与えない
* `SpectatorData` の shape を維持する

### 望ましい

* コード変更は最小限
* 既存コンポーネントをなるべく活かす
* 既存スタイルを崩さない
* Claude Code独自の大規模リファクタをしない

---

## 17. 実装後に確認すべきテスト

### タイマー

* JST環境で19:00まで正しくカウントダウンされる
* 土日に次回月曜19:00を指す
* 19:00以降は「本日の観戦データを準備中…」系になる

### 観戦取得

* 観戦タブ初回表示で取得される
* 30秒以内は不要な再fetchをしない
* 30秒後は再fetchされうる
* `最新を取得` で再fetchされる
* no_dataから参加者追加後に反映される

### 演出安定化

* 同日・同参加者・同scoreで events が一致する
* `もう一度見る` で全く同じ演出になる
* リロード後でも同じ演出になる

### 少人数

* 0人: no_data
* 1人: intro + result
* 2人: intro + battle + result
* 3人: intro + 脱落 + result
* 4人以上: 既存wave

### UI

* battleLogs が20件まで残る
* 生存者リストの脱落表示が一致する
* resultまで到達したら `結果確定` になる

---

## 18. 最終指示

この実装では「新しいゲームを作る」のではなく、
既存のLIFAIランブル観戦実装を壊さず、
**再現性・安定性・わかりやすさ** を上げることだけを目的とする。

不要な設計提案、不要な大規模リファクタ、不要な追加機能は行わず、
この仕様に書かれた範囲だけを正確に実装すること。

```

