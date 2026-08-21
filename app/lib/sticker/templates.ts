// テーマ別のスタンプ企画テンプレート。
//
// 用途は2つ:
//   1. LLM（/api/sticker/plan）への手本として渡す
//   2. LLM が落ちた・不正なJSONを返したときのフォールバック
//
// タプルの並びは [セリフ, emotion, pose, expression]。
// emotion/pose/expression は画像生成プロンプトにそのまま入るため英語で書く。

import type { ManifestEntry, StickerTheme } from "./types";

type Tuple = readonly [string, string, string, string];

const DAILY: Tuple[] = [
  ["おはよう", "happy", "waving one hand", "bright smile"],
  ["おやすみ", "sleepy", "curled up with a pillow", "closed eyes"],
  ["ありがとう", "grateful", "bowing slightly", "warm smile"],
  ["ごめんね", "apologetic", "bowing deeply", "sad eyes"],
  ["了解！", "energetic", "saluting", "confident"],
  ["わかった！", "agreeable", "thumbs up", "smile"],
  ["OK！", "cheerful", "making an OK sign with both arms", "bright smile"],
  ["いいね！", "approving", "thumbs up with sparkles", "happy"],
  ["すごい！", "amazed", "both hands raised", "sparkling eyes"],
  ["うれしい！", "joyful", "jumping with arms up", "big smile"],
  ["かなしい", "sad", "crouching down", "crying with a teardrop"],
  ["つかれた", "exhausted", "slumped forward", "tired with a sweat drop"],
  ["ねむい", "sleepy", "rubbing eyes and yawning", "drowsy"],
  ["おなかすいた", "hungry", "holding stomach", "pleading"],
  ["いってきます", "cheerful", "walking away while waving", "smile"],
  ["ただいま", "relieved", "stepping in and waving", "relaxed smile"],
  ["おかえり", "welcoming", "arms open wide", "warm smile"],
  ["まってるね", "patient", "sitting and checking a watch", "calm"],
  ["いそいで！", "urgent", "running fast", "panicked"],
  ["だいじょうぶ？", "concerned", "tilting head and reaching out", "worried"],
  ["がんばって！", "encouraging", "fist pump", "determined"],
  ["おめでとう！", "celebrating", "tossing confetti", "big smile"],
  ["よろしく！", "friendly", "offering a handshake", "smile"],
  ["おつかれさま", "kind", "offering a drink", "gentle smile"],
  ["なるほど", "thoughtful", "hand on chin", "thinking"],
  ["うーん…", "puzzled", "tilting head with a question mark", "confused"],
  ["えっ！？", "shocked", "jumping backwards", "wide eyes"],
  ["ちょっとまって", "flustered", "both palms out in a stop gesture", "panicked"],
  ["いやだー！", "refusing", "shaking head violently", "pouting"],
  ["やったー！", "triumphant", "both arms raised in victory", "ecstatic"],
  ["ごちそうさま", "satisfied", "hands together after a meal", "content"],
  ["いただきます", "polite", "hands together before a meal", "happy"],
  ["バイバイ", "cheerful", "waving goodbye", "smile"],
  ["またね", "friendly", "waving with a small hand", "gentle smile"],
  ["うそでしょ…", "disbelief", "frozen in place", "stunned"],
  ["かわいい！", "adoring", "hands on cheeks with hearts around", "delighted"],
  ["たすけて！", "desperate", "reaching out", "tears flowing"],
  ["しらんぷり", "aloof", "looking away and whistling", "indifferent"],
  ["おこってる", "angry", "arms crossed with puffed cheeks", "mad"],
  ["だいすき！", "loving", "hugging a big heart", "blissful"],
];

