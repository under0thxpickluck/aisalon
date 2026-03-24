'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// ─── Rules (AIBot/rules.ts から統合) ─────────────────────────────────────────
type Cat = 'normal' | 'confused';

type CTADef = {
  label: string;
  action: 'scroll_to' | 'navigate' | 'dismiss';
  target?: string;
};

type Rule = {
  id: string;
  trigger: 'page_view' | 'error_event';
  page_id?: string;
  error_code?: string;
  delay_ms: number;
  cat: Cat;
  message: string;
  cta: CTADef[];
  condition?: (payload: Record<string, string>) => boolean;
};

const CAT_RULES: Rule[] = [
  {
    id: 'market_home',
    trigger: 'page_view',
    page_id: 'market_home',
    delay_ms: 3000,
    cat: 'normal',
    message: '人気の画像パックや音楽パックがあります。見てみますか？',
    cta: [
      { label: '商品を見る', action: 'scroll_to', target: 'item-grid' },
      { label: 'あとで', action: 'dismiss' },
    ],
  },
  {
    id: 'market_create',
    trigger: 'page_view',
    page_id: 'market_create',
    delay_ms: 2000,
    cat: 'normal',
    message: '出品ルール：画像は100枚〜、音楽は10曲〜、最低価格は50からです。',
    cta: [
      { label: '出品を始める', action: 'scroll_to', target: 'create-form' },
      { label: '閉じる', action: 'dismiss' },
    ],
  },
  {
    id: 'insufficient_balance',
    trigger: 'error_event',
    error_code: 'insufficient_balance',
    delay_ms: 0,
    cat: 'confused',
    message: '残高が足りないみたいです。ウォレットを確認しますか？',
    cta: [
      { label: '残高を見る', action: 'navigate', target: '/wallet' },
      { label: '閉じる', action: 'dismiss' },
    ],
  },
  {
    id: 'top_home',
    trigger: 'page_view',
    page_id: 'top_home',
    delay_ms: 5000,
    cat: 'normal',
    message: '使いたい機能をアイコンから選んでね。BGM生成やマーケットが人気だよ！',
    cta: [
      { label: 'BGM生成を試す', action: 'navigate', target: '/music' },
      { label: 'マーケットを見る', action: 'navigate', target: '/market' },
    ],
  },
  {
    id: 'top_wallet',
    trigger: 'page_view',
    page_id: 'top_home',
    delay_ms: 10000,
    cat: 'normal',
    message: 'BPやEPが溜まってるね！マーケットで使えるよ。',
    cta: [
      { label: 'マーケットを見る', action: 'navigate', target: '/market' },
      { label: '閉じる', action: 'dismiss' },
    ],
    condition: (payload) =>
      Number(payload.bp ?? 0) >= 1000 || Number(payload.ep ?? 0) >= 1000,
  },
];

// ─── Context types ────────────────────────────────────────────────────────────
type BotMessage = {
  ruleId: string;
  cat: Cat;
  message: string;
  cta: CTADef[];
};

type LifaiCatContextType = {
  trackEvent: (eventName: string, payload?: Record<string, string>) => void;
  currentMessage: BotMessage | null;
  hasUnread: boolean;
  bubbleVisible: boolean;
  isOpen: boolean;
  setIsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  dismissMessage: () => void;
  dismissBubble: () => void;
};

const LifaiCatContext = createContext<LifaiCatContextType | null>(null);

// localStorage key — AIBot から引き継ぐため同一キー
const SEEN_KEY = 'lifai_aibot_seen_v1';
const COOLDOWN_MS = 60_000;
const BUBBLE_DURATION_MS = 8_000;

