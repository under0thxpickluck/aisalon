以下そのままClaude Codeに投げられる形で出す。

---

# rifaneko_datetime_fix_patch.md

## 0. 目的

りふぁねこが `今日は何日？` `今何時？` `今日って何曜日？` のような質問に対して、
**AIの推測ではなく、システム時刻ベースで必ず正しい日本時間を返す**ように修正する。

今回の修正は**既存構造を壊さず、追加と最小修正のみ**で行う。

---

## 1. 問題

現在のりふぁねこは、日付・曜日・時刻系の質問でも通常のAI応答フローに流れているため、
モデルが内部知識や文脈から**古い日付をそれっぽく返してしまう**ことがある。

例:

* 「今日は何日？」に対して過去の日付を返す
* 曜日がズレる
* 日本時間ではなく曖昧な時刻感覚で返す

---

## 2. 修正方針

日付・曜日・時刻系の質問は、OpenAIへそのまま渡さず、**API側で先に判定して固定返答**する。

つまり回答優先順位を以下に変える。

1. **datetime系ルール判定**
2. FAQ
3. 通常AI回答

---

## 3. 実装方針

### 3-1. 追加ファイル

#### `lib/cat/datetime.ts`

新規作成。

役割:

* 日本時間の現在日時を返す
* 日付/曜日/時刻の各種表示文字列を生成する
* 「この質問は日時質問か？」を判定する
* 日時質問なら固定返答を返す

---

## 4. 追加する関数

### 4-1. `getNowInJST()`

**目的**
日本時間ベースの現在日時情報を返す。

**返却例**

```ts
{
  iso: "2026-04-09T20:15:00+09:00",
  date: "2026年4月9日",
  weekday: "木曜日",
  time: "20:15",
  full: "2026年4月9日（木曜日）20:15"
}
```

**実装方針**

* `Intl.DateTimeFormat` を使う
* タイムゾーンは必ず `Asia/Tokyo`

---

### 4-2. `isDateTimeQuestion(text: string)`

**目的**
ユーザーの質問が日時系かどうかを簡易判定する。

**検出対象例**

* 今日
* 何日
* 日付
* 曜日
* 今何時
* 現在時刻
* 今の時間
* 今日って何曜日
* 今日の日付

**判定方式**
まずは単純なキーワード一致でよい。

---

### 4-3. `buildDateTimeAnswer(text: string)`

**目的**
質問内容に応じて適切な固定返答を返す。

**返答例**

* `今日は何日？` → `今日は2026年4月9日です。`
* `今日何曜日？` → `今日は木曜日です。`
* `今何時？` → `今は20:15です。`
* `今の日時は？` → `現在の日本時間は2026年4月9日（木曜日）20:15です。`

---

## 5. 追加ファイルの実装例

### `lib/cat/datetime.ts`

```ts
export type JSTNow = {
  iso: string;
  date: string;
  weekday: string;
  time: string;
  full: string;
};

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

export function getNowInJST(): JSTNow {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const weekday = map.weekday;
  const hour = map.hour ?? "00";
  const minute = map.minute ?? "00";

  const date = `${year}年${month}月${day}日`;
  const time = `${hour}:${minute}`;
  const full = `${date}（${weekday}）${time}`;

  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const iso = `${jst.getFullYear()}-${pad2(jst.getMonth() + 1)}-${pad2(jst.getDate())}T${pad2(jst.getHours())}:${pad2(jst.getMinutes())}:${pad2(jst.getSeconds())}+09:00`;

  return {
    iso,
    date,
    weekday,
    time,
    full,
  };
}

export function isDateTimeQuestion(text: string): boolean {
  const q = (text || "").trim().toLowerCase();

  const keywords = [
    "今日は何日",
    "今日何日",
    "今日の日付",
    "日付",
    "何日",
    "今日って何曜日",
    "今日何曜日",
    "曜日",
    "今何時",
    "今なんじ",
    "現在時刻",
    "今の時間",
    "今何時ですか",
    "今の日時",
    "日時",
    "今日",
  ];

  return keywords.some((k) => q.includes(k));
}

export function buildDateTimeAnswer(text: string): string {
  const q = (text || "").trim();
  const now = getNowInJST();

  if (q.includes("何曜日") || q.includes("曜日")) {
    return `今日は${now.weekday}です。`;
  }

  if (q.includes("何時") || q.includes("なんじ") || q.includes("現在時刻") || q.includes("今の時間")) {
    return `今は${now.time}です。`;
  }

  if (q.includes("日時")) {
    return `現在の日本時間は${now.full}です。`;
  }

  if (q.includes("何日") || q.includes("日付") || q.includes("今日")) {
    return `今日は${now.date}です。`;
  }

  return `現在の日本時間は${now.full}です。`;
}
```

