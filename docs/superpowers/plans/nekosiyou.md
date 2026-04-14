# りふぁねこ進化機能 実装仕様書

## 0. 目的

りふぁねこを、単なる導線用キャラクターではなく、**LIFAI全体の案内・相談・学習蓄積・運営補助**を担う常設AIに進化させる。

今回の方針は以下の3本柱とする。

1. **全ページから即質問できる小窓チャットを追加する**
2. **今の `/chat` ページは残し、深い相談用のフル画面チャットとして使い分ける**
3. **質問ログ・未回答・FAQ・記憶を蓄積し、admin画面から育成できる構造にする**

---

## 1. 結論（UI/UX方針）

最も合理性が高い構成は、**小窓チャット + フル画面チャットの併用**である。

### 1-1. 採用方針

* **通常利用:** 全ページ共通の小窓チャット
* **長文相談・履歴確認・画像付き相談:** `/chat` ページ
* **ミニアプリ一覧:** りふぁねこアイコンから `/chat` に入れる導線を残す

### 1-2. 理由

#### 小窓チャットの利点

* ページ遷移なしで使える
* `/purchase` `/apply` `/confirm` `/market` `/music2` など、その場で質問できる
* 離脱を減らせる
* 「どのページで困ったか」を文脈として持てる

#### `/chat` ページを残す利点

* 長い会話や履歴確認に向く
* 将来的な画像添付、会話履歴一覧、会話検索、詳細設定を載せやすい
* 小窓では狭い操作を逃がせる

### 1-3. 判断

**小窓だけに統一**すると機能拡張に弱い。
**ページだけに統一**すると利用ハードルが高くなる。
したがって、**入口は小窓、深掘りは `/chat`** の二層構造が最適。

---

## 2. 目指す完成像

りふぁねこを以下の3役で設計する。

### 2-1. 役割

1. **案内AI**

   * LIFAIの機能説明
   * ページ別の操作案内
   * 人気機能への導線

2. **相談AI**

   * 質問への回答
   * 困りごとの切り分け
   * 解決不能時の保留・admin連携

3. **育つAI**

   * 質問履歴を保存
   * 未回答を記録
   * adminが正式回答を入れると次回以降に反映

---

## 3. 今回追加する主要機能

### 3-1. 小窓チャット（最優先）

現在のポップアップは以下構成。

* 今日のおすすめ
* 相談するボタン
* 閉じるボタン

これを次のように拡張する。

#### 通常時

* 上部: りふぁねこヘッダー
* 中段: 今日のおすすめカード
* 下段1: 相談する（小窓チャットを開く）
* 下段2: チャットページで開く
* 下段3: 閉じる

#### 小窓チャット展開後

* 会話ログ表示エリア
* 入力欄
* 送信ボタン
* 「履歴を見る」→ `/chat` へ遷移
* 「この回答で解決した」ボタン
* 「うまくいかなかった」ボタン

### 3-2. フル画面チャット `/chat`

既存の `/chat` は残す。用途は以下。

* 長文相談
* 画像付き質問
* 会話履歴確認
* 回答の再表示
* 将来のFAQ検索や設定画面

### 3-3. 今日のおすすめエリア強化

目的は、**人気機能・優先導線・今おすすめの行動を提案すること**。

初期表示候補:

* 曲を作る
* BGM生成を試す
* マーケットを見る
* 権利購入を進める
* 未完了の申請を進める
* BP受け取りを確認する

#### 表示ロジック優先順位

1. そのユーザーの進行中タスク
2. 未完了導線（申請途中、決済後未送信など）
3. 人気機能
4. 運営の推し機能
5. ランダム補助

---

## 4. 情報設計（何を覚えるか）

### 4-1. 覚えるべきこと

#### ユーザー単位

* よく使う機能
* 直近の相談内容
* 進行中タスク
* 説明の好み（短め/丁寧）
* 未解決の問題

#### サービス知識

* LIFAIの機能説明
* 操作手順
* BP/EPの基礎
* よくある質問
* 管理上の正式回答

#### 運営学習用

* 未回答質問
* 低評価回答
* よくある言い換え
* admin修正版回答

### 4-2. 覚えない方がいいもの

* パスワード
* 決済機密情報
* 不要な長文雑談全文
* 個人情報の生データ

---

## 5. りふぁねこの回答設計

### 5-1. 回答優先順位

1. ページ固有のFAQ
2. 共通FAQ
3. ユーザー記憶
4. SYSTEM_PROMPT + LIFAI知識
5. OpenAI生成回答
6. 不明ならunknown登録

### 5-2. ページ文脈を必ず使う

