import { toSameOriginUrl } from "@/app/lib/sticker/client/composer";

describe("toSameOriginUrl", () => {
  it("R2のURLをプロキシ経由に書き換える", () => {
    const r2 = "https://pub-abc123.r2.dev/stickers/items/2026-08/uuid.png";
    expect(toSameOriginUrl(r2)).toBe(
      `/api/sticker/image?url=${encodeURIComponent(r2)}`
    );
  });

  it("クエリ付きURLもエンコードして壊さない", () => {
    const r2 = "https://pub-abc123.r2.dev/a.png?v=1&x=2";
    const out = toSameOriginUrl(r2);
    const decoded = decodeURIComponent(out.split("url=")[1]);
    expect(decoded).toBe(r2);
  });

  it("data: URI はそのまま返す", () => {
    const d = "data:image/png;base64,AAAA";
    expect(toSameOriginUrl(d)).toBe(d);
  });

  it("相対パスはそのまま返す", () => {
    expect(toSameOriginUrl("/local.png")).toBe("/local.png");
  });

  it("空文字はそのまま返す", () => {
    expect(toSameOriginUrl("")).toBe("");
  });
});

// プロキシルートのSSRF対策と同じ判定をここでも固定しておく。
// 前方一致だと "https://pub-x.r2.dev@evil.com" を通してしまうため、
// origin 比較でなければならない。
describe("プロキシの許可判定（origin比較）", () => {
  const base = "https://pub-331d6c8cbdd7478192f432436d19f29f.r2.dev";
  const allowed = (raw: string) => {
    try {
      return new URL(raw).origin === new URL(base).origin;
    } catch {
      return false;
    }
  };

  it("正規のR2 URLは許可される", () => {
    expect(allowed(`${base}/images/a.png`)).toBe(true);
  });

  it("ユーザー情報を使った偽装は拒否される", () => {
    expect(allowed(`${base}@evil.com/a.png`)).toBe(false);
  });

  it("別ホストは拒否される", () => {
    expect(allowed("https://evil.com/a.png")).toBe(false);
    expect(allowed("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("URLとして壊れているものは拒否される", () => {
    expect(allowed("not a url")).toBe(false);
    expect(allowed("")).toBe(false);
  });
});