---

## 6. API修正対象

### 対象

`app/api/cat-chat/route.ts`

---

## 7. route.ts 修正内容

### 7-1. import追加

```ts
import { isDateTimeQuestion, buildDateTimeAnswer, getNowInJST } from "@/lib/cat/datetime";
```

---

### 7-2. OpenAI呼び出し前に判定を入れる

**既存の OpenAI 呼び出し処理の直前**に以下を追加する。

```ts
const nowJst = getNowInJST();

if (isDateTimeQuestion(message)) {
  const answer = buildDateTimeAnswer(message);

  return Response.json({
    ok: true,
    answer,
    sourceType: "rule_datetime",
    confidence: 1,
    currentDateTime: nowJst.full,
  });
}
```

---

### 7-3. 通常AIルートにも現在時刻を渡す

日時質問以外でも、プロンプトには現在日本時間を渡しておく。

#### SYSTEM_PROMPT 追記例

```ts
const nowJst = getNowInJST();
```

既存 SYSTEM_PROMPT に以下を追記:

```ts
現在の日本時間は ${nowJst.full} です。
日付・曜日・時刻に関する質問では、この現在時刻情報を優先してください。
現在時刻を推測で答えてはいけません。
```

---

## 8. フロント側の表示修正

### 対象候補

* `components/AIBot/AIBotWidget.tsx`
* `/chat` のメッセージ表示コンポーネント

### 目的

固定ルール返答でも通常回答と同じ見た目で表示できるようにする。

### 必須対応

`sourceType: "rule_datetime"` を受け取ってもエラーにならないようにする。

---

## 9. ログ保存拡張

会話ログを保存しているなら `sourceType` に `rule_datetime` を追加する。

### 例

* faq
* ai
* fallback
* admin_fixed
* **rule_datetime**

---

## 10. 追加で入れるべき軽微なUX改善

### 10-1. 入力例

プレースホルダや候補文にこれを入れてよい。

* 今日は何日？
* 今何時？
* 今日のおすすめは？
* BPって何？

### 10-2. 「今日のおすすめ」との連動

今日のおすすめ文言にも `getNowInJST()` を使って、
時間帯によって出し分けできるようにしてよい。

例:

* 朝: `今日は何から進める？`
* 昼: `人気の機能を試してみる？`
* 夜: `今日は曲を作ってみる？`

---

## 11. テスト観点

### ケース1

入力:
`今日は何日？`

期待:

* OpenAIに流さない
* `今日はYYYY年M月D日です。` を返す

### ケース2

入力:
`今日何曜日？`

期待:

* `今日は○曜日です。`

### ケース3

入力:
`今何時？`

期待:

* `今はHH:MMです。`

### ケース4

入力:
`今の日時は？`

期待:

* `現在の日本時間はYYYY年M月D日（○曜日）HH:MMです。`

### ケース5

入力:
`BPって何？`

期待:

* datetimeルールに入らず、通常FAQまたはAI回答へ流れる

### ケース6

入力:
`今日は何日？何かおすすめある？`

期待:

* 最低限、日付部分がズレないこと
* ただし初期実装では日時質問として固定返答のみでも可

---

## 12. 実装優先順位

### Phase A

* `lib/cat/datetime.ts` 追加
* `route.ts` で日時質問の固定返答化
* `sourceType = rule_datetime` 対応

### Phase B

* SYSTEM_PROMPTへ現在時刻追記
* ログ保存反映

### Phase C

* 今日のおすすめ出し分けにも JST 時刻利用

---

## 13. Done条件

* 「今日は何日？」で過去日付が出ない
* 「今日何曜日？」が日本時間基準で正しい
* 「今何時？」が日本時間で返る
* 既存チャット機能を壊していない
* 通常質問は従来どおりAI回答できる
* `sourceType=rule_datetime` でUIが崩れない

---

## 14. 最終指示

実装は**既存コード削除禁止**。
**追加と最小修正のみ**で対応すること。

特に `app/api/cat-chat/route.ts` は全面書き換えせず、

* import追加
* datetime判定追加
* SYSTEM_PROMPTへ現在時刻追記

の3点中心で終えること。

---

必要なら次に、
**「このmdをさらに Claude Code向けの“ファイル名ごと・関数名ごと・コピペ手順付き”タスク表」**
にして出す。