送信時に以下をAPIへ渡す。

* `pagePath`
* `pageTitle`
* `widgetMode` (`popup` / `fullpage`)
* `userId` または `anonymousId`
* `recentMessages`

例:

* `/purchase` で「次どうすればいい？」 → 決済導線優先
* `/apply` で「ここ何書くの？」 → 入力フォーム案内
* `/music2` で「何から始める？」 → 曲作成・BGM生成導線

---

## 6. 追加データ構造

最初は GAS + Sheets で実装する。

### 6-1. `cat_chat_logs`

| カラム               | 内容                                         |
| ----------------- | ------------------------------------------ |
| log_id            | 一意ID                                       |
| user_id           | ログインユーザーID or anonymousId                  |
| session_id        | セッションID                                    |
| page_path         | 質問時のページ                                    |
| widget_mode       | popup / fullpage                           |
| user_message      | 質問本文                                       |
| assistant_message | 回答本文                                       |
| source_type       | faq / memory / ai / admin_fixed / fallback |
| confidence        | 0〜1                                        |
| resolved          | true/false                                 |
| created_at        | 作成日時                                       |

### 6-2. `cat_user_memory`

| カラム        | 内容     |
| ---------- | ------ |
| memory_id  | 一意ID   |
| user_id    | ユーザーID |
| key        | 記憶キー   |
| value      | 値      |
| priority   | 優先度    |
| updated_at | 更新日時   |

例:

* `favorite_feature = music2`
* `current_issue = payment_not_reflected`
* `preferred_style = short`

### 6-3. `cat_faq`

| カラム              | 内容                                  |
| ---------------- | ----------------------------------- |
| faq_id           | 一意ID                                |
| category         | login / payment / music / market など |
| question_pattern | 質問パターン                              |
| answer           | 正式回答                                |
| tags             | タグ                                  |
| priority         | 優先度                                 |
| enabled          | true/false                          |
| updated_at       | 更新日時                                |

### 6-4. `cat_unknown_questions`

| カラム                | 内容                        |
| ------------------ | ------------------------- |
| unknown_id         | 一意ID                      |
| user_message       | 元質問                       |
| normalized_message | 正規化質問                     |
| page_path          | 発生ページ                     |
| count              | 発生回数                      |
| first_seen_at      | 初回日時                      |
| last_seen_at       | 最終日時                      |
| status             | open / answered / ignored |
| admin_answer       | 管理者回答                     |

### 6-5. `cat_feedback`

| カラム         | 内容         |
| ----------- | ---------- |
| feedback_id | 一意ID       |
| log_id      | 対象ログ       |
| rating      | good / bad |
| comment     | 任意コメント     |
| created_at  | 作成日時       |

---

## 7. 管理画面に追加する機能

既存 `/admin` 配下に「りふぁねこ管理」を追加する。

### 7-1. 追加タブ

#### 1) 未回答一覧

* 未解決質問一覧
* 発生回数
* 発生ページ
* admin回答登録
* FAQ昇格

#### 2) FAQ管理

* 質問パターン追加
* 正式回答編集
* 有効/無効切替
* 優先度設定

#### 3) 会話ログ

* ユーザー別履歴
* ページ別履歴
* 低評価回答の抽出

#### 4) ユーザー記憶管理

* 記憶一覧
* 修正
* 削除
* ピン留め

#### 5) おすすめ管理

* 今日のおすすめの手動登録
* 優先導線設定
* 人気機能の重み付け

---

## 8. API設計

### 8-1. 新規API

#### `POST /api/cat-chat`

チャット本体。既存を拡張。

**Request**

```ts
{
  message: string;
  pagePath?: string;
  pageTitle?: string;
  widgetMode?: 'popup' | 'fullpage';
  sessionId?: string;
  userId?: string;
  anonymousId?: string;
  recentMessages?: { role: 'user' | 'assistant'; content: string }[];
}
```

**Response**

```ts
{
  ok: true;
  answer: string;
  sourceType: 'faq' | 'memory' | 'ai' | 'admin_fixed' | 'fallback';
  confidence: number;
  suggestedActions?: { label: string; href?: string; action?: string }[];
  logId: string;
  escalated?: boolean;
}
```

#### `GET /api/cat-recommendation`

そのページ・そのユーザー向けおすすめを返す。

#### `POST /api/cat-feedback`

回答に good / bad を付ける。

#### `GET /api/cat-history`

ユーザー履歴取得。

#### `POST /api/admin/cat-faq`

FAQ追加・更新。

#### `GET /api/admin/cat-unknown`

未回答一覧取得。

#### `POST /api/admin/cat-unknown/resolve`

