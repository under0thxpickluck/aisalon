import { wrapText, AUTO_WRAP_MIN } from "@/app/lib/sticker/client/composer";

describe("wrapText", () => {
  it("短いセリフは1行のまま", () => {
    expect(wrapText("おはよう")).toEqual(["おはよう"]);
    expect(wrapText("あ".repeat(AUTO_WRAP_MIN))).toEqual([
      "あ".repeat(AUTO_WRAP_MIN),
    ]);
  });

  it("長いセリフは自動で2行に割る", () => {
    const r = wrapText("おつかれさまでした");
    expect(r).toHaveLength(2);
    expect(r.join("")).toBe("おつかれさまでした");
  });

  it("2行の長さが偏らない", () => {
    const r = wrapText("ありがとうございます");
    expect(Math.abs(r[0].length - r[1].length)).toBeLessThanOrEqual(1);
  });

  it("手動の改行を優先する", () => {
    expect(wrapText("ありがとう\nございます")).toEqual([
      "ありがとう",
      "ございます",
    ]);
  });

  it("3行以上は2行までに切る", () => {
    expect(wrapText("あ\nい\nう")).toEqual(["あ", "い"]);
  });

  it("行頭に句読点が来ないようにする", () => {
    // 中央で割ると2行目が「、」で始まってしまう配置
    const r = wrapText("そうだね、たしかに");
    expect(r).toHaveLength(2);
    expect("、。！？".includes(r[1][0])).toBe(false);
    expect(r.join("")).toBe("そうだね、たしかに");
  });

  it("行頭に小書き文字が来ないようにする", () => {
    const r = wrapText("がんばりましょっか");
    expect(r).toHaveLength(2);
    expect("ぁぃぅぇぉっゃゅょ".includes(r[1][0])).toBe(false);
  });

  it("空文字や空白だけなら行を返さない", () => {
    expect(wrapText("")).toEqual([]);
    expect(wrapText("   ")).toEqual([]);
    expect(wrapText("\n\n")).toEqual([]);
  });

  it("分割しても文字が欠けない", () => {
    for (const s of [
      "おつかれさまです",
      "いつもありがとう",
      "またあしたね",
      "だいじょうぶ？",
      "ちょっとまって",
    ]) {
      expect(wrapText(s).join("")).toBe(s);
    }
  });

  it("絵文字を含んでも壊れない", () => {
    const s = "たのしい😀ですね";
    expect(wrapText(s).join("")).toBe(s);
  });
});
