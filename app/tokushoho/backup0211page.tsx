export default function TokushohoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold mb-10 tracking-wide">
          特定商取引法に基づく表記
        </h1>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              販売事業者
            </h2>
            <p>LIFAI運営事務局</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              お問い合わせ
            </h2>
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
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              販売価格
            </h2>
            <p>各プランページに表示されたUSDT価格</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              支払方法
            </h2>
            <p>USDT（仮想通貨）による一括支払い</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              役務提供時期
            </h2>
            <p>送金確認および承認完了時点より開始</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              返品・返金について
            </h2>
            <p>
              ・役務提供開始後の返金は行いません。
              <br />
              ・プレセール期間中に設定された目標金額に達しなかった場合、
              役務提供開始前に限り全額USDTにて返金を行います。
              <br />
              ・返金時にネットワーク手数料が発生する場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              表現および再現性
            </h2>
            <p>
              本サービスは学習・実践環境の提供を目的とし、
              収益や成果を保証するものではありません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              運営主体の変更
            </h2>
            <p>
              本サービスの運営主体は、事業譲渡・会社分割・合併等により
              変更される場合があります。
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
