"use client";
import Link from "next/link";

export default function MiniGamesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🎮</span>
        <div>
          <h1 className="text-2xl font-bold">LIFAI Arcade</h1>
          <p className="text-white/40 text-sm">ミニゲームで報酬をゲット</p>
        </div>
      </div>

      {/* ゲーム一覧 */}
      <div className="grid grid-cols-1 gap-4">
        {/* ランブル */}
        <Link href="/mini-games/rumble" className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 hover:bg-white/10 transition block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h2 className="font-bold">Rumble Arena</h2>
                <p className="text-white/40 text-xs">週次ランキングで報酬獲得</p>
              </div>
            </div>
            <span className="bg-purple-500/20 text-purple-400 text-xs px-3 py-1 rounded-full">PLAY</span>
          </div>
        </Link>

        {/* タップゲーム */}
        <Link href="/mini-games/tap" className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 hover:bg-white/10 transition block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛏️</span>
              <div>
                <h2 className="font-bold">Tap Mining</h2>
                <p className="text-white/40 text-xs">毎日500タップでBP獲得</p>
              </div>
            </div>
            <span className="bg-purple-500/20 text-purple-400 text-xs px-3 py-1 rounded-full">PLAY</span>
          </div>
        </Link>
      </div>

      <Link href="/top" className="block text-center text-white/30 text-sm mt-10">
        ← ホームに戻る
      </Link>
    </div>
  );
}
