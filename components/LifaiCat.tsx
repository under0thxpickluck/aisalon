'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ─── Props ────────────────────────────────────────────────────────────────────
interface LifaiCatProps {
  loginId?: string;
  bp?: number;
  ep?: number;
  missions?: { fortune: boolean; music: boolean; login: boolean };
  radioToday?: boolean;
  currentPage?: 'top' | 'fortune' | 'mission' | 'radio' | 'gacha' | 'other';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSerif(props: LifaiCatProps): string {
  const { missions, radioToday, bp } = props;
  if (missions?.fortune === false) return '今日の占い、もう見た？🔮';
  if (missions?.login === false)   return 'ログインボーナス、受け取れるよ✨';
  if (missions?.music === false)   return 'ミッションあと少しで終わるね';
  if (radioToday === false)        return 'RADIO、今日の分まだあるよ🎵';
  if (bp !== undefined && bp >= 200) return 'BP余ってるし、何か使えそう💡';
  if (bp !== undefined && bp <= 50)  return 'BP少なめだね。まずは占いからかな';
  return '今日はなにから進める？';
}

function hasBadge(props: LifaiCatProps): boolean {
  const { missions, radioToday } = props;
  if (missions?.fortune === false) return true;
  if (missions?.login === false)   return true;
  if (missions?.music === false)   return true;
  if (radioToday === false)        return true;
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LifaiCat(props: LifaiCatProps) {
  const { bp, ep, missions, radioToday } = props;

  const [isOpen,     setIsOpen]     = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  const serif = getSerif(props);
  const badge = hasBadge(props);

  // ── Auto-bubble timer ─────────────────────────────────────────────────────
  useEffect(() => {
    // 1.5s 後に初回表示
    const initial = setTimeout(() => {
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 5000);
    }, 1500);

    // その後 90s ごとに表示
    const interval = setInterval(() => {
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 5000);
    }, 90_000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  // ── Todo list ─────────────────────────────────────────────────────────────
  const todos: { label: string; href: string }[] = [];
  if (missions?.fortune === false)
    todos.push({ label: '🔮 占いを見る +10BP',            href: '/fortune'    });
  if (missions?.login === false)
    todos.push({ label: '✨ ログインボーナス受け取る',     href: '/top'        });
  if (missions?.music === false)
    todos.push({ label: '📋 ミッションを確認',             href: '/top'        });
  if (radioToday === false)
    todos.push({ label: '🎵 RADIOを聴く +5EP',             href: '/top#radio'  });

  const allDone =
    todos.length === 0 &&
    missions !== undefined &&
    radioToday !== undefined;

  return (
    <>
      {/* ── Layer2: 吹き出し ─────────────────────────────────────────────── */}
      {showBubble && !isOpen && (
        <div className="fixed bottom-[88px] right-0 z-50 w-52 pr-5">
          <div className="relative bg-zinc-800 rounded-2xl p-3 text-sm text-white shadow-lg">
            {/* × ボタン */}
            <button
              className="absolute top-1.5 right-2 text-zinc-400 hover:text-white text-xs leading-none"
              onClick={() => setShowBubble(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            <p className="pr-5 leading-relaxed">{serif}</p>
            {/* 右下の小三角 */}
            <div
              className="absolute -bottom-2 right-5 w-0 h-0"
              style={{
                borderLeft:  '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop:   '8px solid #3f3f46', // zinc-800
              }}
            />
          </div>
        </div>
      )}

      {/* ── Layer3: ミニパネル ───────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-64 bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-xl">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-white text-sm">🐱 リファ猫</span>
            <button
              className="text-zinc-400 hover:text-white text-base leading-none"
              onClick={() => setIsOpen(false)}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>

          {/* 今日のおすすめ */}
          <p className="text-xs text-zinc-500 mb-2">今日のおすすめ</p>
          {allDone ? (
            <p className="text-xs text-emerald-400 mb-3">今日のミッション完了！🎉</p>
          ) : todos.length > 0 ? (
            <ul className="flex flex-col gap-2 mb-3">
              {todos.slice(0, 3).map(t => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    className="block text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400 mb-3">今日はなにから進める？</p>
          )}

          {/* セパレータ */}
          <div className="border-t border-zinc-700 my-3" />

          {/* BP / EP 残高 */}
          {(bp !== undefined || ep !== undefined) && (
            <p className="text-xs text-zinc-300 mb-3">
              {bp !== undefined && <span>💰 BP: {bp}</span>}
              {bp !== undefined && ep !== undefined && <span className="mx-2">　</span>}
              {ep !== undefined && <span>⚡ EP: {ep}</span>}
            </p>
          )}

          {/* 閉じるボタン */}
          <button
            className="w-full text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg py-1.5 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            閉じる
          </button>
        </div>
      )}

      {/* ── Layer1: 常駐アイコン ─────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => {
            setIsOpen(o => !o);
            setShowBubble(false);
          }}
          aria-label="リファ猫を開く"
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg"
          style={{
            animation: 'lifaiCatFloat 2.5s ease-in-out infinite',
          }}
        >
          {/* 未達バッジ */}
          {badge && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white" />
          )}
          {/* 猫アイコン（画像なければ絵文字） */}
          <CatIcon />
        </button>
      </div>

      {/* ふわふわアニメ用 keyframes */}
      <style>{`
        @keyframes lifaiCatFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}

// ─── CatIcon: /cat-icon.png があればそれを、なければ絵文字 ────────────────────
function CatIcon() {
  const [hasImg, setHasImg] = useState(true);
  if (!hasImg) return <span className="text-2xl select-none">🐱</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/cat-icon.png"
      alt="cat"
      width={36}
      height={36}
      className="rounded-full object-cover"
      onError={() => setHasImg(false)}
    />
  );
}