const POLITE: Tuple[] = [
  ["おはようございます", "respectful", "bowing politely", "gentle smile"],
  ["おつかれさまです", "courteous", "slight bow", "calm smile"],
  ["ありがとうございます", "grateful", "deep bow", "warm smile"],
  ["申し訳ございません", "apologetic", "very deep bow", "regretful"],
  ["承知いたしました", "professional", "hand over chest", "composed"],
  ["かしこまりました", "professional", "standing straight and nodding", "serious"],
  ["よろしくお願いします", "polite", "bowing with hands together", "sincere"],
  ["失礼いたします", "courteous", "bowing while stepping back", "calm"],
  ["お世話になっております", "polite", "holding a business card", "gentle smile"],
  ["恐れ入ります", "humble", "small bow with hand raised", "apologetic"],
  ["助かりました", "relieved", "hands clasped in thanks", "relieved smile"],
  ["確認いたします", "diligent", "looking at documents", "focused"],
  ["少々お待ちください", "polite", "one palm raised gently", "calm smile"],
  ["お先に失礼します", "courteous", "waving while leaving", "gentle smile"],
  ["いってらっしゃいませ", "welcoming", "bowing while gesturing outward", "smile"],
  ["お帰りなさいませ", "welcoming", "bowing at the entrance", "warm smile"],
  ["ご連絡ありがとうございます", "grateful", "holding a phone and bowing", "smile"],
  ["大変恐縮です", "humble", "shrinking with a small bow", "embarrassed"],
  ["おめでとうございます", "celebrating", "applauding politely", "bright smile"],
  ["ご苦労さまです", "appreciative", "nodding with respect", "gentle smile"],
  ["承りました", "professional", "writing in a notebook", "focused"],
  ["検討いたします", "thoughtful", "hand on chin with documents", "thinking"],
  ["対応いたします", "determined", "rolling up sleeves", "confident"],
  ["完了いたしました", "satisfied", "presenting a finished document", "proud smile"],
  ["ご報告いたします", "professional", "holding up a report", "composed"],
  ["ご相談があります", "hesitant", "raising a hand shyly", "nervous"],
  ["お時間よろしいですか", "polite", "pointing at a clock", "questioning"],
  ["なるほどですね", "understanding", "nodding with hand on chin", "impressed"],
  ["さすがです", "admiring", "applauding", "sparkling eyes"],
  ["勉強になります", "humble", "taking notes eagerly", "earnest"],
  ["ご配慮に感謝します", "grateful", "bowing with both hands together", "moved"],
  ["とんでもございません", "modest", "waving hands in denial", "flustered smile"],
  ["お気遣いなく", "gentle", "one palm raised softly", "kind smile"],
  ["遅れて申し訳ありません", "apologetic", "running in while bowing", "flustered"],
  ["お力添えいただけますか", "requesting", "hands together in a plea", "hopeful"],
  ["了解いたしました", "professional", "firm nod", "composed"],
  ["楽しみにしております", "hopeful", "hands clasped near chest", "happy"],
  ["またご連絡いたします", "courteous", "holding a phone and bowing", "gentle smile"],
  ["お体にお気をつけて", "caring", "waving gently", "warm smile"],
  ["本日はありがとうございました", "grateful", "final deep bow", "sincere smile"],
];

const COUPLE: Tuple[] = [
  ["だいすき", "loving", "hugging a big heart", "blissful"],
  ["会いたい", "longing", "looking at a photo", "wistful"],
  ["おはよう♡", "affectionate", "waving from under a blanket", "sleepy smile"],
  ["おやすみ♡", "affectionate", "blowing a goodnight kiss", "gentle smile"],
  ["ぎゅーして", "needy", "arms wide open for a hug", "pleading"],
  ["さみしい", "lonely", "hugging knees", "teary"],
  ["いまなにしてる？", "curious", "holding a phone", "questioning"],
  ["電話していい？", "hopeful", "holding a phone to ear", "hopeful"],
  ["むかえにきて", "pleading", "waving from a bench", "pleading"],
  ["ごめんね…", "apologetic", "peeking from behind hands", "sorry"],
  ["ゆるして", "pleading", "hands together begging", "teary"],
  ["やきもち", "jealous", "puffed cheeks looking away", "sulking"],
  ["かまって", "needy", "tugging a sleeve", "pouting"],
  ["ずっといっしょ", "devoted", "holding hands", "peaceful smile"],
  ["ありがとう♡", "grateful", "hugging with hearts around", "happy"],
  ["うれしい♡", "joyful", "spinning with hearts", "delighted"],
  ["かわいいね", "adoring", "cupping cheeks", "smitten"],
  ["かっこいい", "admiring", "eyes sparkling", "starstruck"],
  ["いってらっしゃい", "supportive", "waving at the door", "warm smile"],
  ["おかえり♡", "welcoming", "jumping into a hug", "big smile"],
  ["デートしよ", "excited", "pointing forward eagerly", "excited"],
  ["なにたべたい？", "curious", "holding a menu", "questioning"],
  ["まってるね", "patient", "sitting with a heart", "calm smile"],
  ["すぐいくね", "eager", "running fast", "determined"],
  ["きょうもおつかれさま", "caring", "offering a warm drink", "gentle smile"],
  ["むりしないでね", "concerned", "patting a shoulder", "worried"],
  ["だいじょうぶ？", "concerned", "leaning in closely", "worried"],
  ["そばにいるよ", "comforting", "sitting close together", "gentle"],
  ["しあわせ", "content", "lying down with hearts", "blissful"],
  ["てをつなご", "affectionate", "reaching out a hand", "shy smile"],
  ["おこってないよ", "sulking", "arms crossed looking away", "pouting"],
  ["ちょっとおこってる", "annoyed", "puffed cheeks with steam", "mad"],
  ["なかなおりしよ", "hopeful", "offering a pinky promise", "hopeful"],
  ["やさしいね", "touched", "hands on chest", "moved"],
  ["わたしのこと好き？", "coy", "tilting head with a heart", "teasing"],
  ["もちろん好き", "confident", "pointing at own heart", "confident smile"],
  ["けっこんしよ", "earnest", "kneeling with a ring", "sincere"],
  ["ねむれない", "restless", "rolling in bed", "wide awake"],
  ["ゆめでもあいたい", "dreamy", "floating among stars", "dreamy"],
  ["いつもありがとう", "grateful", "handing over a flower", "warm smile"],
];