未回答への正式回答登録。

#### `GET /api/admin/cat-logs`

会話ログ取得。

#### `GET /api/admin/cat-memory`

ユーザー記憶取得。

#### `POST /api/admin/cat-memory`

ユーザー記憶編集。

---

## 9. GAS Action 追加案

* `cat_log_create`
* `cat_log_feedback`
* `cat_faq_list`
* `cat_faq_upsert`
* `cat_unknown_list`
* `cat_unknown_upsert`
* `cat_unknown_resolve`
* `cat_memory_get`
* `cat_memory_upsert`
* `cat_recommendation_get`

既存方針に合わせ、**追加のみ・既存actionは壊さない**。

---

## 10. フロント実装方針

### 10-1. 小窓チャット

#### 追加/改修対象

* `components/AIBot/AIBotWidget.tsx`
* `components/AIBot/AIBotProvider.tsx`
* 必要なら `components/AIBot/ChatPanel.tsx` 新規追加
* 必要なら `components/AIBot/RecommendationCard.tsx` 新規追加

#### 状態

* `closed`
* `preview`
* `chat_open`
* `loading`

#### 操作

* 初期はおすすめカード表示
* 「相談する」で小窓チャット展開
* 「チャットページで開く」で `/chat` 遷移
* 送信後に回答表示
* bad評価で「運営確認に回しました」を出す

### 10-2. `/chat` ページ

#### 継続利用する理由

* 長文向き
* 履歴向き
* 将来の多機能化向き

#### 追加候補

* 過去履歴一覧
* よくある質問サイドバー
* 画像添付
* 未解決質問の再送

### 10-3. ミニアプリ一覧

* りふぁねこのアイコンを追加
* タップ時は `/chat` へ遷移
* 小窓利用と競合せず、深い相談導線として機能

---

## 11. 今日のおすすめ設計

### 11-1. 表示目的

* 主要機能への導線強化
* 離脱防止
* アクティブ率向上
* 新機能露出

### 11-2. 初期文言例

* 今日のおすすめ: 曲を作ってみよう
* 人気機能: BGM生成を試す
* 途中の申請があります。続きから進めますか？
* 未受取BPがあります
* マーケットの人気作品を見てみよう

### 11-3. 出し分け条件

#### ログイン前

* 権利購入
* LIFAI紹介
* 人気機能紹介

#### ログイン後

* 進行中導線
* 未受取BP
* よく使う機能
* 人気機能

#### ページ別

* `/top` → 人気機能
* `/purchase` → 申請導線
* `/apply` → 入力補助
* `/confirm` → 支払い後の次アクション
* `/music2` → 曲作成開始
* `/market` → 人気商品や出品案内

---

## 12. 回答失敗時の設計

### 12-1. 失敗時動作

* 無理に断定しない
* unknown登録する
* ユーザーには柔らかく返す
* 可能なら関連ページへ誘導する

### 12-2. 表示文言例

* まだうまく答えきれなかったから、運営確認用に記録しておくね
* 近い内容ならこちらが役立つかも
* 詳しく相談したい場合はチャットページでも話せるよ

---

## 13. 実装フェーズ

### Phase 1: 土台

* 小窓チャットUI追加
* `/api/cat-chat` 拡張
* 会話ログ保存
* FAQ参照
* today recommendation API

### Phase 2: 学習基盤

* unknown保存
* feedback保存
* admin未回答一覧
* admin FAQ登録

### Phase 3: 記憶

* user memory保存
* ページ文脈強化
* ユーザー別おすすめ

### Phase 4: 高度化

* 類似質問マッチ
* 回答品質向上
* `/chat` 履歴一覧
* 画像付き相談の拡張

---

## 14. Done条件

### Phase 1 Done

* どのページからでも小窓で質問できる
* ページ遷移なしで回答が返る
* `/chat` は従来通り使える
* 今日のおすすめがページ別に出し分けされる

### Phase 2 Done

* bad評価や不明質問がadmin画面に溜まる
* adminが回答を登録できる
* 次回以降その内容が反映される

### Phase 3 Done

* ユーザーごとに困りごとや好みを一定範囲で覚える
* ページ文脈込みで回答精度が上がる

---

## 15. 最終判断

**採用構成:**

* 小窓チャットを主導線にする
* `/chat` ページはフル機能版として残す
* ミニアプリのりふぁねこアイコンは `/chat` へつなぐ
* 今日のおすすめは導線エンジンとして強化する
* 未回答・記憶・FAQ・admin修正で“育つ構造”を作る

この方針が、離脱率・使いやすさ・拡張性・運営改善効率のバランスが最も良い。
