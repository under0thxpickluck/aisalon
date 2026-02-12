export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold mb-10 tracking-wide">
          プライバシーポリシー
        </h1>

        <div className="space-y-10 text-sm leading-relaxed text-slate-300">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              1. 取得する情報
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>メールアドレス</li>
              <li>LINEアカウント情報（お問い合わせ時）</li>
              <li>ウォレットアドレス（USDT送金確認）</li>
              <li>アクセスログ・利用履歴</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              2. 利用目的
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>サービス提供および本人確認</li>
              <li>お問い合わせ対応</li>
              <li>不正防止・安全管理</li>
              <li>サービス改善</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              3. 第三者提供
            </h2>
            <p>
              法令に基づく場合を除き、本人の同意なく第三者へ提供することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              4. データ管理
            </h2>
            <p>
              個人情報は適切なセキュリティ対策のもと管理し、
              不正アクセス・漏えいの防止に努めます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              5. 改定
            </h2>
            <p>
              本ポリシーは必要に応じて改定される場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              6. 運営主体および連絡先
            </h2>
            <p>運営主体：LIFAI運営事務局</p>
            <p>メール：support@◯◯</p>
            <p>
              公式LINE：
              <a
                href="https://lin.ee/ERKwqcj"
                target="_blank"
                className="text-indigo-400 hover:text-indigo-300 underline ml-1"
              >
                LIFAI公式LINE
              </a>
            </p>
            <p className="text-xs text-slate-500 mt-2">
              ※返信保証はありません。順次対応いたします。
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
