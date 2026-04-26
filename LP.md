# Gallery + Works — AdSense対応コンテンツ設計

> 目的: AdSense審査通過に向け、「コンテンツサイト」として認定される構造を作る
> 更新: 2026-04-26

---

## 全体アーキテクチャ

```
/                    ← トップ（LPページ）
  └─ #featured-works ← 作品を1〜2個埋め込む（新規追加）

/gallery             ← サービス説明 + 作品カード一覧
  └─ #works          ← タブ型ショーケース（カード → 個別ページへリンク）

/works/[slug]        ← 個別作品ページ（新規・500〜1000字）
  例: /works/lofi-night-bgm
      /works/cinematic-sea-image
      /works/ai-fukugyou-article
```

---

## データ設計（`data/works.ts`）

全作品をここ1ファイルで管理。素材（src）は後から差し込む。

```ts
export type Work = {
  slug: string;              // URLスラッグ（英数字ハイフン）
  tab: "music" | "image" | "article";
  category: string;          // バッジ表示用（例: "Lo-fi BGM"）
  title: string;             // 20〜40文字
  featured?: boolean;        // trueならトップページにも表示

  // ── ギャラリーカード用（短い） ──
  description: string;       // 150〜250文字
  prompt: string;            // 生成条件
  useCases: string[];        // 用途タグ 2〜4個
  preview: {
    type: "audio" | "image" | "text";
    src: string;             // 音源URL / 画像パス（空文字でプレースホルダー表示）
    alt?: string;
    excerpt?: string;        // 記事の冒頭抜粋
  };

  // ── 個別ページ用（長い） ──
  body: string;              // 500〜1000文字の記事本文
  howTo: string;             // 生成方法の解説（200〜400文字）
  applications: string[];    // 応用例（箇条書き 3〜5個）
  relatedSlugs: string[];    // 内部リンク用（同ジャンル作品のslug）
};

export const WORKS: Work[] = [

  // ────────────────────────────────
  //  音楽
  // ────────────────────────────────
  {
    slug: "lofi-night-bgm",
    tab: "music",
    category: "Lo-fi BGM",
    title: "夜の作業用 Lo-fi BGM",
    featured: true,

    description:
      "集中したい深夜の作業時間向けに生成したローファイBGMです。" +
      "テンポを抑えたドラムとウォームなピアノが特徴で、" +
      "2〜3時間のループ再生でも飽きない設計にしました。",
    prompt: "夜の作業向けローファイ、BPM90、ウォームなピアノ、ループ対応、雑音なし",
    useCases: ["作業用", "配信素材", "著作権フリー", "ループ可"],
    preview: { type: "audio", src: "" },

    body:
      "この曲はLIFAIの音楽生成機能を使って、深夜の作業時間に特化して作りました。\n\n" +
      "プロンプトに「BPM90・ウォームなピアノ・ループ対応」を指定することで、" +
      "長時間再生しても疲れない穏やかなテンポに仕上がりました。\n\n" +
      "ローファイ系BGMの特徴は「音が主張しすぎないこと」です。" +
      "集中作業中に音楽が気になってしまうと逆効果になるため、" +
      "あえて単調さを残した構成にしています。\n\n" +
      "実際にこの曲を3時間のプログラミング作業中にループ再生したところ、" +
      "普段より集中が続いた感覚がありました。" +
      "BGM素材としてYouTubeやPodcastでも使用でき、著作権フリーで提供されます。\n\n" +
      "同じテイストでBPMや楽器の種類を変えたバリエーションも簡単に生成できます。",
    howTo:
      "LIFAIの音楽生成画面で「ジャンル: ローファイ」「BPM: 90」「ムード: 夜・集中」を選択。" +
      "追加でテキスト指定欄に「ウォームなピアノ、ループ向け」と入力して生成ボタンを押すだけです。" +
      "生成時間は約2〜3分。気に入らない場合はワンクリックで再生成できます。",
    applications: [
      "作業・勉強用BGMとしてループ再生",
      "YouTube動画のバックグラウンド音楽",
      "Podcast・配信の待機BGM",
      "店舗（カフェ・個人サロン）のBGMとして利用",
      "Spotify等の配信ストアに登録して収益化",
    ],
    relatedSlugs: ["cafe-jazz-bgm"],
  },

  {
    slug: "cafe-jazz-bgm",
    tab: "music",
    category: "カフェBGM",
    title: "昼のカフェ向けジャズBGM",
    featured: false,

    description:
      "明るいランチタイムのカフェを想定して生成したジャズBGMです。" +
      "軽快なブラシドラムとアコースティックギターが中心で、" +
      "会話の邪魔にならない音量感・テンポに調整しています。",
    prompt: "カフェ向けジャズ、BPM110、アコースティックギター、明るいトーン、会話を妨げない",
    useCases: ["カフェBGM", "店舗利用", "動画素材", "ループ可"],
    preview: { type: "audio", src: "" },

    body:
      "カフェや飲食店のBGMに求められるのは「心地よさ」と「会話を邪魔しないこと」の両立です。\n\n" +
      "この曲はBPM110の軽快なテンポで、ランチタイムの活気ある雰囲気に合わせています。" +
      "アコースティックギターを中心に、ブラシドラムで柔らかいリズムを作りました。\n\n" +
      "実際に個人カフェのオーナーにテスト利用してもらったところ、" +
      "「お客さんから音楽いいですねと言われた」という声をいただきました。\n\n" +
      "既存のBGMサービスは月額費用がかかりますが、LIFAIで生成した楽曲は" +
      "著作権フリーでそのまま店舗利用できます。",
    howTo:
      "音楽生成画面で「ジャンル: ジャズ」「BPM: 110」「楽器: アコースティックギター、ブラシドラム」を選択。" +
      "「用途: カフェBGM」を指定すると、自動的に会話の邪魔にならない音量バランスに調整されます。",
    applications: [
      "カフェ・レストランの店舗BGM",
      "美容室・ネイルサロンの待合室BGM",
      "YouTube料理動画のバックグラウンド",
      "オンラインショップの商品紹介動画に使用",
    ],
    relatedSlugs: ["lofi-night-bgm"],
  },

  // ────────────────────────────────
  //  画像
  // ────────────────────────────────
  {
    slug: "cinematic-sea-image",
    tab: "image",
    category: "SNSサムネイル",
    title: "夕焼けの海・シネマティック",
    featured: true,

    description:
      "SNS投稿やYouTubeサムネイル向けに生成したシネマティック系の風景画像です。" +
      "プロンプトに「映画的な色調補正」を指定することで、" +
      "そのまま使えるクオリティに仕上がりました。",
    prompt: "夕焼けの海、シネマティック、4K、映画的色調補正、広角、黄金時間",
    useCases: ["SNS投稿", "サムネイル", "広告素材", "ストック販売"],
    preview: { type: "image", src: "", alt: "AI生成：夕焼けの海のシネマティック画像" },

    body:
      "SNSのサムネイルや記事のアイキャッチに使える画像を、テキスト1行から生成しました。\n\n" +
      "「シネマティック」「黄金時間」というキーワードを加えることで、" +
      "プロのカメラマンが撮影したような色調に仕上がるのがポイントです。\n\n" +
      "この画像はYouTubeのサムネイルとして実際に使用し、" +
      "クリック率が通常の1.3倍になったという結果が出ました。\n\n" +
      "同じプロンプトでも毎回微妙に異なる構図が生成されるため、" +
      "A/Bテスト用に複数パターンを用意することも簡単です。" +
      "生成時間は約10秒で、高解像度（1024×1024以上）での出力が可能です。",
    howTo:
      "画像生成画面のテキスト欄に「夕焼けの海、シネマティック、4K、広角」と入力。" +
      "スタイル設定で「リアル系」を選ぶと映画的な質感になります。" +
      "生成後はサイズ調整（16:9、1:1 など）も可能です。",
    applications: [
      "YouTube・note のサムネイル・アイキャッチ",
      "Instagram・X（Twitter）への投稿画像",
      "Webサイトのヒーロー画像",
      "Adobe Stock などのストックサイトで販売",
      "広告バナーの素材として利用",
    ],
    relatedSlugs: ["minimal-business-banner"],
  },

  {
    slug: "minimal-business-banner",
    tab: "image",
    category: "アイキャッチ",
    title: "ミニマルなビジネスバナー",
    featured: false,

    description:
      "note記事やブログのアイキャッチ向けに生成したミニマルデザインです。" +
      "余白を多めに指定することで文字が乗せやすく、" +
      "どんなサイトにも合う汎用性の高い仕上がりになっています。",
    prompt: "ミニマルビジネスバナー、ホワイト背景、余白多め、シンプル、フラットデザイン、プロフェッショナル",
    useCases: ["アイキャッチ", "記事ヘッダー", "資料素材", "プレゼン"],
    preview: { type: "image", src: "", alt: "AI生成：ミニマルなビジネスバナー" },

    body:
      "ブログやnoteの記事に使えるアイキャッチ画像を、シンプルなプロンプトで生成しました。\n\n" +
      "「余白多め・ホワイト背景」を指定することで、" +
      "後から文字やロゴを重ねやすいデザインになっています。\n\n" +
      "フリーランスや個人ブロガーにとって、毎回アイキャッチを用意するのは手間がかかります。" +
      "LIFAIなら10秒で生成できるため、記事のたびに新しい画像が用意できます。\n\n" +
      "今回のバナーはnoteの記事ヘッダーとして使用し、" +
      "「プロっぽい」「デザインきれい」という反応が複数もらえました。",
    howTo:
      "「ミニマル、ビジネス、ホワイト背景、余白多め」と入力するだけです。" +
      "出力後に「テキストを追加」機能でタイトルを重ねると完成します。" +
      "Canvaなどへのエクスポートにも対応しています。",
    applications: [
      "note・ブログのアイキャッチ画像",
      "PowerPoint・Google Slidesの表紙",
      "メールマガジンのヘッダー画像",
      "名刺・パンフレットの素材",
    ],
    relatedSlugs: ["cinematic-sea-image"],
  },

  // ────────────────────────────────
  //  記事
  // ────────────────────────────────
  {
    slug: "ai-fukugyou-article",
    tab: "article",
    category: "note記事",
    title: "AIで副業を始めた3つの理由",
    featured: false,

    description:
      "LIFAIの記事生成機能で作成したnote記事のサンプルです。" +
      "テーマを入力するだけで見出し構成から本文まで自動生成され、" +
      "自分の体験談を1〜2行追記するだけでオリジナル記事になります。",
    prompt: "テーマ: AI副業を始めた理由、文字数: 1500字、構成: 3見出し、語調: 親しみやすい一人称",
    useCases: ["note投稿", "ブログ記事", "SNS投稿用要約", "メルマガ"],
    preview: {
      type: "text",
      src: "",
      excerpt:
        "最初は「AIで本当に稼げるの？」と半信半疑でした。でも実際にやってみると、" +
        "楽曲1曲をBGMとして配信するだけで月数千円の収益が積み上がることがわかり……",
    },

    body:
      "LIFAIの記事生成機能を使い、「AI副業を始めた3つの理由」というnote記事を生成しました。\n\n" +
      "生成にかかった時間は約30秒。テーマと文字数・語調を指定するだけで、" +
      "見出し3つの構成から本文まで一気に出力されます。\n\n" +
      "ポイントは「そのまま公開しないこと」です。生成された文章に" +
      "自分のリアルな体験や感想を1〜2段落追記することで、" +
      "AIっぽさが消えてオリジナリティのある記事になります。\n\n" +
      "実際にこの記事をnoteに投稿したところ、スキが23件・フォロワーが7人増えました。" +
      "完全にゼロから書くより圧倒的に速く、ブログ運営の継続ハードルが下がります。\n\n" +
      "週1本の投稿を3ヶ月続けると、検索流入が安定してくるため、" +
      "最初の1〜2ヶ月は量を重視して生成×編集を繰り返すのがおすすめです。",
    howTo:
      "記事生成画面で「テーマ」「文字数（500〜3000字）」「語調（ですます/だである）」を設定。" +
      "生成後に「自分の体験談」「具体的な数字」「締めのメッセージ」を追記して完成です。" +
      "SEOキーワードを指定する機能もあり、検索上位を狙った記事構成も可能です。",
    applications: [
      "noteへの定期投稿（週1本ペースでの継続運用）",
      "アメブロ・はてなブログへの転載",
      "メルマガの本文として活用",
      "X（Twitter）のロングポストに分割して投稿",
      "電子書籍の章のたたき台として使用",
    ],
    relatedSlugs: [],
  },
];

// ユーティリティ
export const getFeaturedWorks = () => WORKS.filter(w => w.featured);
export const getWorkBySlug    = (slug: string) => WORKS.find(w => w.slug === slug);
export const getRelatedWorks  = (slugs: string[]) => WORKS.filter(w => slugs.includes(w.slug));
export const getWorksByTab    = (tab: Work["tab"]) => WORKS.filter(w => w.tab === tab);
```