function getSeenFlags(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function markSeen(ruleId: string) {
  const flags = getSeenFlags();
  flags[ruleId] = true;
  localStorage.setItem(SEEN_KEY, JSON.stringify(flags));
}

// ─── LifaiCatProvider ─────────────────────────────────────────────────────────
export function LifaiCatProvider({ children }: { children: React.ReactNode }) {
  const [currentMessage, setCurrentMessage] = useState<BotMessage | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const lastFiredAt = useRef<number>(0);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((msg: BotMessage) => {
    setCurrentMessage(msg);
    setHasUnread(true);
    setBubbleVisible(true);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(
      () => setBubbleVisible(false),
      BUBBLE_DURATION_MS,
    );
  }, []);

  const trackEvent = useCallback(
    (eventName: string, payload?: Record<string, string>) => {
      const now = Date.now();
      if (now - lastFiredAt.current < COOLDOWN_MS) return;

      const seenFlags = getSeenFlags();

      for (const rule of CAT_RULES) {
        if (seenFlags[rule.id]) continue;

        const matches =
          (rule.trigger === 'page_view' &&
            eventName === 'page_view' &&
            rule.page_id === payload?.page_id) ||
          (rule.trigger === 'error_event' &&
            eventName === 'error_event' &&
            rule.error_code === payload?.error_code);

        if (!matches) continue;
        if (rule.condition && !rule.condition(payload ?? {})) continue;

        lastFiredAt.current = now;
        markSeen(rule.id);

        const msg: BotMessage = {
          ruleId: rule.id,
          cat: rule.cat,
          message: rule.message,
          cta: rule.cta,
        };

        if (rule.delay_ms > 0) {
          setTimeout(() => showMessage(msg), rule.delay_ms);
        } else {
          showMessage(msg);
        }
        break;
      }
    },
    [showMessage],
  );

  const dismissMessage = useCallback(() => {
    setCurrentMessage(null);
    setHasUnread(false);
    setBubbleVisible(false);
  }, []);

  const dismissBubble = useCallback(() => {
    setBubbleVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  return (
    <LifaiCatContext.Provider
      value={{
        trackEvent,
        currentMessage,
        hasUnread,
        bubbleVisible,
        isOpen,
        setIsOpen,
        dismissMessage,
        dismissBubble,
      }}
    >
      {children}
    </LifaiCatContext.Provider>
  );
}

// ─── useLifaiCat hook ─────────────────────────────────────────────────────────
export function useLifaiCat(): LifaiCatContextType {
  const ctx = useContext(LifaiCatContext);
  if (!ctx) throw new Error('useLifaiCat must be used within LifaiCatProvider');
  return ctx;
}

// ─── LifaiCat Widget Props ────────────────────────────────────────────────────
interface LifaiCatProps {
  loginId?: string;
  bp?: number;
  ep?: number;
  missions?: { fortune: boolean; music: boolean; login: boolean };
  radioToday?: boolean;
  currentPage?: 'top' | 'fortune' | 'mission' | 'radio' | 'gacha' | 'other';
}

// ─── Props-based serif ────────────────────────────────────────────────────────
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

function hasPropsBadge(props: LifaiCatProps): boolean {
  const { missions, radioToday } = props;
  if (missions?.fortune === false) return true;
  if (missions?.login === false)   return true;
  if (missions?.music === false)   return true;
  if (radioToday === false)        return true;
  return false;
}

// ─── Chat keyword reply ───────────────────────────────────────────────────────
function getCatReply(input: string): string {
  if (/BP|ポイント/.test(input))           return '占いやミッションで毎日BPが増やせるよ';
  if (/占い/.test(input))                  return '団子占いは毎日10BP獲得できるよ。今日もう見た？';
  if (/音楽|music/i.test(input))           return 'BGM生成は90BPで使えるよ。テーマを入れるだけ！';
  if (/ミッション/.test(input))            return '毎日のミッションをこなすと最大50BP/日もらえるよ';
  if (/RADIO|ラジオ/i.test(input))         return 'RADIOでは作業しながらEPが獲得できるよ';
  if (/副業|稼ぐ/.test(input))             return 'まずはミッションと占いから始めよう。毎日続けるのが大事！';
  if (/ガチャ/.test(input))                return '100BPで回せるよ。排出率はパネルで確認してね';
  if (/何|わからない|迷/.test(input))      return '今日はなにから進める？まずは占いとミッションがおすすめだよ';
  return 'うーん、それはぼくには難しいな。でもBPやミッションのことなら答えられるよ！';
}

type ChatEntry = { from: 'user' | 'cat'; text: string };

// ─── LifaiCat Widget ──────────────────────────────────────────────────────────
export default function LifaiCat(props: LifaiCatProps) {
  const { bp, ep, missions, radioToday } = props;
  const router = useRouter();

  // チャットモード
  const [isChat, setIsChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || isWaiting) return;
    setChatInput('');
    setChatHistory(prev => [...prev, { from: 'user', text }]);
    setIsWaiting(true);
    try {
      const res = await fetch('/api/cat-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory.slice(-5) }),
      });
      const data = await res.json();
      const reply = data.ok ? data.reply : 'ごめんね、うまく答えられなかったよ🙀';
      setChatHistory(prev => [...prev, { from: 'cat', text: reply }]);
    } catch {
      setChatHistory(prev => [...prev, { from: 'cat', text: 'ごめんね、通信エラーが起きたよ🙀' }]);
    } finally {
      setIsWaiting(false);
    }
  };

  const {
    currentMessage,
    hasUnread,
    bubbleVisible,
    isOpen,
    setIsOpen,
    dismissMessage,
    dismissBubble,
  } = useLifaiCat();

  // Props-based auto-bubble（trackEvent メッセージがない時に表示）
  const [showPropsBubble, setShowPropsBubble] = useState(false);
  const currentMessageRef = useRef(currentMessage);
  currentMessageRef.current = currentMessage;

  useEffect(() => {
    const initial = setTimeout(() => {
      if (!currentMessageRef.current) {
        setShowPropsBubble(true);
        setTimeout(() => setShowPropsBubble(false), 5000);
      }
    }, 1500);

    const interval = setInterval(() => {
      if (!currentMessageRef.current) {
        setShowPropsBubble(true);
        setTimeout(() => setShowPropsBubble(false), 5000);
      }
    }, 90_000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const catSrc =
    currentMessage?.cat === 'confused'
      ? '/aibot/cat_confused.png'
      : '/aibot/cat_normal.png';

  const serif = getSerif(props);
  const badge = hasUnread || hasPropsBadge(props);

  // 表示するバブル: trackEvent メッセージ優先、なければ props ベース
  const showTrackBubble = bubbleVisible && !!currentMessage && !isOpen;
  const showSelfBubble  = showPropsBubble && !currentMessage && !isOpen;

  const handleCTA = (action: string, target?: string) => {
    if (action === 'dismiss') {
      dismissMessage();
      setIsOpen(false);
    } else if (action === 'scroll_to' && target) {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      dismissMessage();
      setIsOpen(false);
    } else if (action === 'navigate' && target) {
      router.push(target);
      dismissMessage();
      setIsOpen(false);
    }
  };

  // Todo list
  const todos: { label: string; href: string }[] = [];
  if (missions?.fortune === false)
    todos.push({ label: '🔮 占いを見る +10BP',        href: '/fortune'   });
  if (missions?.login === false)
    todos.push({ label: '✨ ログインボーナス受け取る', href: '/top'       });
  if (missions?.music === false)
    todos.push({ label: '📋 ミッションを確認',         href: '/top'       });
  if (radioToday === false)
    todos.push({ label: '🎵 RADIOを聴く +5EP',         href: '/top#radio' });

  const allDone =
    todos.length === 0 && missions !== undefined && radioToday !== undefined;

  return (
    <>
      {/* ── Layer2: 吹き出し (trackEvent) ───────────────────────────────── */}
      {showTrackBubble && (
        <div className="fixed bottom-[88px] right-0 z-[9998] w-56 pr-5">
          <div
            onClick={() => { setIsOpen(true); dismissBubble(); }}
            className="relative bg-[#0F172A] border border-white/10 rounded-2xl p-3 text-sm text-white shadow-lg cursor-pointer"
            style={{ animation: 'bubble-in 0.2s ease-out' }}
          >
            <button
              className="absolute top-1.5 right-2 text-white/40 hover:text-white text-xs leading-none"
              onClick={(e) => { e.stopPropagation(); dismissBubble(); }}
              aria-label="閉じる"
            >×</button>
            <p className="pr-5 text-xs leading-relaxed" style={{ color: 'rgba(234,240,255,0.9)' }}>
              {currentMessage!.message}
            </p>
            <div className="flex flex-col gap-1.5 mt-2">
              {currentMessage!.cta.map((btn, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); handleCTA(btn.action, btn.target); }}
                  className="text-left text-xs px-2 py-1.5 rounded-lg w-full"
                  style={{
                    background: i === 0
                      ? 'linear-gradient(90deg,#6366F1,#A78BFA)'
                      : 'rgba(255,255,255,0.04)',
                    color: i === 0 ? '#fff' : 'rgba(234,240,255,0.7)',
                    border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >{btn.label}</button>
              ))}
            </div>
            <div className="absolute -bottom-2 right-5 w-0 h-0"
              style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #0F172A' }} />
          </div>
        </div>
      )}

      {/* ── Layer2: 吹き出し (props-based serif) ────────────────────────── */}
      {showSelfBubble && (
        <div className="fixed bottom-[88px] right-0 z-[9998] w-52 pr-5">
          <div className="relative bg-zinc-800 rounded-2xl p-3 text-sm text-white shadow-lg">
            <button
              className="absolute top-1.5 right-2 text-zinc-400 hover:text-white text-xs leading-none"
              onClick={() => setShowPropsBubble(false)}
              aria-label="閉じる"
            >×</button>
            <p className="pr-5 leading-relaxed text-xs">{serif}</p>
            <div className="absolute -bottom-2 right-5 w-0 h-0"
              style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #3f3f46' }} />
          </div>
        </div>
      )}

      {/* ── Layer3: ミニパネル ───────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-[9998] w-64 bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-xl">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Image src={catSrc} alt="LIFAI CAT" width={24} height={24} className="rounded-full" />
              <span className="font-bold text-white text-sm">🐱 リファ猫</span>
            </div>
            <button
              className="text-zinc-400 hover:text-white text-base leading-none"
              onClick={() => setIsOpen(false)}
              aria-label="閉じる"
            >×</button>
          </div>

          {/* trackEvent メッセージ */}
          {currentMessage && (
            <>
              <p className="text-xs mb-2" style={{ color: 'rgba(234,240,255,0.85)', lineHeight: 1.65 }}>
                {currentMessage.message}
              </p>
              <div className="flex flex-col gap-1.5 mb-3">
                {currentMessage.cta.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => handleCTA(btn.action, btn.target)}
                    className="text-left text-xs px-3 py-2 rounded-lg w-full"
                    style={{
                      background: i === 0
                        ? 'linear-gradient(90deg,#6366F1,#A78BFA)'
                        : 'rgba(255,255,255,0.04)',
                      color: i === 0 ? '#fff' : 'rgba(234,240,255,0.7)',
                      border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >{btn.label}</button>
                ))}
              </div>
              <div className="border-t border-zinc-700 mb-3" />
            </>
          )}

          {isChat ? (
            /* ── チャット画面 ─────────────────────────────────── */
            <>
              <button
                className="text-xs text-zinc-400 hover:text-white mb-3 flex items-center gap-1"
                onClick={() => setIsChat(false)}
              >← 戻る</button>

              {/* 履歴（最大5件） */}
              <div className="flex flex-col gap-2 mb-3 max-h-48 overflow-y-auto">
                {chatHistory.slice(-5).map((entry, i) => (
                  <div
                    key={i}
                    className={`text-xs px-3 py-2 rounded-xl leading-relaxed max-w-[90%] ${
                      entry.from === 'user'
                        ? 'self-end bg-indigo-600 text-white ml-auto'
                        : 'self-start bg-zinc-700 text-zinc-100'
                    }`}
                  >
                    {entry.text}
                  </div>
                ))}
                {isWaiting && (
                  <div className="text-xs px-3 py-2 rounded-xl bg-zinc-700 text-zinc-400 max-w-[90%]">
                    …
                  </div>
                )}
              </div>

              {/* 入力欄 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleChatSend(); }}
                  placeholder="何か聞いてみて…"
                  className="flex-1 text-xs bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1.5 text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleChatSend}
                  disabled={isWaiting}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 transition-colors"
                >送信</button>
              </div>
            </>
          ) : (
            /* ── 通常画面 ─────────────────────────────────────── */
            <>
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
                      >{t.label}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 mb-3">今日はなにから進める？</p>
              )}

              <div className="border-t border-zinc-700 my-3" />

              {(bp !== undefined || ep !== undefined) && (
                <p className="text-xs text-zinc-300 mb-3">
                  {bp !== undefined && <span>💰 BP: {bp}</span>}
                  {bp !== undefined && ep !== undefined && <span>　</span>}
                  {ep !== undefined && <span>⚡ EP: {ep}</span>}
                </p>
              )}

              <button
                className="w-full text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl py-2 mb-2 transition-colors"
                onClick={() => setIsChat(true)}
              >💬 相談する</button>

              <button
                className="w-full text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg py-1.5 transition-colors"
                onClick={() => setIsOpen(false)}
              >閉じる</button>
            </>
          )}
        </div>
      )}

      {/* ── Layer1: 常駐アイコン ─────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-[9999]">
        <button
          onClick={() => {
            setIsOpen(o => !o);
            dismissBubble();
            setShowPropsBubble(false);
          }}
          aria-label="リファ猫を開く"
          className="relative w-14 h-14 rounded-full overflow-hidden shadow-lg"
          style={{ animation: 'lifaiCatFloat 2.5s ease-in-out infinite' }}
        >
          {badge && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-black z-10" />
          )}
          <Image
            src={catSrc}
            alt="LIFAI CAT"
            width={56}
            height={56}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </button>
      </div>

      <style>{`
        @keyframes lifaiCatFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes bubble-in {
          from { opacity: 0; transform: scale(0.9) translateY(6px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
      `}</style>
    </>
  );
}
