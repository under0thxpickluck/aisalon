// 企画生成スキーマ
export const NOTE_PLAN_SCHEMA = {
  type: "object",
  properties: {
    recommended_angle: { type: "string" },
    sellability_score: { type: "number" },
    suggested_price_yen: { type: "number" },
    target_persona: { type: "string" },
    title_candidates: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
    outline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          purpose: { type: "string" },
          target_length: { type: "number" },
        },
        required: ["heading", "purpose", "target_length"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "recommended_angle",
    "sellability_score",
    "suggested_price_yen",
    "target_persona",
    "title_candidates",
    "outline",
  ],
  additionalProperties: false,
};

// 本文生成スキーマ
export const NOTE_ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body_markdown: { type: "string" },
          is_paid: { type: "boolean" },
        },
        required: ["heading", "body_markdown", "is_paid"],
        additionalProperties: false,
      },
    },
    note_description: { type: "string" },
    x_post: { type: "string" },
    line_copy: { type: "string" },
  },
  required: ["sections", "note_description", "x_post", "line_copy"],
  additionalProperties: false,
};
