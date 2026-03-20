"use client";
import { useState } from "react";
import Link from "next/link";

export default function MiniGamesPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [error, setError] = useState(false);

  if (!unlocked) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] gap-4">
      <div className="text-4xl mb-2">🎮</div>
      <h1 className="text-white font-bold text-xl">LIFAI Arcade</h1>
      <p className="text-white/40 text-sm">管理者パスワードを入力してください</p>
      <input
        type="password"
        value={pwInput}
        onChange={e => { setPwInput(e.target.value); setError(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") {
            if (pwInput === "nagoya01@") setUnlocked(true);
            else setError(true);
          }
        }}
        className="border border-white/20 bg-white/5 text-white rounded-xl px-4 py-2 text-sm w-64 text-center"
        placeholder="パスワード"
      />
      {error && <p className="text-red-400 text-xs">パスワードが違います</p>}
      <button
        onClick={() => {
          if (pwInput === "nagoya01@") setUnlocked(true);
          else setError(true);
        }}
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold"
      >
        入室する
      </button>
    </div>
  );

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
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 opacity-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h2 className="font-bold">Rumble Arena</h2>
                <p className="text-white/40 text-xs">キャラ育成・自動対戦</p>
              </div>
            </div>
            <span className="bg-white/10 text-white/40 text-xs px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>

        {/* タップゲーム */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 opacity-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👆</span>
              <div>
                <h2 className="font-bold">Tap Mining</h2>
                <p className="text-white/40 text-xs">連打でポイント獲得</p>
              </div>
            </div>
            <span className="bg-white/10 text-white/40 text-xs px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>
      </div>

      <Link href="/top" className="block text-center text-white/30 text-sm mt-10">
        ← ホームに戻る
      </Link>
    </div>
  );
}
