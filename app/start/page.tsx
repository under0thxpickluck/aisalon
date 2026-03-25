// app/start/page.tsx
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "LIFAIでできる副業｜音楽・記事・制作・ストック販売",
  description:
    "LIFAIの中でできる副業を、初心者向けに図解と文章でわかりやすく紹介します。",
};

export default function Page() {
  return (
    <main id="top" className="min-h-screen bg-neutral-50">
      {/* =====================
          HERO
      ====================== */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          {/* 上：ラベル＋最初に戻る */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-neutral-500">LIFAIでできる副業</p>

            {/* ✅ 最初に戻るボタン */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              ← 最初に戻る
            </Link>
          </div>

          {/* 上部ヒーロー画像 */}
          <div className="mb-5 overflow-hidden rounded-xl border bg-neutral-50">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src="/lifai/hero.png"
                alt="LIFAI｜AI×LIFE×副業"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 900px"
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
            副業って結局、何をするの？
          </h1>

          <p className="mt-4 text-sm leading-7 text-neutral-700">
            LIFAIでは、AIを使って「作る → 世に出す → 収益にする」までを
            一つの流れとして体験できます。
            <br />
            難しいスキルがなくても、型に沿って進めるだけで
            副業やアーティスト活動につなげることが可能です。
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
            LIFAIはこんなところ！
          </h1>

          <div className="mt-4 mb-5 overflow-hidden rounded-xl border bg-neutral-50">
            <div className="relative mx-auto aspect-[16/9] w-full max-w-3xl">
              <Image
                src="/mainv.png"
                alt="LIFAI | AI×LIFE副業"
                fill
                className="object-cover rounded-xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ✅ ADD START: 画像の下 / 副業内容の上（追加だけ） */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">
            会員ランクで「できること」が増える
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            金額というより使える権利の範囲が広がるイメージです。まずはStarterからでもOK。必要に応じて上に上がればOKです。
          </p>

          {/* ランクカード */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <RankCard
              name="Starter"
              catchPhrase="まず触ってみるための入口"
              items={[
                "基礎から触れられる",
                "まずは型で試せる",
                "コミュニティを見て学べる",
              ]}
              ep="4EP = 1円相当"
            />
            <RankCard
              name="Builder"
              catchPhrase="実践を始めるための土台"
              items={[
                "実践テンプレが使える",
                "SNS発信や導線づくりに進める",
                "コミュニティで発言できる",
              ]}
              ep="3.5EP = 1円相当"
              recommended
            />
            <RankCard
              name="Automation"
              catchPhrase="仕組み化に進むための加速枠"
              items={[
                "テンプレが大きく広がる",
                "AI生成環境に進める",
                "先行情報や応募枠が増える",
              ]}
              ep="3EP = 1円相当"
            />
            <RankCard
              name="Core"
              catchPhrase="成果を本気で狙う中核枠"
              items={[
                "非公開寄りの情報に触れられる",
                "優先枠や専用環境に近づく",
                "戦略参加レベルまで入れる",
              ]}
              ep="2.5EP = 1円相当"
              premium
            />
            <RankCard
              name="Infra"
              catchPhrase="深く関わる上位メンバー枠"
              items={[
                "運営に近い情報へアクセス",
                "共同PJや企画提案に関われる",
                "最上位の実行・影響レイヤー",
              ]}
              ep="2EP = 1円相当"
              premium
            />
          </div>
        </div>
      </section>
      {/* ✅ ADD END */}


      {/* =====================
          POINT SYSTEM
      ====================== */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <header className="mb-6">
            <p className="mb-2 text-xs font-bold tracking-wide text-neutral-500">
              Point System
            </p>
            <h2 className="text-xl font-bold text-neutral-900 md:text-2xl">
              LIFAIのポイントについて
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              LIFAIでは、用途の異なる2種類のポイントを採用しています。
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {/* EP */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <h3 className="text-lg font-bold text-neutral-900">
                EP（Exchange Point）
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                特典やギフトと交換できるポイントです。
              </p>

              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-900">
                  獲得できる主な方法
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  <li>紹介サービス</li>
                  <li>LIFAI独自のポイ活</li>
                  <li>ミニゲームへの参加</li>
                </ul>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-900">
                  利用・交換について
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  <li>サロン内特典・ギフトと交換可能</li>
                  <li>Amazonギフト券などへの交換（条件あり）</li>
                  <li>4EP＝1円相当（1EP＝0.25円相当）</li>
                  <li>月ごとの交換上限・有効期限あり</li>
                </ul>
              </div>

              <p className="mt-4 text-xs text-neutral-500">
                ※ 現金化・振込・出金はできません
              </p>
            </div>

            {/* BP */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <h3 className="text-lg font-bold text-neutral-900">
                BP（Bonus Point）
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                LIFAI内の体験や機能を広げるためのポイントです。
              </p>

              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-900">
                  獲得できる主な方法
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  <li>毎日占いなどのコンテンツ利用</li>
                  <li>ログインや簡単なアクション</li>
                  <li>広告視聴（対象者のみ）</li>
                </ul>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-900">
                  利用できる内容
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  <li>コミュニティ内の称号・優先権</li>
                  <li>抽選・キャンペーンへの参加</li>
                  <li>一部機能・サービスのアンロック</li>
                </ul>
              </div>

              <p className="mt-4 text-xs text-neutral-500">
                ※ ギフト交換・現金化はできません
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            ※ ポイントの付与条件・上限・交換内容は、ランクや運営状況により変更される場合があります。
          </p>
        </div>
      </section>

      {/* =====================
          RANK UP (TEXT + TABLE)
      ====================== */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <header className="mb-6">
            <p className="mb-2 text-xs font-bold tracking-wide text-neutral-500">
              Rank Up
            </p>
            <h2 className="text-xl font-bold text-neutral-900 md:text-2xl">
              ランクアップの仕組みについて
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              LIFAIでは、サービスの利用状況やアクションに応じて会員ランクが段階的に上がる仕組みを採用しています。
              ランクアップは<span className="font-semibold">「一定の条件を達成すること」</span>で行われ、
              金額だけでなく、実際の利用や行動でも条件を満たすことができます。
            </p>
          </header>

          {/* Explanation */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
            <h3 className="text-base font-bold text-neutral-900">
              ランクアップ条件の考え方
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700">
              各プランには、<span className="font-semibold">「条件達成MAX」</span>が設定されています。
              これは、いずれかの条件を満たすことで次のランクへ進める、という意味です。
              無理にすべてを達成する必要はなく、
              <span className="font-semibold">自分の使い方に合った方法を選べる設計</span>
              になっています。
            </p>
          </div>

          {/* Table (2 columns only) */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
            <div className="grid grid-cols-2 bg-neutral-50 text-xs font-bold text-neutral-600">
              <div className="p-4">プラン</div>
              <div className="p-4">条件達成MAX</div>
            </div>

            {/* $50 */}
            <div className="grid grid-cols-2 border-t border-neutral-200 text-sm">
              <div className="p-4 font-semibold text-neutral-900">$67</div>
              <div className="p-4 text-neutral-800">
                <ul className="list-disc space-y-1 pl-5">
                  <li>ワークフロー3件購入</li>
                  <li>14日ログインを継続</li>
                </ul>
                <p className="mt-2 text-xs text-neutral-500">※いずれか達成でOK</p>
              </div>
            </div>

            {/* $100 */}
            <div className="grid grid-cols-2 border-t border-neutral-200 text-sm">
              <div className="p-4 font-semibold text-neutral-900">$134</div>
              <div className="p-4 text-neutral-800">
                <ul className="list-disc space-y-1 pl-5">
                  <li>ワークフロー5件購入</li>
                  <li>BPを1,000消費</li>
                </ul>
                <p className="mt-2 text-xs text-neutral-500">※いずれか達成でOK</p>
              </div>
            </div>

            {/* $500 */}
            <div className="grid grid-cols-2 border-t border-neutral-200 text-sm">
              <div className="p-4 font-semibold text-neutral-900">$667</div>
              <div className="p-4 text-neutral-800">
                <ul className="list-disc space-y-1 pl-5">
                  <li>ワークフロー10件購入</li>
                  <li>BPの消費合計が3,000に到達</li>
                </ul>
                <p className="mt-2 text-xs text-neutral-500">※いずれか達成でOK</p>
              </div>
            </div>

            {/* $1000 */}
            <div className="grid grid-cols-2 border-t border-neutral-200 text-sm">
              <div className="p-4 font-semibold text-neutral-900">$1340</div>
              <div className="p-4 text-neutral-800">
                <ul className="list-disc space-y-1 pl-5">
                  <li>BPを5,000消費</li>
                  <li>紹介者が20人に到達</li>
                  <li>自社広告を1回出稿</li>
                </ul>
                <p className="mt-2 text-xs text-neutral-500">※いずれか達成でOK</p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            ※ 条件の内容や必要数は、運営状況により変更される場合があります。
          </p>
        </div>
      </section>


      {/* =====================>
          今できる副業一覧（4つ）
      ====================== */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">今できる副業例</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            LIFAIで今すぐ始められる副業はこの4つです。
            まずは「できそう」と思うものを1つ選んで、型に沿って進めるだけでOK。
            あとから別のルートに広げることもできます。
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "音楽作成 → 配信・BGM収益",
                desc: "AIでBGMや楽曲を作り、申請・提供。店舗BGMや配信ストアで聴かれて収益化。",
                tag: "初心者OK / 積み上がる",
                href: "#music-flow",
                icon: "/lifai/icon/music.png",
                alt: "音楽アイコン",
              },
              {
                title: "note自動生成（記事量産）",
                desc: "テーマと型を決めて記事を自動生成。投稿を積み上げて、収益導線につなげる。",
                tag: "最短で始めやすい",
                href: "#note-flow",
                icon: "/lifai/icon/note.png",
                alt: "noteアイコン",
              },
              {
                title: "HP・LP制作（テンプレ×AI）",
                desc: "テンプレで素早くページを作り、個人や企業に提供。受託にもつながる。",
                tag: "単価を上げたい人向け",
                href: "#lp-flow",
                icon: "/lifai/icon/lp.png",
                alt: "HP/LPアイコン",
              },
              {
                title: "写真・画像のストック販売",
                desc: "サムネやバナーを作って登録。ダウンロードされるほど収益が積み上がる。",
                tag: "量産で強い / 資産型",
                href: "#stock-flow",
                icon: "/lifai/icon/stock.png",
                alt: "画像販売アイコン",
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-xl border bg-neutral-50 p-5 transition hover:bg-white"
              >
                <div className="flex items-start gap-4">
                  {/* 左：画像 */}
                  <div className="shrink-0">
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl border bg-white">
                      <Image
                        src={item.icon}
                        alt={item.alt}
                        fill
                        className="object-contain p-2"
                        sizes="48px"
                      />
                    </div>
                  </div>

                  {/* 中：テキスト（伸びる） */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-neutral-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700">{item.desc}</p>
                    <p className="mt-3 inline-flex rounded-full border bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                      {item.tag}
                    </p>
                  </div>

                  {/* 右：→ */}
                  <div className="shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-neutral-700">
                      →
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold text-neutral-500 group-hover:text-neutral-700">
                  詳しく見る
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =====================
          音楽 → 配信（ストリーミング）図解ブロック
      ====================== */}
      <section id="music-flow" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">音楽を作って、配信して、収益にする</h2>

          <p className="mt-3 text-sm leading-7 text-neutral-700">
            AIで音楽やBGMを作って、配信のサービスに登録します。
            <br />
            すると、<b>配信ストアで聴かれる</b>のと、
            <b>LIFAIを通して、お店や会社のBGMとして使われる</b>、
            どちらも狙えます。
            <br />
            <b>聴かれる・使われるほど収益が増える</b>、これがこの副業の仕組みです。
          </p>

          <div className="mt-6 rounded-xl border bg-neutral-50 p-4">
            <div className="relative aspect-video">
              <Image
                src="/lifai/music-flow.png"
                alt="音楽→配信で収益になる流れ"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
                priority
              />
            </div>
            <p className="mt-3 text-xs text-neutral-600">※ 流れは「作る → 登録 → 配信/BGM → 収益」です。</p>
          </div>

          <div className="mt-7 rounded-xl border bg-neutral-50 p-6">
            <h3 className="text-sm font-bold text-neutral-900">何をするの？（超かんたん5ステップ）</h3>

            <ol className="mt-4 space-y-4 text-sm text-neutral-800">
              <li>
                <b>① 音楽を作る</b>
                <p className="mt-1 text-neutral-600">AIでBGMや音楽を作ります。まずは短い曲でもOKです。</p>
              </li>
              <li>
                <b>② 配信のサービスに登録する</b>
                <p className="mt-1 text-neutral-600">TuneCore や narasu などに登録して、曲を出せる状態にします。</p>
              </li>
              <li>
                <b>③ 配信ストアに出る</b>
                <p className="mt-1 text-neutral-600">Spotify や Apple Music などで、みんなが聴けるようになります。</p>
              </li>
              <li>
                <b>④ お店や会社のBGMでも使われる</b>
                <p className="mt-1 text-neutral-600">
                  LIFAIが音楽をまとめて管理し、お店や会社のBGMとして使われるよう手配します。
                </p>
              </li>
              <li>
                <b>⑤ 聴かれる・使われるほど収益</b>
                <p className="mt-1 text-neutral-600">
                  配信で聴かれたり、LIFAIを通してBGMとして使われたりすることで、少しずつ収益が増えていきます。
                </p>
              </li>
            </ol>

            <div className="mt-6 rounded-lg bg-white p-4">
              <p className="text-sm font-bold text-neutral-900">この副業のコツ</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>・最初は「作業用BGM」みたいに用途がわかりやすい曲が強い</li>
                <li>・1曲で勝負しない。曲が増えるほどチャンスも増える</li>
                <li>・副業がメイン。BGMの手配や配信はLIFAIがサポート</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =====================
          note自動生成 図解ブロック
      ====================== */}
      <section id="note-flow" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">noteを自動で作って、積み上げる</h2>

          <p className="mt-3 text-sm leading-7 text-neutral-700">
            テーマを決めて、AIで記事を自動生成します。
            <br />
            作った記事をnoteに投稿するだけで、<b>読まれるほど価値が積み上がる</b>副業です。
            <br />
            すぐに大きく稼ぐというより、<b>コツコツ続けて収益につなげる</b>のが特徴です。
          </p>

          <div className="mt-6 rounded-xl border bg-neutral-50 p-4">
            <div className="relative aspect-video">
              <Image
                src="/lifai/note-flow.png"
                alt="note自動生成の流れ"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border bg-neutral-50 p-6">
            <h3 className="text-sm font-bold text-neutral-900">何をするの？（5ステップ）</h3>

            <ol className="mt-4 space-y-4 text-sm text-neutral-800">
              <li>
                <b>① テーマを決める</b>
                <p className="mt-1 text-neutral-600">日記、体験談、学んだことなど、書くテーマを決めます。</p>
              </li>
              <li>
                <b>② AIで記事を作る</b>
                <p className="mt-1 text-neutral-600">テーマを入れるだけで、AIが文章を自動で作ります。</p>
              </li>
              <li>
                <b>③ noteに投稿する</b>
                <p className="mt-1 text-neutral-600">作った記事を、そのままnoteに投稿します。</p>
              </li>
              <li>
                <b>④ 読まれる・検索される</b>
                <p className="mt-1 text-neutral-600">記事が増えるほど、読まれるチャンスも増えます。</p>
              </li>
              <li>
                <b>⑤ 収益や次の仕事につながる</b>
                <p className="mt-1 text-neutral-600">noteの収益や、サービス紹介・別の副業につながります。</p>
              </li>
            </ol>
          </div>

          <div className="mt-6 rounded-lg bg-white p-4">
            <p className="text-sm font-bold text-neutral-900">この副業のポイント</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>・文章が苦手でもOK。AIがベースを作る</li>
              <li>・1記事ずつ積み上がるのが強み</li>
              <li>・他の副業（サービス・制作）にもつなげやすい</li>
            </ul>
          </div>
        </div>
      </section>

      {/* =====================
          HP/LP制作 図解ブロック
      ====================== */}
      <section id="lp-flow" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">HP・LPを作って、成果につなげる</h2>

          <p className="mt-3 text-sm leading-7 text-neutral-700">
            テンプレを使って、HPやLPをサクッと作ります。
            <br />
            「作って終わり」ではなく、<b>反応を見て直す</b>ことで成果が出やすくなります。
            <br />
            成果が出るほど<b>次の依頼やリピート</b>につながる、副業として強いルートです。
          </p>

          <div className="mt-6 rounded-xl border bg-neutral-50 p-4">
            <div className="relative aspect-video">
              <Image
                src="/lifai/lp-flow.png"
                alt="HP・LP制作の流れ"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border bg-neutral-50 p-6">
            <h3 className="text-sm font-bold text-neutral-900">何をするの？（5ステップ）</h3>

            <ol className="mt-4 space-y-4 text-sm text-neutral-800">
              <li>
                <b>① テンプレを選ぶ</b>
                <p className="mt-1 text-neutral-600">
                  業種に近いテンプレを選びます（飲食・美容・サービスなど）。
                </p>
              </li>
              <li>
                <b>② 内容を入れる</b>
                <p className="mt-1 text-neutral-600">
                  文章・画像・メニュー・料金・問い合わせ先を入れて形にします。
                </p>
              </li>
              <li>
                <b>③ 公開する（URLができる）</b>
                <p className="mt-1 text-neutral-600">ネット上に公開して、見てもらえる状態にします。</p>
              </li>
              <li>
                <b>④ 反応を見る</b>
                <p className="mt-1 text-neutral-600">
                  「問い合わせが来たか」「予約が増えたか」などを見ます。
                </p>
              </li>
              <li>
                <b>⑤ 直して成果 → 次の仕事へ</b>
                <p className="mt-1 text-neutral-600">
                  直して成果が出るほど信頼が増え、紹介やリピートにつながります。
                </p>
              </li>
            </ol>
          </div>

          <div className="mt-6 rounded-lg bg-white p-4">
            <p className="text-sm font-bold text-neutral-900">どうやって収益になる？</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>・HP/LPを作って「制作費」をもらう</li>
              <li>・成果が出たら「改善費」や「月のサポート」で継続収益</li>
              <li>・実績が増えるほど単価が上がる</li>
            </ul>
          </div>

          <div className="mt-6 rounded-lg border bg-neutral-50 p-4">
            <p className="text-sm font-bold text-neutral-900">初心者が迷わないコツ</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>・最初は「1ページのLP」からでOK</li>
              <li>・文章は長くしない（誰に何をしてほしいかだけ）</li>
              <li>・「問い合わせ」ボタンだけは必ず置く</li>
            </ul>
          </div>
        </div>
      </section>

      {/* =====================
          写真・画像販売 図解ブロック
      ====================== */}
      <section id="stock-flow" className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">写真・画像を作って、ストック販売する</h2>

          <p className="mt-3 text-sm leading-7 text-neutral-700">
            SNS投稿や広告、ブログなどで使われる写真や画像をストックサイトに登録します。
            <br />
            画像がダウンロードされるたびに収益が入り、
            <b>作った画像が増えるほど収益が積み上がる</b>副業です。
          </p>

          <div className="mt-6 rounded-xl border bg-neutral-50 p-4">
            <div className="relative aspect-video">
              <Image
                src="/lifai/stock-flow.png"
                alt="写真・画像販売の流れ"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          </div>

          <div className="mt-8 rounded-xl border bg-neutral-50 p-6">
            <h3 className="text-sm font-bold text-neutral-900">何をするの？（5ステップ）</h3>

            <ol className="mt-4 space-y-4 text-sm text-neutral-800">
              <li>
                <b>① 画像のテーマを決める</b>
                <p className="mt-1 text-neutral-600">SNS投稿用、広告用、ブログ用など用途を決めます。</p>
              </li>
              <li>
                <b>② AIやテンプレで画像を作る</b>
                <p className="mt-1 text-neutral-600">デザインが苦手でも、AIやテンプレで形にできます。</p>
              </li>
              <li>
                <b>③ ストックサイトに登録</b>
                <p className="mt-1 text-neutral-600">画像を登録して、販売できる状態にします。</p>
              </li>
              <li>
                <b>④ 他の人がダウンロード</b>
                <p className="mt-1 text-neutral-600">企業や個人が、SNSや広告用に画像を使います。</p>
              </li>
              <li>
                <b>⑤ ダウンロードごとに収益</b>
                <p className="mt-1 text-neutral-600">使われるたびに、少しずつ収益が入ります。</p>
              </li>
            </ol>
          </div>

          <div className="mt-6 rounded-lg bg-white p-4">
            <p className="text-sm font-bold text-neutral-900">この副業のポイント</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>・1枚あたりの収益は小さめ</li>
              <li>・画像を増やすほど安定しやすい</li>
              <li>・一度作った画像が長く収益を生む</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ✅ 最後のCTA（/visionへ） */}
      <section className="mx-auto max-w-5xl px-4 pb-14">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">もっとLIFAIを知る</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-700">
            LIFAIが目指している世界観、ポイント設計、安全寄せの考え方、将来の拡張（VPS/共同プロジェクト）などは
            Visionにまとめています。
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/vision"
              className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              Visionを見る →
            </Link>

            {/* ついでに「ページ上部へ」も置いとく（便利） */}
            <Link
              href="#top"
              className="inline-flex items-center justify-center rounded-xl border bg-white px-5 py-3 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50"
            >
              ページ上部へ ↑
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-neutral-500">
          © {new Date().getFullYear()} LIFAI
        </div>
      </footer>
    </main>
  );
}

/* ✅ ADD: JSXの外に置く（ビルドエラー回避のため） */
function RankCard({
  name,
  catchPhrase,
  items,
  ep,
  recommended = false,
  premium = false,
}: {
  name: string;
  catchPhrase: string;
  items: string[];
  ep: string;
  recommended?: boolean;
  premium?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 ${
        premium
          ? "border-neutral-700 bg-gradient-to-br from-neutral-800 to-neutral-950 shadow-lg"
          : "border-neutral-200 bg-neutral-50"
      }`}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-neutral-900 shadow">
            おすすめ
          </span>
        </div>
      )}

      <div>
        <p
          className={`text-2xl font-black tracking-tight ${
            premium ? "text-white" : "text-neutral-900"
          }`}
        >
          {name}
        </p>
        <p
          className={`mt-1 text-xs leading-5 ${
            premium ? "text-neutral-400" : "text-neutral-500"
          }`}
        >
          {catchPhrase}
        </p>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs">
            <span
              className={`mt-0.5 shrink-0 font-bold ${
                premium ? "text-neutral-500" : "text-neutral-400"
              }`}
            >
              ✓
            </span>
            <span className={premium ? "text-neutral-300" : "text-neutral-700"}>
              {item}
            </span>
          </li>
        ))}
      </ul>

      <div
        className={`mt-4 border-t pt-3 text-xs font-semibold ${
          premium
            ? "border-neutral-700 text-neutral-400"
            : "border-neutral-200 text-neutral-500"
        }`}
      >
        {ep}
      </div>
    </div>
  );
}