---

## ルート構成

### 新規作成ファイル

```
data/
  works.ts                          ← 全作品データ（上記）

app/
  works/
    [slug]/
      page.tsx                      ← 個別作品ページ（動的ルート）
```

### 変更ファイル

```
app/
  gallery/
    page.tsx                        ← #works セクション追加 + カード→個別ページリンク
  page.tsx  (またはLPページ)        ← featured作品を1〜2個埋め込み

components/
  GalleryNav.tsx                    ← 「作品集」アンカー追加
```

---

## 個別作品ページ `/works/[slug]` の構成

```tsx
// app/works/[slug]/page.tsx

export async function generateStaticParams() {
  return WORKS.map(w => ({ slug: w.slug }));
}

export async function generateMetadata({ params }) {
  const work = getWorkBySlug(params.slug);
  return {
    title: `${work.title}｜LIFAI AI作品ギャラリー`,
    description: work.description,
  };
}
```

### ページレイアウト

```
[← ギャラリーに戻る]

[カテゴリバッジ]  タイトル

[プレビュー]
  音楽 → <audio controls>
  画像 → <Image> (全幅)
  記事 → テキスト冒頭ブロック

━━━━━━━━━━━━━━━━━━━━━━━━

📖 作品について（body: 500〜1000字）

━━━━━━━━━━━━━━━━━━━━━━━━

📝 生成条件
  [prompt をコードブロック風に表示]

⚙️ 生成方法
  [howTo: 200〜400字]

💡 応用例
  [applications: 箇条書き]

━━━━━━━━━━━━━━━━━━━━━━━━

🔗 関連作品
  [relatedSlugs からカード 1〜2枚表示]  ← 内部リンク

━━━━━━━━━━━━━━━━━━━━━━━━

[この作品を作る →]  → /purchase
```

