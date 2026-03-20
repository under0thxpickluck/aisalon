"use client";

export default function MusicReleaseGuidePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">🎵 音楽リリースガイド</h1>
      <p className="text-white/50 text-sm mb-8">LIFAIで生成した楽曲を世界に届ける方法</p>

      {/* Narasu */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-bold">Narasu</h2>
          <span className="bg-yellow-400 text-black text-xs px-2 py-0.5 rounded-full font-bold">おすすめ</span>
        </div>
        <p className="text-white/60 text-sm mb-4">
          日本発の音楽配信サービス。初心者でも簡単にリリースできます。
        </p>
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-bold text-white/80">📋 必要な準備</h3>
          <ul className="text-sm text-white/60 space-y-1 list-disc list-inside">
            <li>楽曲ファイル（MP3）</li>
            <li>アルバムジャケット（3000×3000px以上・JPGまたはPNG）</li>
            <li>アーティスト名</li>
            <li>楽曲タイトル</li>
            <li>リリース希望日</li>
          </ul>
        </div>
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-bold text-white/80">📝 申請手順</h3>
          <ol className="text-sm text-white/60 space-y-1 list-decimal list-inside">
            <li>Narasuにアカウント登録</li>
            <li>楽曲をアップロード</li>
            <li>ジャケット・情報を入力</li>
            <li>審査後に配信開始</li>
          </ol>
        </div>
        <a
          href="https://narasu.jp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center font-bold text-sm"
        >
          Narasuで申請する →
        </a>
      </div>

      {/* Tunecore */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-bold mb-3">TuneCore</h2>
        <p className="text-white/60 text-sm mb-4">
          世界150以上の配信先に楽曲を届けられる老舗サービス。Spotify・Apple Music等に配信可能。
        </p>
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-bold text-white/80">📋 必要な準備</h3>
          <ul className="text-sm text-white/60 space-y-1 list-disc list-inside">
            <li>楽曲ファイル（WAVまたはMP3）</li>
            <li>アルバムジャケット（3000×3000px以上・JPG）</li>
            <li>アーティスト名</li>
            <li>楽曲タイトル・作詞作曲者名</li>
            <li>年間登録料（シングル：約1,500円/年）</li>
          </ul>
        </div>
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-bold text-white/80">📝 申請手順</h3>
          <ol className="text-sm text-white/60 space-y-1 list-decimal list-inside">
            <li>TuneCoreにアカウント登録</li>
            <li>「シングルを配信」を選択</li>
            <li>楽曲・ジャケット・情報を入力</li>
            <li>配信先を選択（全配信先推奨）</li>
            <li>料金支払い後に申請完了</li>
            <li>審査後（約1週間）に配信開始</li>
          </ol>
        </div>
        <a
          href="https://www.tunecore.co.jp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full py-3 rounded-xl border border-white/20 text-white text-center font-bold text-sm"
        >
          TuneCoreで申請する →
        </a>
      </div>

      {/* ジャケット作成のヒント */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold mb-3">🎨 ジャケット作成のヒント</h2>
        <p className="text-white/60 text-sm mb-3">
          ジャケットは無料ツールで簡単に作れます。
        </p>
        <ul className="text-sm text-white/60 space-y-2 list-disc list-inside">
          <li>Canva（無料・テンプレート豊富）</li>
          <li>Adobe Express（無料・高品質）</li>
          <li>サイズは必ず3000×3000px以上</li>
          <li>文字は読みやすいフォントを使用</li>
        </ul>
      </div>

      <a
        href="/music2"
        className="block text-center text-white/40 text-sm"
      >
        ← 音楽生成に戻る
      </a>
    </div>
  );
}
