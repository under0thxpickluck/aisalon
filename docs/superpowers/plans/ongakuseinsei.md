# LIFAI narasu代理申請フォーム 実装仕様書

## 0. 目的

LIFAI上に **narasu向け代理申請フォーム** を実装する。
本仕様は、まずは動く形を優先して実装し、後から弁護士が法務面をレビューしやすいように、画面遷移・入力項目・保存項目・バリデーション・決済フローを整理したものである。

---

## 1. 前提方針

* 既存構造を壊さない
* 既存ファイルの削除禁止
* 追加・最小修正のみ
* UIはまずシンプルでよい
* 本格稼働までは **パスワードゲート付き** にする
* 仮パスワードは **`nagoya01@`**
* 法務文面は後で差し替え可能な構造にする
* 決済は「本申請ボタン押下後」に進む
* 歌詞データは任意入力
* 音源URLは複数入力可能
* 申請内容は送信前に確認画面を表示する

---

## 2. ユーザーフロー

### 全体フロー

1. LIFAIトップの「代理申請フォーム」ボタンから遷移
2. パスワードゲート表示
3. 正しいパスワード入力でフォーム利用可能
4. 法務確認・規約確認ページ表示
5. 最下部の「同意する」ボタン
6. 同意しない場合はトップへ戻す
7. 同意後、申請フォーム入力画面へ遷移
8. narasuアカウント情報を入力
9. 音源URLを複数入力
10. 歌詞データを任意入力
11. ジャケット情報・アーティスト名等を任意入力
12. 確認画面へ進む
13. 内容確認後「本申請」ボタン
14. 代行費用のクレジットカード決済へ進む
15. 決済成功後、申請受付完了画面を表示
16. 管理側で内容確認・代理申請対応

---

## 3. 画面一覧

### 3-1. 入口ボタン

**配置場所**

* LIFAIトップ
* ボタン文言: `代理申請フォーム`

**動作**

* `/narasu-agency` に遷移

---

### 3-2. パスワードゲート画面

**目的**

* 本格稼働前の限定公開

**表示項目**

* タイトル: `代理申請フォーム（準備中テスト公開）`
* パスワード入力欄
* 送信ボタン
* エラー文言欄

**認証条件**

* 入力値が `nagoya01@` と一致した場合のみ通過

**動作**

* 一致 → 規約確認画面へ遷移
* 不一致 → エラー表示 `パスワードが違います`

**実装方針**

* 初期は簡易実装でよい
* セッション or localStorage で一時通過管理
* 後で正式認証へ差し替え可能な分離構造にする

---

### 3-3. 規約・法務確認画面

**目的**

* 弁護士確認前提で、まずは同意取得フローを実装する

**表示内容**

* 規約本文エリア
* 注意事項エリア
* 最下部にチェックボックス

  * `上記内容を確認し、同意します`
* ボタン2つ

  * `同意する`
  * `同意しない`

**動作**

* `同意する`

  * チェックON時のみ押下可
  * 申請フォーム画面へ遷移
* `同意しない`

  * LIFAIトップへ戻す

**備考**

* 法務文言は一旦ダミー文面でよい
* 後でCMS化または定数ファイル化し、弁護士差し替えしやすくする

---

### 3-4. 申請フォーム画面

## 必須項目

### A. narasuアカウント情報

* narasuログインID または メールアドレス
* narasuパスワード

**備考**

* パスワードは入力マスク表示
* 後で暗号化保存や取り扱い見直しができるように保存箇所を分離

### B. 音源URL入力

* 初期表示で1件分の入力欄を表示
* `＋` ボタンで欄を追加可能
* `－` ボタンで追加欄を削除可能

**各行の入力項目**

* 音源URL

**仕様**

* 1件以上必須
* 空欄だけの行は送信時に除外
* URL形式チェックを行う

---

## 任意項目

### C. 歌詞データ

* テキストエリア
* 任意入力
* 未入力可
* プレースホルダー: `歌詞がない場合は空欄のままで構いません`

### D. ジャケット情報

* ジャケット画像URL
* または ジャケットに関するメモ欄

※ 初期版ではまず **ジャケット画像URL欄** と **補足メモ欄** を用意すればよい

### E. アーティスト名

* 任意入力欄

### F. 補足事項

* 自由記述欄
* 申請時の注意や希望を書けるようにする

---

## 4. 入力バリデーション

### 必須バリデーション

* 規約同意済みであること
* narasuアカウント情報が入力されていること
* 音源URLが1件以上あること

### 任意バリデーション