const WORK: Tuple[] = [
  ["出社しました", "dutiful", "walking in with a bag", "neutral"],
  ["退勤します", "relieved", "waving while leaving", "relieved smile"],
  ["会議はじめます", "professional", "standing by a whiteboard", "composed"],
  ["資料できました", "proud", "holding up a document", "proud smile"],
  ["確認お願いします", "polite", "handing over papers", "expectant"],
  ["修正しました", "diligent", "typing on a laptop", "focused"],
  ["進捗どうですか", "curious", "peeking over a desk", "questioning"],
  ["順調です", "confident", "thumbs up at a desk", "confident smile"],
  ["遅れそうです", "anxious", "looking at a clock", "worried"],
  ["手が空きました", "available", "stretching arms", "refreshed"],
  ["手が回りません", "overwhelmed", "buried in paperwork", "distressed"],
  ["ヘルプお願いします", "desperate", "raising a white flag", "pleading"],
  ["対応中です", "focused", "typing rapidly", "serious"],
  ["完了しました", "satisfied", "pressing a big enter key", "triumphant"],
  ["承知しました", "professional", "nodding firmly", "composed"],
  ["リスケお願いします", "apologetic", "holding a calendar", "apologetic"],
  ["明日でもいいですか", "hesitant", "pointing at tomorrow on a calendar", "hopeful"],
  ["今日中にやります", "determined", "rolling up sleeves", "determined"],
  ["残業します", "resigned", "sitting under a desk lamp at night", "tired"],
  ["定時で上がります", "cheerful", "dashing for the door", "bright smile"],
  ["有給いただきます", "happy", "holding a travel ticket", "excited"],
  ["体調不良です", "unwell", "lying down with an ice pack", "sick"],
  ["リモートします", "relaxed", "working from a sofa", "relaxed"],
  ["席外します", "brief", "pointing at the door", "neutral"],
  ["戻りました", "casual", "sitting back down", "calm"],
  ["昼休憩いきます", "hungry", "holding a lunch box", "happy"],
  ["コーヒー飲みたい", "craving", "holding an empty mug", "longing"],
  ["眠すぎる", "sleepy", "nodding off at a desk", "drowsy"],
  ["締切やばい", "panicked", "surrounded by falling papers", "panicked"],
  ["なんとかなった", "relieved", "wiping forehead", "relieved smile"],
  ["助かりました", "grateful", "bowing at a desk", "thankful"],
  ["ナイスです", "approving", "double thumbs up", "bright smile"],
  ["お疲れさまでした", "courteous", "bowing while leaving", "gentle smile"],
  ["よろしくお願いします", "polite", "bowing with documents", "sincere"],
  ["すみません", "apologetic", "small bow", "apologetic"],
  ["それは難しいです", "hesitant", "making an X with arms", "troubled"],
  ["検討します", "thoughtful", "hand on chin", "thinking"],
  ["いい感じです", "pleased", "pointing at a rising graph", "satisfied"],
  ["やり直しです", "deflated", "staring at a crossed-out page", "dejected"],
  ["今週も終わった", "exhausted", "collapsing onto a desk", "spent"],
];

