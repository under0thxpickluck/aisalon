export const NOTE_SYSTEM_PROMPT = `
あなたはnoteで売れる記事を設計する編集者です。
以下のルールを必ず守ること：
- 日本語で出力する
- 誇張しすぎない。「絶対」「確実」「必ず儲かる」などの断定表現は使わない
- 読みやすい見出し構成にする
- 具体例を必ず入れる
- note向きの導入（共感 → 課題定義 → 解決提示）にする
- 価値提供を先に置く
- 指定したJSON Schemaの形式のみで返す。前置き・後書きは不要
`.trim();

export function buildPlanPrompt(input: {
  theme: string;
  format: string;
  persona: string;
  tone: string;
  length: number;
  expertise: string;
  paywall_mode: string;
  extra_keywords?: string[];
}): string {
  return `
テーマ: ${input.theme}
コンテンツ形式: ${input.format}
対象読者: ${input.persona}
文章スタイル: ${input.tone}
想定文字数: ${input.length}字
専門性レベル: ${input.expertise}
有料化モード: ${input.paywall_mode}
${input.extra_keywords?.length ? `入れたいキーワード: ${input.extra_keywords.join("、")}` : ""}

上記の条件で、noteで売れる記事の企画案を作ってください。
売れやすい切り口・タイトル候補3本・見出し構成・価格提案・ペルソナを出してください。
`.trim();
}

export function buildArticlePrompt(input: {
  selected_title: string;
  outline: { heading: string; purpose: string; target_length: number }[];
  tone: string;
  length: number;
  paywall_mode: string;
}): string {
  const outlineText = input.outline
    .map((o, i) => `${i + 1}. ${o.heading}（${o.purpose}、約${o.target_length}字）`)
    .join("\n");

  return `
タイトル: ${input.selected_title}
文章スタイル: ${input.tone}
総文字数目標: ${input.length}字
有料化モード: ${input.paywall_mode}

見出し構成:
${outlineText}

上記の構成で本文を書いてください。
- 各セクションのbody_markdownはMarkdown形式で書く
- is_paidはpaywall_modeに応じて前半はfalse、後半はtrueにする
- note_descriptionは140字以内
- x_postは140字以内のツイート文
- line_copyはLINE告知用の2〜3文
`.trim();
}