* URL欄は値がある場合のみ形式チェック
* 歌詞は未入力可
* アーティスト名は未入力可
* ジャケット情報は未入力可

### エラー表示

* 各項目の直下に表示
* ページ上部にもまとめて表示可能

**例**

* `narasuアカウント情報を入力してください`
* `音源URLを1件以上入力してください`
* `URL形式が正しくありません`

---

## 5. 確認画面

**目的**

* 本申請前にユーザーが内容を最終確認できるようにする

**表示項目**

* narasuアカウント情報（パスワードは伏せ字表示）
* 音源URL一覧
* 歌詞データ
* ジャケット情報
* アーティスト名
* 補足事項

**ボタン**

* `修正する`
* `本申請へ進む`

**動作**

* `修正する` → 入力画面へ戻る
* `本申請へ進む` → 決済前処理へ進む

---

## 6. 本申請ボタン押下後の流れ

### 意図

* 本申請押下後に代行費用決済へ進める

### 画面/処理

1. `本申請へ進む` 押下
2. バックエンドで申請データ仮保存
3. 申請ステータスを `draft_submitted` などで保存
4. 決済ページへ遷移

---

## 7. 代行費用のクレジットカード決済

**目的**

* 代理申請の作業着手前に決済を行う

**決済タイミング**

* 確認画面で「本申請へ進む」押下後

**決済手段**

* クレジットカード

**初期実装の考え方**

* まずは既存のLIFAI決済基盤に乗せられる形にする
* 決済成功をトリガーに正式受付へ進める

**成功時**

* ステータスを `paid` に更新
* 受付完了画面を表示

**失敗時**

* ステータスを `payment_failed` に更新
* 再決済導線を表示

---

## 8. 受付完了画面

**表示内容**

* `代理申請の受付が完了しました`
* `内容確認後、順次対応いたします`
* 受付番号
* 申請内容確認ページへのリンク（後日）
* トップへ戻るボタン

---

## 9. 保存データ設計

## 保存先

* 既存DB/GAS/Sheetsのどれか既存構成に合わせる
* 初期は既存のLIFAI保存方式に寄せる

## 推奨レコード項目

### 基本情報

* request_id
* created_at
* updated_at
* status
* agreed_terms_version
* agreed_at

### narasuアカウント情報

* narasu_login_id
* narasu_password

### 申請情報

* audio_urls（配列）
* lyrics_text
* jacket_image_url
* jacket_note
* artist_name
* note

### 決済情報

* payment_status
* payment_amount
* payment_provider
* payment_id
* paid_at

### 管理情報

* admin_memo
* handled_at
* handled_by

---

## 10. ステータス設計

以下のようなステータスを持たせる。

* `password_verified`
* `terms_agreed`
* `draft`
* `draft_submitted`
* `payment_pending`
* `paid`
* `payment_failed`
* `under_review`
* `processing`
* `completed`
* `rejected`

初期実装では最低限以下があればよい。

* `draft`
* `payment_pending`
* `paid`
* `under_review`
* `completed`

---

## 11. フロント実装要件

### 11-1. 動的音源URL欄

**要件**

* `＋` で入力欄追加
* `－` で削除
* 最低1欄は残す
* 並び順維持

### 11-2. 入力保持

**要件**

* 入力途中で戻っても内容が消えにくいようにする
* 初期はコンポーネントstateでよい
* 可能なら localStorage に一時保存

### 11-3. 確認画面

**要件**

* 入力内容をそのまま見せる
* パスワードは `********` 表示

### 11-4. エラーハンドリング

**要件**

* 未入力/形式エラーを明示
* 通信失敗時の再送導線を用意

---

## 12. バックエンド実装要件

### 必要API候補

#### 1. パスワード検証

* `POST /api/narasu-agency/gate`

#### 2. 下書き保存

* `POST /api/narasu-agency/draft`

#### 3. 確認用取得

* `GET /api/narasu-agency/:requestId`

#### 4. 本申請開始

* `POST /api/narasu-agency/submit`

#### 5. 決済開始

* `POST /api/narasu-agency/payment/create`

#### 6. 決済完了Webhookまたは戻り先

* `POST /api/narasu-agency/payment/callback`

---

## 13. 初期ファイル構成案

