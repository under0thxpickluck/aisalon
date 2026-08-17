import {
  STICKER_BP,
  STICKER_PACK_BP,
  OFFERED_COUNTS,
  isOfferedCount,
  packCost,
  creditsForPack,
  bpPerSticker,
  planCost,
} from "@/app/lib/sticker/cost";
import { LINE_SPEC } from "@/app/lib/sticker/line_spec";

describe("OFFERED_COUNTS", () => {
  it("画面で選べるのは8と16のみ", () => {
    expect([...OFFERED_COUNTS]).toEqual([8, 16]);
    expect(isOfferedCount(8)).toBe(true);
    expect(isOfferedCount(16)).toBe(true);
    expect(isOfferedCount(24)).toBe(false);
    expect(isOfferedCount(40)).toBe(false);
    expect(isOfferedCount(10)).toBe(false);
  });

  it("提供する枚数はすべてLINEが受け付ける枚数である", () => {
    for (const n of OFFERED_COUNTS) {
      expect(LINE_SPEC.allowedCounts as readonly number[]).toContain(n);
    }
  });

  it("提供をやめた枚数も価格は残す（作りかけを完了させるため）", () => {
    expect(STICKER_PACK_BP[24]).toBeGreaterThan(0);
    expect(STICKER_PACK_BP[40]).toBeGreaterThan(0);
    expect(() => packCost(40)).not.toThrow();
  });
});

describe("packCost", () => {
  it("枚数ごとのパック価格を返す", () => {
    expect(packCost(8)).toBe(120);
    expect(packCost(40)).toBe(500);
  });

  it("許可されていない枚数は例外", () => {
    expect(() => packCost(10)).toThrow(/invalid_sticker_count/);
    expect(() => packCost(0)).toThrow(/invalid_sticker_count/);
  });

  it("枚数が増えるほど1枚あたりは安くなる", () => {
    const counts = [8, 16, 24, 32, 40] as const;
    for (let i = 1; i < counts.length; i++) {
      expect(bpPerSticker(counts[i])).toBeLessThan(bpPerSticker(counts[i - 1]));
    }
  });
});

describe("creditsForPack", () => {
  it("クレジット数は枚数と一致する", () => {
    for (const n of [8, 16, 24, 32, 40]) {
      expect(creditsForPack(n)).toBe(n);
    }
  });
});

describe("planCost", () => {
  it("キャラ未生成ならキャラ代を含む", () => {
    const p = planCost(40, false);
    expect(p.characterBp).toBe(STICKER_BP.character);
    expect(p.packBp).toBe(500);
    expect(p.totalBp).toBe(550);
    expect(p.credits).toBe(40);
  });

  it("キャラ生成済みならキャラ代は0", () => {
    const p = planCost(40, true);
    expect(p.characterBp).toBe(0);
    expect(p.totalBp).toBe(500);
  });
});

describe("価格表の整合性", () => {
  it("文字変更とZIP書き出しは無料", () => {
    expect(STICKER_BP.textEdit).toBe(0);
    expect(STICKER_BP.export).toBe(0);
  });

  it("再生成は1枚あたりのパック単価より高い（乱発の抑止）", () => {
    expect(STICKER_BP.regenerate).toBeGreaterThan(bpPerSticker(40));
  });

  it("パック価格は原価を上回る（medium $0.042/枚, 1BP=$0.01）", () => {
    for (const [count, bp] of Object.entries(STICKER_PACK_BP)) {
      const costUsd = Number(count) * 0.042;
      const revenueUsd = bp * 0.01;
      expect(revenueUsd).toBeGreaterThan(costUsd);
    }
  });

  it("キャラクター生成は原価$0.25を上回る", () => {
    expect(STICKER_BP.character * 0.01).toBeGreaterThan(0.25);
  });
});