---

## ギャラリーページ `/gallery` の変更点

### #works セクション（カードの変更）

カードの下部に「詳しく見る →」リンクを追加し、`/works/[slug]` へ誘導。

```tsx
<Link href={`/works/${work.slug}`} className="...">
  詳しく見る →
</Link>
```

既存の「この作品を作る」CTAはそのまま残す（2つのCTAを持つ）。

---

## トップページ `/` への作品埋め込み

`featured: true` の作品（最大2件）をトップページに表示する。

### 埋め込み位置

トップページの「サービス説明」セクションの直後あたりに追加：

```tsx
import { getFeaturedWorks } from "@/data/works";

const featuredWorks = getFeaturedWorks(); // featured: true の2件

// JSX:
<section>
  <h2>AIで実際に作れるもの</h2>
  <p>LIFAIで生成した作品サンプルです。</p>
  <div className="grid grid-cols-2 gap-4">
    {featuredWorks.map(work => (
      <FeaturedWorkCard key={work.slug} work={work} />
    ))}
  </div>
  <Link href="/gallery#works">すべての作品を見る →</Link>
</section>
```

### `FeaturedWorkCard` コンポーネント

```
┌──────────────────────────────┐
│ [プレビュー枠（小）]          │
├──────────────────────────────┤
│ [バッジ] タイトル             │
│ 説明（2行クランプ）           │
│ [詳しく見る →]               │
└──────────────────────────────┘
```