const FUNNY: Tuple[] = [
  ["は？", "unimpressed", "staring blankly", "deadpan"],
  ["それな", "agreeing", "pointing sideways", "smug"],
  ["知らんけど", "dismissive", "shrugging", "indifferent"],
  ["マジで？", "surprised", "leaning forward", "wide eyes"],
  ["うける", "amused", "clutching stomach laughing", "laughing"],
  ["わろた", "amused", "rolling on the floor", "laughing hard"],
  ["ぴえん", "whiny", "hands near eyes", "teary pout"],
  ["むりむり", "refusing", "backing away with hands up", "distressed"],
  ["やばい", "panicked", "sweating heavily", "panicked"],
  ["神", "worshipping", "kneeling and praising", "awestruck"],
  ["天才", "impressed", "pointing with sparkles", "amazed"],
  ["おばか", "teasing", "poking with a finger", "mischievous"],
  ["どんまい", "consoling", "patting a shoulder", "sympathetic"],
  ["おこ", "angry", "puffed cheeks with steam", "mad"],
  ["ふぁっ！？", "startled", "leaping into the air", "shocked"],
  ["ちーん", "defeated", "lying flat with a spirit leaving", "lifeless"],
  ["えらい！", "praising", "applauding with sparkles", "proud"],
  ["だが断る", "defiant", "pointing dramatically", "smug"],
  ["圧がすごい", "intimidated", "shrinking backwards", "nervous"],
  ["効いてない", "smug", "arms crossed confidently", "smirking"],
  ["ろんぱ", "triumphant", "pointing with a finger up", "smug"],
  ["それは草", "amused", "covering mouth laughing", "giggling"],
  ["冷静に考えて", "calm", "adjusting glasses", "serious"],
  ["気のせい", "evasive", "looking away whistling", "innocent"],
  ["なにも聞こえない", "avoidant", "covering both ears", "stubborn"],
  ["見なかったことにする", "avoidant", "covering eyes", "sheepish"],
  ["にげる", "fleeing", "running away with a dust cloud", "panicked"],
  ["帰りたい", "longing", "staring out a window", "wistful"],
  ["働きたくない", "reluctant", "melting into a puddle", "listless"],
  ["お金ほしい", "greedy", "reaching for falling coins", "eager"],
  ["寝たい", "sleepy", "hugging a pillow", "drowsy"],
  ["食べたい", "hungry", "drooling at a plate", "craving"],
  ["やる気ゼロ", "listless", "lying face down", "empty eyes"],
  ["本気だす", "determined", "cracking knuckles with flames behind", "fierce"],
  ["やっぱやめた", "fickle", "turning around mid-step", "casual"],
  ["完全に理解した", "confident", "adjusting glasses with a gleam", "smug"],
  ["なにもわからない", "lost", "surrounded by question marks", "bewildered"],
  ["とりあえず休憩", "relaxed", "reclining with a drink", "content"],
  ["明日から本気", "procrastinating", "lounging lazily", "carefree"],
  ["今日はここまで", "finished", "closing a laptop", "satisfied"],
];

const TABLE: Record<Exclude<StickerTheme, "custom">, Tuple[]> = {
  daily: DAILY,
  polite: POLITE,
  couple: COUPLE,
  work: WORK,
  funny: FUNNY,
};

export const THEME_LABELS: Record<StickerTheme, string> = {
  daily: "日常会話",
  polite: "敬語",
  couple: "カップル",
  work: "仕事",
  funny: "面白い",
  custom: "自分で指定",
};

/** LLM に渡すテーマ説明。custom のときはユーザー入力をそのまま使う。 */
export const THEME_GUIDANCE: Record<StickerTheme, string> = {
  daily: "友達や家族との日常のやりとりで毎日使う、短くて汎用的なあいさつ・返事・感情表現",
  polite: "職場や取引先で使える丁寧語・敬語。ビジネスメールの代わりに送れる表現",
  couple: "恋人同士のやりとり。甘え・愛情表現・仲直り・すれ違いの感情",
  work: "会社員が同僚や上司に送る業務連絡。出退勤・進捗・依頼・締切の悲哀",
  funny: "ネットスラング寄りのリアクション・ツッコミ・自虐。テンポの良い短い一言",
  custom: "",
};

/**
 * テーマから企画テンプレートを取り出す。
 * count がテンプレート件数を超える場合は先頭から巡回して埋める。
 */
export function templateFor(theme: StickerTheme, count: number): ManifestEntry[] {
  // custom と、想定外の値が来たときは daily に寄せる
  const source = TABLE[theme as Exclude<StickerTheme, "custom">] ?? DAILY;
  const out: ManifestEntry[] = [];
  for (let i = 0; i < count; i++) {
    const [text, emotion, pose, expression] = source[i % source.length];
    out.push({ id: i + 1, text, emotion, pose, expression });
  }
  return out;
}

export function isValidTheme(v: unknown): v is StickerTheme {
  return typeof v === "string" && v in THEME_LABELS;
}

/** LLM プロンプトに埋め込む手本（先頭4件だけ見せる） */
export function exampleFor(theme: StickerTheme): ManifestEntry[] {
  return templateFor(theme, 4);
}
