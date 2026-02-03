// app/invest/page.tsx
import Link from "next/link";
import Image from "next/image";
import InvestGate from "./_gate";

export const metadata = {
  title: "LIFAIに出資をご検討いただく皆様へ | LIFAI",
  description:
    "LIFAIの出資について、位置づけ、売上分配モデル、回収見込み、資金使途、メリットをわかりやすくまとめています。",
};

type Tier = {
  amount: string;
  rate: string;
  payback: string;
};

const TIERS: Tier[] = [
  { amount: "100万円", rate: "売上の5％", payback: "約12〜18ヶ月" },
  { amount: "300万円", rate: "売上の7％", payback: "約10〜15ヶ月" },
  { amount: "500万円", rate: "売上の10％", payback: "約8〜12ヶ月" },
];

const EXAMPLE_SALES = 200; // 万円
const exampleText = [
  {
    rate: 5,
    label: "売上5％",
    value: Math.round(EXAMPLE_SALES * 0.05 * 10) / 10, // 万円
  },
  { rate: 7, label: "売上7％", value: Math.round(EXAMPLE_SALES * 0.07 * 10) / 10 },
  {
    rate: 10,
    label: "売上10％",
    value: Math.round(EXAMPLE_SALES * 0.1 * 10) / 10,
  },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm">
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
}) {
  return (
    <header className="mb-4">
      {eyebrow ? (
        <p className="mb-2 text-xs font-bold tracking-wide text-neutral-500">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-bold text-neutral-900 md:text-2xl">{title}</h2>
      {desc ? (
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{desc}</p>
      ) : null}
    </header>
  );
}

export default function Page() {
  return (
    <InvestGate>
      <main className="min-h-screen bg-neutral-50">
        {/* =====================
            HERO
        ====================== */}
        <section className="mx-auto max-w-5xl px-4 pb-6 pt-12">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge>For Supporters / Investors</Badge>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/start"
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  副業ページを見る
                </Link>
                <Link
                  href="/vision"
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  LIFAIが目指すVisionを見る
                </Link>
              </div>
            </div>

            <h1 className="mt-5 text-2xl font-black leading-tight text-neutral-900 md:text-3xl">
              LIFAIに出資をご検討いただく皆様へ
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-neutral-700 md:text-base">
              LIFAIは、
              <span className="font-semibold">
                「個人がスキルや時間に縛られず、仕組みとして収益を生み出せる世界」
              </span>
              を実現するために設計されたプロジェクトです。
              <br />
              AI・テンプレート・自動化ワークフローにより、
              <span className="font-semibold">
                誰が関わっても再現性を持って回る事業構造
              </span>
              の構築を目指しています。
            </p>

            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">
                本ページのご案内
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                <li className="rounded-lg bg-white p-3 shadow-sm">
                  LIFAIの出資について
                </li>
                <li className="rounded-lg bg-white p-3 shadow-sm">
                  売上分配モデル
                </li>
                <li className="rounded-lg bg-white p-3 shadow-sm">
                  回収見込みの考え方
                </li>
                <li className="rounded-lg bg-white p-3 shadow-sm">
                  出資金の使い道・メリット
                </li>
              </ul>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-neutral-500">
              ※本ページは事業内容の説明を目的としたものであり、利益や回収時期を保証するものではありません。
            </p>
          </div>
        </section>

        {/* =====================
            BODY
        ====================== */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid gap-6">
            {/* 位置づけ */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <SectionTitle
                eyebrow="Position"
                title="LIFAIの出資について"
                desc="LIFAIへの出資は、短期的な利益を狙う投機的なものではありません。実際の事業売上に連動して分配を行う仕組みです。"
              />
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  "元本保証・固定利回りを約束するものではありません",
                  "分配は月次実売上を基準として変動します",
                  "LIFAIが目指すVisionに沿った長期成長モデルへの参加です",
                ].map((t) => (
                  <div
                    key={t}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700"
                  >
                    <span className="font-semibold text-neutral-900">✓</span>{" "}
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* 分配モデル */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <SectionTitle
                eyebrow="Revenue Share"
                title="出資と売上分配の考え方"
                desc="ご出資額に応じて、LIFAI全体の月次実売上に対する一定割合を分配します。"
              />

              <div className="overflow-hidden rounded-2xl border border-neutral-200">
                <div className="grid grid-cols-3 bg-neutral-50 text-xs font-bold text-neutral-600">
                  <div className="p-4">出資額</div>
                  <div className="p-4">売上分配率</div>
                  <div className="p-4">回収見込み</div>
                </div>
                {TIERS.map((t, idx) => (
                  <div
                    key={t.amount}
                    className={`grid grid-cols-3 text-sm ${
                      idx !== TIERS.length - 1 ? "border-t border-neutral-200" : ""
                    }`}
                  >
                    <div className="p-4 font-semibold text-neutral-900">
                      {t.amount}
                    </div>
                    <div className="p-4 text-neutral-800">{t.rate}</div>
                    <div className="p-4 text-neutral-800">{t.payback}</div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                ※売上分配率は「LIFAI全体の月次実売上」に対する割合です。※回収見込みは目安であり保証されるものではありません。
              </p>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-sm font-bold text-neutral-900">
                  分配イメージ（例）
                </p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-700">
                  LIFAI全体の月間売上が{" "}
                  <span className="font-semibold">{EXAMPLE_SALES}万円</span>{" "}
                  の場合、分配原資の目安は以下の通りです。
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {exampleText.map((e) => (
                    <div key={e.label} className="rounded-xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold text-neutral-500">{e.label}</p>
                      <p className="mt-1 text-lg font-black text-neutral-900">
                        月 {e.value}万円相当
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        ※実際の分配額は売上状況により変動
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 回収見込み */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <SectionTitle
                eyebrow="Payback"
                title="回収見込み期間の考え方"
                desc="回収見込み期間は、現在の売上設計・テスト運用時の推移をもとに算出しています。過度に楽観的な想定を避け、比較的保守的な期間を目安にしています。"
              />
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-sm font-semibold text-neutral-900">目安の考え方</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700">
                  <li>仕組み構築（AI・テンプレ・導線）の強化期間を織り込む</li>
                  <li>売上が積み上がるまでの立ち上げ期間を織り込む</li>
                  <li>安定運用を前提に、無理のない想定を採用する</li>
                </ul>
              </div>
            </div>

            {/* 協業（認知/広告） */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <SectionTitle
                eyebrow="Collaboration / Awareness"
                title="お金だけでなく「認知を増やす協力」ができる仕組み"
                desc="LIFAIは資金協力だけでなく、支援企業の“認知・集客・検証”を増やすための協業枠も用意しています。"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <p className="text-sm font-bold text-neutral-900">① 自社宣伝バナーの表示枠</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                    支援企業様は、LIFAI内の所定エリアに
                    <span className="font-semibold">自社バナー（ロゴ・LPリンク）</span>
                    を掲載できます。
                    <br />
                    「プロジェクトに参加している企業」として露出を増やし、
                    認知の土台を作ることが目的です。
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700">
                    <li>掲載場所：TOP / コンテンツ内 / 専用紹介ページ（予定）</li>
                    <li>掲載形式：バナー画像＋リンク（＋短い紹介文）</li>
                    <li>掲載ルール：公序良俗・法令・審査基準に沿って運用</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <p className="text-sm font-bold text-neutral-900">② 自社広告を回す（会員はBP獲得）</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                    支援企業様は、LIFAI内で自社の広告/告知を配信できます。
                    <br />
                    会員側は広告閲覧・指定アクション（例：LP閲覧/登録/体験など）で
                    <span className="font-semibold">BP（ポイント）</span>を獲得できるため、
                    “認知拡大”と“会員メリット”の両方が成立します。
                  </p>

                  <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold text-neutral-500">流れ（イメージ）</p>
                    <ol className="mt-2 space-y-1 text-sm text-neutral-700">
                      <li>1) 企業が広告/告知を掲載（期間・上限・条件を設定）</li>
                      <li>2) 会員が閲覧/アクション</li>
                      <li>3) 条件達成で会員にBP付与</li>
                      <li>4) 企業は認知・流入・検証データを得られる</li>
                    </ol>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                    ※BP付与は運営ルールに従い、上限・審査・不正防止を実装して運用します（保証ではありません）。
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-sm font-bold text-neutral-900">
                  目的：協業による「認知・集客・検証」を増やす
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                  LIFAIは “出資＝お金だけ” ではなく、
                  <span className="font-semibold">支援企業の露出・導線・検証</span>を増やすことも
                  同時に行い、プロジェクト全体の成長を加速させます。
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    { t: "企業側", d: "認知・流入・検証（広告枠/バナー枠）" },
                    { t: "会員側", d: "BP獲得で学習/活動のメリットが増える" },
                    { t: "LIFAI側", d: "協業が増えるほど価値が積み上がる" },
                  ].map((x) => (
                    <div key={x.t} className="rounded-xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold text-neutral-500">{x.t}</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-900">{x.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-neutral-500">
                ※広告・バナー掲載は、運営の審査とガイドラインに基づき実施します。成果や費用対効果を保証するものではありません。
              </p>
            </div>

            {/* invest.png（使い道の前に表示） */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm overflow-hidden">
              <div className="relative w-full aspect-[16/9] md:aspect-[21/9]">
                <Image
                  src="/invest.png"
                  alt="LIFAI 投資者向けイメージ"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* 使い道 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <SectionTitle
                eyebrow="Use of Funds"
                title="ご出資金の使い道"
                desc="ご出資いただいた資金は、LIFAI事業の成長に直結する用途にのみ使用します。個人の報酬や不透明な費用には使用しません。"
              />
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  "AIシステム・自動化基盤の開発",
                  "テンプレート・ワークフロー・教材の拡充",
                  "サーバー・インフラの強化",
                  "集客・広告テスト",
                  "法務・運営体制の整備",
                ].map((t) => (
                  <div
                    key={t}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700"
                  >
                    <span className="font-semibold text-neutral-900">•</span>{" "}
                    {t}
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-neutral-700">
                これらはすべて、副業ページで紹介している各副業モデルを{" "}
                <span className="font-semibold">
                  安定して回し続けるための基盤投資
                </span>
                です。
              </p>
            </div>

            {/* メリット */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <SectionTitle
                eyebrow="Benefits"
                title="出資いただくメリット"
                desc="数字の透明性と、属人的な運用に依存しない仕組みを前提に、長期的な成長に参加できます。"
              />
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  "売上に連動して分配される、シンプルな仕組み",
                  "売上・分配の根拠が見える、透明な運営",
                  "人に依存しない、テンプレートと自動化の積み重ね",
                  "長期で事業価値を伸ばす成長フェーズへの参加",
                ].map((t) => (
                  <div
                    key={t}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700"
                  >
                    <span className="font-semibold text-neutral-900">✓</span>{" "}
                    {t}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-sm font-bold text-neutral-900">お問い合わせ</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                  出資に関する詳細条件（契約形態・分配方法・レポート形式など）は、
                  個別にご案内します。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/start"
                    className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700"
                  >
                    副業ページへ
                  </Link>
                  <Link
                    href="/"
                    className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    TOPへ戻る
                  </Link>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-neutral-500">
                ※本ページは説明目的です。投資助言・勧誘ではなく、契約にあたっては別途書面等で条件を提示します。
              </p>
            </div>
          </div>
        </section>
      </main>
    </InvestGate>
  );
}
