import {
  extractJson,
  normalizeProfile,
  normalizeManifest,
  toStickerItems,
  MAX_TEXT_LENGTH,
} from "@/app/lib/sticker/manifest";
import { templateFor, isValidTheme } from "@/app/lib/sticker/templates";

describe("templateFor", () => {
  it("customはdailyに寄せる", () => {
    expect(templateFor("custom", 4)).toEqual(templateFor("daily", 4));
  });

  it("想定外のテーマでも落ちない", () => {
    const r = templateFor("bogus" as never, 8);
    expect(r).toHaveLength(8);
    expect(r[0].text).toBe(templateFor("daily", 1)[0].text);
  });

  it("件数がテンプレートを超えても巡回して埋める", () => {
    const r = templateFor("daily", 40);
    expect(r).toHaveLength(40);
  });
});

describe("isValidTheme", () => {
  it("既知のテーマだけ通す", () => {
    expect(isValidTheme("daily")).toBe(true);
    expect(isValidTheme("custom")).toBe(true);
    expect(isValidTheme("bogus")).toBe(false);
    expect(isValidTheme(null)).toBe(false);
    expect(isValidTheme(123)).toBe(false);
  });
});

describe("extractJson", () => {
  it("素のJSONを読む", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("コードフェンス付きでも読む", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("```\n[1,2]\n```")).toEqual([1, 2]);
  });

  it("前後に説明文があっても読む", () => {
    expect(extractJson('了解しました。\n{"a":1}\n以上です。')).toEqual({ a: 1 });
  });

  it("読めないものはnull", () => {
    expect(extractJson("これはJSONではありません")).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});

describe("normalizeProfile", () => {
  it("欠けたキーを空文字で埋める", () => {
    const p = normalizeProfile({ name: "ポチ", species: "shiba inu" });
    expect(p.name).toBe("ポチ");
    expect(p.species).toBe("shiba inu");
    expect(p.tail).toBe("");
  });

  it("line_width スネークケースも受ける", () => {
    expect(normalizeProfile({ line_width: "thick" }).lineWidth).toBe("thick");
  });

  it("オブジェクトでなければ空のプロフィール", () => {
    expect(normalizeProfile(null).name).toBe("");
    expect(normalizeProfile("x").name).toBe("");
  });
});

describe("normalizeManifest", () => {
  it("必ず指定件数を返す", () => {
    for (const count of [8, 16, 24, 32, 40]) {
      expect(normalizeManifest([], "daily", count)).toHaveLength(count);
    }
  });

  it("LLMが壊れた出力を返してもテンプレートで埋まる", () => {
    const r = normalizeManifest(null, "daily", 8);
    expect(r).toHaveLength(8);
    expect(r[0].text).toBe(templateFor("daily", 1)[0].text);
  });

  it("LLMの出力を優先して使う", () => {
    const r = normalizeManifest(
      [{ text: "やっほー", emotion: "happy", pose: "waving", expression: "smile" }],
      "daily",
      8
    );
    expect(r[0].text).toBe("やっほー");
    expect(r[0].pose).toBe("waving");
    expect(r).toHaveLength(8);
  });

  it("stickers キーで包まれていても読む", () => {
    const r = normalizeManifest({ stickers: [{ text: "どうも" }] }, "daily", 8);
    expect(r[0].text).toBe("どうも");
  });

  it("セリフが重複した行は落とす", () => {
    const r = normalizeManifest(
      [{ text: "はい" }, { text: "はい" }, { text: "いいえ" }],
      "daily",
      8
    );
    expect(r[0].text).toBe("はい");
    expect(r[1].text).toBe("いいえ");
  });

  it("長すぎるセリフを切り詰める", () => {
    const long = "あ".repeat(50);
    const r = normalizeManifest([{ text: long }], "daily", 8);
    expect(r[0].text).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("空のセリフは採用しない", () => {
    const r = normalizeManifest([{ text: "   " }, { text: "OK" }], "daily", 8);
    expect(r[0].text).toBe("OK");
  });

  it("idが1から連番になる", () => {
    const r = normalizeManifest([], "polite", 16);
    expect(r.map((e) => e.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("全テーマで40件そろう", () => {
    for (const theme of ["daily", "polite", "couple", "work", "funny", "custom"] as const) {
      const r = normalizeManifest([], theme, 40);
      expect(r).toHaveLength(40);
      expect(new Set(r.map((e) => e.text)).size).toBe(40);
    }
  });
});

describe("toStickerItems", () => {
  it("生成前の状態を持つ配列に変換する", () => {
    const items = toStickerItems(templateFor("daily", 8));
    expect(items).toHaveLength(8);
    expect(items[0].index).toBe(1);
    expect(items[0].status).toBe("pending");
    expect(items[0].assets).toEqual([]);
    expect(items[0].selectedVersion).toBe(0);
  });
});
