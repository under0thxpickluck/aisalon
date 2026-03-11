export type Cat = "normal" | "confused";

export type CTADef = {
  label: string;
  action: "scroll_to" | "navigate" | "dismiss";
  target?: string;
};

export type Rule = {
  id: string;
  trigger: "page_view" | "error_event";
  page_id?: string;
  error_code?: string;
  delay_ms: number;
  cat: Cat;
  message: string;
  cta: CTADef[];
  /** Optional: return false to skip firing this rule */
  condition?: (payload: Record<string, string>) => boolean;
};

export const RULES: Rule[] = [
  // ── Rule 1: マーケット入場 ────────────────────────────────────
  {
    id: "market_home",
    trigger: "page_view",
    page_id: "market_home",
    delay_ms: 3000,
    cat: "normal",
    message: "人気の画像パックや音楽パックがあります。見てみますか？",
    cta: [
      { label: "商品を見る", action: "scroll_to", target: "item-grid" },
      { label: "あとで", action: "dismiss" },
    ],
  },

  // ── Rule 2: 出品ページ案内 ────────────────────────────────────
  {
    id: "market_create",
    trigger: "page_view",
    page_id: "market_create",
    delay_ms: 2000,
    cat: "normal",
    message: "出品ルール：画像は100枚〜、音楽は10曲〜、最低価格は50からです。",
    cta: [
      { label: "出品を始める", action: "scroll_to", target: "create-form" },
      { label: "閉じる", action: "dismiss" },
    ],
  },

  // ── Rule 3: 残高不足エラー ────────────────────────────────────
  {
    id: "insufficient_balance",
    trigger: "error_event",
    error_code: "insufficient_balance",
    delay_ms: 0,
    cat: "confused",
    message: "残高が足りないみたいです。ウォレットを確認しますか？",
    cta: [
      { label: "残高を見る", action: "navigate", target: "/wallet" },
      { label: "閉じる", action: "dismiss" },
    ],
  },

  // ── Rule 4: トップページ入場 ──────────────────────────────────
  {
    id: "top_home",
    trigger: "page_view",
    page_id: "top_home",
    delay_ms: 5000,
    cat: "normal",
    message: "使いたい機能をアイコンから選んでね。音楽生成やマーケットが人気だよ！",
    cta: [
      { label: "音楽生成を試す", action: "navigate", target: "/music" },
      { label: "マーケットを見る", action: "navigate", target: "/market" },
    ],
  },

  // ── Rule 5: トップページ・ウォレット残高 ──────────────────────
  {
    id: "top_wallet",
    trigger: "page_view",
    page_id: "top_home",
    delay_ms: 10000,
    cat: "normal",
    message: "BPやEPが溜まってるね！マーケットで使えるよ。",
    cta: [
      { label: "マーケットを見る", action: "navigate", target: "/market" },
      { label: "閉じる", action: "dismiss" },
    ],
    condition: (payload) =>
      Number(payload.bp ?? 0) >= 1000 || Number(payload.ep ?? 0) >= 1000,
  },
];
