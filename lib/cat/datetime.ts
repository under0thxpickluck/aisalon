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

  return { iso, date, weekday, time, full };
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