```txt
app/
  narasu-agency/
    page.tsx                 # パスワードゲート
    terms/page.tsx           # 規約確認画面
    form/page.tsx            # 入力フォーム
    confirm/page.tsx         # 確認画面
    complete/page.tsx        # 完了画面

app/api/
  narasu-agency/
    gate/route.ts
    draft/route.ts
    submit/route.ts
    payment/create/route.ts
    payment/callback/route.ts

components/
  narasu-agency/
    PasswordGate.tsx
    TermsAgreement.tsx
    NarasuAgencyForm.tsx
    AudioUrlFields.tsx
    ConfirmView.tsx

lib/
  narasu-agency/
    types.ts
    validation.ts
    storage.ts
    constants.ts
```

---

## 14. 定数設計

### `lib/narasu-agency/constants.ts`

持たせるべき定数例。

* `NARASU_AGENCY_GATE_PASSWORD = 'nagoya01@'`
* `NARASU_AGENCY_TERMS_VERSION = 'v0.1-draft'`
* `NARASU_AGENCY_FEE = 0000`

※ 料金は未確定なら仮値でよい

---

## 15. 型定義案

```ts
export type NarasuAgencyRequestStatus =
  | 'draft'
  | 'payment_pending'
  | 'paid'
  | 'under_review'
  | 'completed'
  | 'rejected';

export type NarasuAgencyRequest = {
  requestId: string;
  createdAt: string;
  updatedAt: string;
  status: NarasuAgencyRequestStatus;
  agreedTermsVersion?: string;
  agreedAt?: string;
  narasuLoginId: string;
  narasuPassword: string;
  audioUrls: string[];
  lyricsText?: string;
  jacketImageUrl?: string;
  jacketNote?: string;
  artistName?: string;
  note?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentAmount?: number;
  paymentId?: string;
  paidAt?: string;
};
```

---

## 16. バリデーション仕様案

### `validation.ts`

チェック内容:

* narasuLoginId: 必須
* narasuPassword: 必須
* audioUrls: 1件以上
* 各audioUrl: URL形式
* lyricsText: 任意
* artistName: 任意
* jacketImageUrl: 値がある場合のみURL形式

---

## 17. UI文言案

### パスワードゲート

* 見出し: `代理申請フォーム（テスト公開）`
* 説明: `現在は限定公開中です。パスワードを入力してください。`

### 規約確認

* 見出し: `代理申請に関する確認事項`
* ボタン: `同意する` / `同意しない`

### フォーム

* 見出し: `narasu代理申請フォーム`
* サブ文言: `必要事項を入力してください。音源URLは複数追加できます。`

### 確認画面

* 見出し: `入力内容の確認`
* ボタン: `修正する` / `本申請へ進む`

### 完了画面

* 見出し: `受付完了`
* 文言: `代理申請の受付が完了しました。内容確認後、順次対応いたします。`

---

## 18. 初期実装の優先順位

### Phase 1

* パスワードゲート
* 規約同意画面
* 申請フォーム
* 音源URL複数追加UI
* 確認画面

### Phase 2

* 下書き保存
* 決済遷移
* 完了画面
* 管理用ステータス保存

### Phase 3

* 管理画面
* 再編集導線
* メール通知
* 法務文言差し替え容易化

---

## 19. Claude Code向け実装ルール

* 既存コードを削除しない
* 既存構造を壊さない
* 新規ディレクトリ `narasu-agency` で分離実装
* コンポーネント分割して可読性を保つ
* 画面遷移は明確に分離
* 定数・型・バリデーションを別ファイルに切り出す
* パスワードは定数化する
* 後で法務文言を差し替えやすい構造にする
* 初期は見た目より動作優先

---

## 20. Claude Codeへの最終指示

以下の方針で実装すること。

1. LIFAIトップから遷移できる `代理申請フォーム` ボタンを追加
2. narasu向け代理申請フローを新規実装
3. 最初にパスワードゲートを置く
4. パスワードは `nagoya01@`
5. 通過後に規約確認画面を表示
6. 同意しない場合はトップに戻す
7. 同意後に申請フォームへ進む
8. narasuアカウント情報を取得する
9. 音源URLを複数入力可能にする
10. 歌詞は任意入力
11. ジャケット情報・アーティスト名も任意入力
12. 確認画面を挟む
13. その後 `本申請` ボタン
14. 代行費用のクレジットカード決済へ進める
15. 決済成功後に受付完了画面を表示
16. 申請データとステータスを保存する
17. 法務文言は後で差し替えやすいように分離する
18. 既存コード削除禁止、追加・最小修正のみで実装する

---

## 21. 補足

本仕様はまず「実際に触れる形」を優先した初期版である。
法務文面、個人情報管理、パスワード保存方法、narasuアカウント取り扱い、決済規約、免責文言、電子同意ログの厳密設計は、後から弁護士レビュー前提で差し替え・強化を行う。