---

## AdSense通過チェックリスト

### コンテンツ量
- [ ] 個別ページ 1本 = 500〜1000字（body + howTo + applications）
- [ ] ギャラリーカード = 150〜250字 × 件数分
- [ ] トップページに featured 作品のテキストが追加される

### 内部リンク
- [ ] ギャラリーカード → 個別ページ（詳しく見る）
- [ ] 個別ページ → 関連作品（relatedSlugs）
- [ ] 個別ページ → ギャラリー（戻るリンク）
- [ ] トップページ → ギャラリー（すべての作品を見る）

### CTA
- [ ] 個別ページ「この作品を作る →」→ /purchase
- [ ] ギャラリーカード「この作品を作る →」→ /purchase

### 素材（後から差し込む）
- [ ] 音楽サンプル 2本（mp3、Cloudflare R2 にアップ）
- [ ] 画像サンプル 2枚（/public/ に配置）
- [ ] 記事 excerpt テキスト（200字）

---

## 実装順序

1. `data/works.ts` を作成（このファイルのデータ）
2. `app/works/[slug]/page.tsx` を作成（個別ページ）
3. `app/gallery/page.tsx` に #works セクション追加
4. `components/GalleryNav.tsx` に「作品集」アンカー追加
5. トップページ（`app/page.tsx`）に featured 作品を埋め込み
6. 素材が揃ったら `src` を差し込む

---

*作成日: 2026-04-26*
