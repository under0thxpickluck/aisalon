import {
  LINE_SPEC,
  toEven,
  fitContain,
  innerBox,
  canvasSizeFor,
  isValidStickerCount,
  validateTitle,
  validateDescription,
  validateFileSizes,
  stickerFileName,
} from "@/app/lib/sticker/line_spec";

describe("toEven", () => {
  it("奇数を切り下げて偶数にする", () => {
    expect(toEven(371)).toBe(370);
    expect(toEven(320)).toBe(320);
    expect(toEven(9.9)).toBe(8);
  });

  it("2未満にはしない", () => {
    expect(toEven(0)).toBe(2);
    expect(toEven(1)).toBe(2);
    expect(toEven(-5)).toBe(2);
  });
});

describe("fitContain", () => {
  it("アスペクト比を保ってboxに収める", () => {
    const r = fitContain(1024, 1024, { width: 350, height: 300 });
    expect(r.height).toBe(300);
    expect(r.width).toBe(300);
  });

  it("横長の画像は幅で制限される", () => {
    const r = fitContain(1000, 500, { width: 350, height: 300 });
    expect(r.width).toBe(350);
    expect(r.height).toBe(174);
  });

  it("常に偶数を返す", () => {
    const r = fitContain(999, 333, { width: 351, height: 301 });
    expect(r.width % 2).toBe(0);
    expect(r.height % 2).toBe(0);
  });

  it("元画像より拡大しない", () => {
    const r = fitContain(100, 100, { width: 350, height: 300 });
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
  });

  it("不正な入力でも落ちない", () => {
    expect(fitContain(0, 0, { width: 350, height: 300 })).toEqual({
      width: 2,
      height: 2,
    });
  });
});

describe("innerBox", () => {
  it("キャンバスから上下左右の余白を引く", () => {
    expect(innerBox({ width: 370, height: 320 })).toEqual({
      width: 350,
      height: 300,
    });
  });

  it("余白より小さいキャンバスでも負にならない", () => {
    const r = innerBox({ width: 10, height: 10 });
    expect(r.width).toBeGreaterThanOrEqual(2);
    expect(r.height).toBeGreaterThanOrEqual(2);
  });
});

describe("canvasSizeFor", () => {
  it("LINEの規定サイズを返す", () => {
    expect(canvasSizeFor("sticker")).toEqual({ width: 370, height: 320 });
    expect(canvasSizeFor("main")).toEqual({ width: 240, height: 240 });
    expect(canvasSizeFor("tab")).toEqual({ width: 96, height: 74 });
  });

  it("すべて偶数px", () => {
    for (const kind of ["sticker", "main", "tab"] as const) {
      const s = canvasSizeFor(kind);
      expect(s.width % 2).toBe(0);
      expect(s.height % 2).toBe(0);
    }
  });
});

describe("isValidStickerCount", () => {
  it("8/16/24/32/40のみ許可する", () => {
    for (const n of LINE_SPEC.allowedCounts) {
      expect(isValidStickerCount(n)).toBe(true);
    }
    expect(isValidStickerCount(10)).toBe(false);
    expect(isValidStickerCount(0)).toBe(false);
    expect(isValidStickerCount(41)).toBe(false);
  });
});

describe("validateTitle", () => {
  it("空はエラー", () => {
    expect(validateTitle("  ")?.field).toBe("title");
  });

  it("40文字ちょうどは通る", () => {
    expect(validateTitle("あ".repeat(40))).toBeNull();
  });

  it("41文字はエラー", () => {
    expect(validateTitle("あ".repeat(41))).not.toBeNull();
  });
});

describe("validateDescription", () => {
  it("160文字ちょうどは通る", () => {
    expect(validateDescription("あ".repeat(160))).toBeNull();
  });

  it("161文字はエラー", () => {
    expect(validateDescription("あ".repeat(161))).not.toBeNull();
  });
});

describe("validateFileSizes", () => {
  it("すべて1MB以下なら問題なし", () => {
    expect(
      validateFileSizes([
        { name: "01.png", bytes: 500_000 },
        { name: "02.png", bytes: 900_000 },
      ])
    ).toEqual([]);
  });

  it("1MB超のファイルを指摘する", () => {
    const issues = validateFileSizes([{ name: "01.png", bytes: 1_200_000 }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("01.png");
  });

  it("合計60MB超を指摘する", () => {
    const files = Array.from({ length: 70 }, (_, i) => ({
      name: `${i}.png`,
      bytes: 1_000_000,
    }));
    const issues = validateFileSizes(files);
    expect(issues.some((i) => i.field === "zip")).toBe(true);
  });
});

describe("stickerFileName", () => {
  it("2桁ゼロ埋め", () => {
    expect(stickerFileName(1)).toBe("01.png");
    expect(stickerFileName(40)).toBe("40.png");
  });
});
