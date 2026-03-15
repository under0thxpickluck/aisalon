"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuth, getAuth, getAuthSecret, type AuthState } from "../lib/auth";
import { useLifaiCat } from "@/components/LifaiCat";
import BPGrantModal from "@/components/BPGrantModal";
import LoginBonusModal from "@/components/LoginBonusModal";
import MissionCard from "@/components/MissionCard";
import GachaModal from "@/components/GachaModal";
import StakingModal from "@/components/StakingModal";
import RadioCard from "@/components/RadioCard";
import LifaiCat from "@/components/LifaiCat";

/** ✅ カウントダウン + 調達バー（returnの外に置く） */
function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}
function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function PresaleHeader({
  endAtISO,
  raised,
  goal,
  currencyLabel = "USDT",
}: {
  endAtISO: string;
  raised: number;
  goal: number;
  currencyLabel?: string;
}) {
  const endMs = useMemo(() => new Date(endAtISO).getTime(), [endAtISO]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, endMs - now);
  const totalSec = Math.floor(diff / 1000);

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pct = goal > 0 ? Math.min(100, Math.max(0, (raised / goal) * 100)) : 0;

  return (
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold text-slate-700">プレセール終了まで</p>

          <div className="mt-2 flex items-center gap-2">
            <TimeBox label="日" value={pad2(days)} />
            <TimeBox label="時" value={pad2(hours)} />
            <TimeBox label="分" value={pad2(mins)} />
            <TimeBox label="秒" value={pad2(secs)} />
          </div>

          {diff === 0 && (
            <p className="mt-2 text-xs font-semibold text-rose-600">プレセールは終了しました</p>
          )}
        </div>

        <div className="w-full md:max-w-md">
          <div className="flex items-end justify-between">
            <p className="text-xs font-extrabold text-slate-700">{currencyLabel}調達額</p>
            <p className="text-sm font-extrabold text-slate-900">
              {formatMoney(raised)} / {formatMoney(goal)}
            </p>
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-600">進捗：{pct.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <p className="text-base font-extrabold leading-none text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function BalanceBadge({ auth, refreshTrigger }: { auth: AuthState; refreshTrigger?: number }) {
  const [bp, setBp] = useState<number>(0);
  const [ep, setEp] = useState<number>(0);
  const [err, setErr] = useState<string>("");

  const fetchBalance = useCallback(async () => {
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      "";

    if (!id) {
      setErr("no_login_id");
      return;
    }

    try {
      const r = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id }),
      });

      const data: any = await r.json().catch(() => ({ ok: false, error: "not_json" }));

      if (!data.ok) {
        setErr(data.error || "failed");
        return;
      }

      setBp(Number(data.bp || 0));
      setEp(Number(data.ep || 0));
    } catch (e: any) {
      setErr(String(e));
    }
  }, [auth]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, refreshTrigger]);

  return (
    <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">
      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
        WALLET
      </span>
      <span>BP</span>
      <span className="font-extrabold text-slate-900">{bp}</span>
      <span className="opacity-40">/</span>
      <span>EP</span>
      <span className="font-extrabold text-slate-900">{ep}</span>
      {err ? <span className="ml-2 text-[10px] opacity-50">({err})</span> : null}
    </div>
  );
}

/**
 * ✅ 紹介コード表示（/api/me を叩いて my_ref_code を取得）
 * - auth から id/code を拾ってPOST
 * - 取得した紹介URLをコピーできる
 * - 失敗しても壊さない（UIで理由を出す）
 */
function ReferralCard({ auth }: { auth: AuthState }) {
  const [refCode, setRefCode] = useState<string>("");
  const [refUrl, setRefUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string>("");
  const [copied, setCopied] = useState<string>("");

  const [secretReady, setSecretReady] = useState<string>("");

  useEffect(() => {
    const s = getAuthSecret();
    if (s) {
      setSecretReady(s);
    } else {
      const t = setTimeout(() => {
        const retry = getAuthSecret();
        if (retry) setSecretReady(retry);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [auth]);

  useEffect(() => {
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      (auth as any)?.email ||
      "";

    const code =
      secretReady ||
      getAuthSecret() ||
      (auth as any)?.code ||
      (auth as any)?.pw ||
      (auth as any)?.password ||
      (auth as any)?.token ||
      "";

    // baseUrl（コピー用リンクのドメイン）
    // envはクライアントで読めない場合があるので、locationでフォールバック
    const base =
      (typeof window !== "undefined" && window.location?.origin) ? window.location.origin : "";

    // 共有先は purchase に refCode をつける（applyの refCode に入れる想定）
    // 例：/purchase?refCode=R-lifai_xxxxxx
    const buildShare = (rc: string) => {
      if (!base) return `/purchase?refCode=${encodeURIComponent(rc)}`;
      return `${base}/purchase?refCode=${encodeURIComponent(rc)}`;
    };

    if (!id) {
      setLoading(false);
      setErr("no_id");
      return;
    }
    if (!code) {
      // ここが出る場合：getAuth() が code を保持していない
      // → その場合は /api/me が叩けないので、まず auth 保存側の設計を揃える必要がある
      setLoading(false);
      setErr("no_code_in_auth");
      return;
    }

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, code }),
        });

        const data: any = await r.json().catch(() => ({ ok: false, error: "not_json" }));

        if (!data?.ok) {
          const reason = String(data?.reason || "");
          setErr(reason || String(data?.error || "failed"));
          setLoading(false);
          return;
        }

        const me = data?.me;
        const rc = String(me?.my_ref_code || "");
        if (!rc) {
          setErr("no_ref_code_returned");
          setLoading(false);
          return;
        }

        setRefCode(rc);
        setRefUrl(buildShare(rc));
        setLoading(false);
      } catch (e: any) {
        setErr(String(e));
        setLoading(false);
      }
    })();
  }, [auth, secretReady]);

  const copy = async (text: string, kind: "code" | "url") => {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1200);
    } catch (e: any) {
      setErr("clipboard_failed");
    }
  };

  return (
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold text-slate-700">あなたの紹介コード</p>
          <p className="mt-1 text-xs text-slate-500">
            お友達を紹介する際は下記コードをお使いください。詳しい内容は『紹介プログラムページ』まで。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              読み込み中…
            </span>
          ) : refCode ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-900">
              {refCode}
            </span>
          ) : (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              取得できません
            </span>
          )}

          <button
            onClick={() => copy(refCode, "code")}
            disabled={!refCode}
            className={[
              "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
              refCode
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {copied === "code" ? "コピーしました" : "コードをコピー"}
          </button>

          <button
            onClick={() => copy(refUrl, "url")}
            disabled={!refUrl}
            className={[
              "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
              refUrl
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {copied === "url" ? "コピーしました" : "リンクをコピー"}
          </button>
        </div>
      </div>

      {refUrl ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold text-slate-500">共有リンク</p>
          <p className="mt-1 break-all text-xs font-semibold text-slate-700">{refUrl}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            紹介コードは登録後に紐づけることはできません。
          </p>
        </div>
      ) : null}

      {err ? (
        <p className="mt-3 text-[11px] font-semibold text-rose-600">
          エラー: {err}
          {err === "no_code_in_auth" ? (
            <span className="ml-2 text-slate-500">
              （getAuth() が code を保持していない可能性。）
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

type AppDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  href: string;
  desc: string;
  badge?: string;
  comingSoon?: boolean;
  onOpen?: () => void;
};

export default function AppHomePage() {
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const { trackEvent } = useLifaiCat();

  // 未受取BP通知
  const [bpGrantModal, setBpGrantModal] = useState<{ amount: number } | null>(null);

  // ログインボーナス通知
  const [loginBonus, setLoginBonus] = useState<{
    bp_earned: number;
    streak: number;
  } | null>(null);

  // BPガチャ
  const [showGacha, setShowGacha] = useState(false);

  // BPステーキング
  const [showStaking, setShowStaking] = useState(false);

  // 残高更新トリガー
  const [balanceTrigger, setBalanceTrigger] = useState(0);

  // 選択中アプリ（ポップアップ）
  const [selectedApp, setSelectedApp] = useState<AppDef | null>(null);

  useEffect(() => {
    const a = getAuth();
    setAuthState(a);

    if (!a) {
      router.replace("/login");
      return;
    }
    if ((a as any).status === "pending") {
      router.replace("/pending");
      return;
    }

    // 未受取BPチェック
    const id = (a as any)?.id || (a as any)?.loginId || (a as any)?.login_id || "";
    const code = getAuthSecret() || (a as any)?.token || "";
    if (id && code) {
      (async () => {
        try {
          const res = await fetch("/api/user/pending-bp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ id, code }),
          });
          const data = await res.json().catch(() => ({ ok: false }));
          if (data.ok && data.hasPending && data.amount > 0) {
            setBpGrantModal({ amount: data.amount });
          }
        } catch {
          // 通知失敗はサイレントに無視
        }
      })();
    }

    // ログインボーナス
    const loginId = (a as any)?.loginId ?? (a as any)?.login_id ?? (a as any)?.id ?? "";
    if (loginId) {
      fetch("/api/daily-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.bp_earned > 0) {
            setLoginBonus({ bp_earned: data.bp_earned, streak: data.streak });
          }
        })
        .catch(() => {});
    }
  }, [router]);

  // AIBot: /top入場イベント（残高付き）
  useEffect(() => {
    if (!auth) return;
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      "";
    if (!id) {
      trackEvent("page_view", { page_id: "top_home", bp: "0", ep: "0" });
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id }),
        });
        const data = await r.json().catch(() => ({ ok: false }));
        trackEvent("page_view", {
          page_id: "top_home",
          bp: String(data.ok ? (data.bp ?? 0) : 0),
          ep: String(data.ok ? (data.ep ?? 0) : 0),
        });
      } catch {
        trackEvent("page_view", { page_id: "top_home", bp: "0", ep: "0" });
      }
    })();
  }, [auth, trackEvent]);

  const apps: AppDef[] = useMemo(
    () => [
      { id: "fortune",  label: "団子占い",     icon: "🔮", color: "from-violet-500 to-purple-600",  href: "/fortune",    desc: "毎日の運勢 +10BP" },
      { id: "music",    label: "音楽生成",     icon: "🎵", color: "from-sky-400 to-blue-500",       href: "/music",      desc: "テーマでBGM生成 40BP" },
      { id: "radio",    label: "RADIO",        icon: "📻", color: "from-emerald-400 to-green-500",  href: "#radio",      desc: "作業BGMでEP獲得" },
      { id: "market",   label: "マーケット",   icon: "🛒", color: "from-orange-400 to-amber-500",   href: "/market",     desc: "メンバー間売買" },
      { id: "gacha",    label: "ガチャ",       icon: "🎰", color: "from-pink-500 to-rose-500",      href: "#gacha",      desc: "BP消費で報酬",          onOpen: () => { setSelectedApp(null); setShowGacha(true); } },
      { id: "staking",  label: "ステーキング", icon: "💎", color: "from-cyan-400 to-teal-500",      href: "#staking",    desc: "BPを預けて増やす",      onOpen: () => { setSelectedApp(null); setShowStaking(true); } },
      { id: "mission",   label: "ミッション",    icon: "📋", color: "from-yellow-400 to-orange-400", href: "#mission",    desc: "毎日の課題でBP" },
      { id: "member",    label: "メンバーシップ", icon: "👑", color: "from-slate-500 to-zinc-600",  href: "/membership", desc: "プランをアップグレード" },
      { id: "music2",    label: "音楽生成NEW",   icon: "🎼", color: "from-gray-400 to-slate-500",   href: "/music2",     desc: "歌詞・構成・音楽を3ステップで生成", badge: "準備中" },
      { id: "note",      label: "ノート生成",    icon: "📝", color: "from-violet-400 to-purple-500", href: "/note",      desc: "構成→本文→見出し→導入文まで一括",         badge: "準備中" },
      { id: "workflow",  label: "ワークフロー",  icon: "🧩", color: "from-cyan-400 to-sky-500",     href: "/workflow",   desc: "n8n/自動化の設計テンプレを作る",           badge: "準備中" },
    ],
    []
  );

  const logout = () => {
    clearAuth();
    router.replace("/");
  };

  const handleBpModalClose = async () => {
    setBpGrantModal(null);
    // 受取完了をGASに通知
    const a = getAuth();
    const id = (a as any)?.id || (a as any)?.loginId || (a as any)?.login_id || "";
    const code = getAuthSecret() || (a as any)?.token || "";
    if (id && code) {
      await fetch("/api/user/claim-bp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, code }),
      }).catch(() => {});
    }
  };

  // ✅ 認証判定が終わるまで一瞬も中身を描画しない（チラ見え防止）
  if (auth === null) return null;

  const loginId =
    (auth as any)?.loginId ??
    (auth as any)?.login_id ??
    (auth as any)?.id ??
    "";

  return (
    <>
    {bpGrantModal && (
      <BPGrantModal amount={bpGrantModal.amount} onClose={handleBpModalClose} />
    )}
    {loginBonus && (
      <LoginBonusModal
        bp_earned={loginBonus.bp_earned}
        streak={loginBonus.streak}
        onClose={() => {
          setLoginBonus(null);
          setBalanceTrigger((n) => n + 1);
        }}
      />
    )}
    {showGacha && (
      <GachaModal
        loginId={loginId}
        onClose={() => setShowGacha(false)}
        onBpEarned={(_amount) => {
          setBalanceTrigger((n) => n + 1);
        }}
      />
    )}
    {showStaking && (
      <StakingModal
        loginId={loginId}
        onClose={() => setShowStaking(false)}
        onBpChanged={() => setBalanceTrigger((n) => n + 1)}
      />
    )}

    {/* アプリ詳細ポップアップ */}
    {selectedApp && (
      <>
        {/* オーバーレイ */}
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setSelectedApp(null)}
        />
        {/* スライドアップシート */}
        <div className="fixed inset-x-0 bottom-0 z-50 max-w-sm mx-auto rounded-t-3xl bg-zinc-900 p-6 shadow-2xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedApp.color} flex items-center justify-center text-4xl shadow-lg`}>
              {selectedApp.icon}
            </div>
            <div>
              <p className="text-lg font-extrabold text-white">{selectedApp.label}</p>
              {selectedApp.id === 'music2' ? (
                <ul className="mt-1 text-sm text-zinc-400 text-left space-y-1">
                  <li>① 歌詞を作成</li>
                  <li>② メロディを作成</li>
                  <li>③ 音楽生成 ※ボーカルは現在未実装です</li>
                </ul>
              ) : (
                <p className="mt-1 text-sm text-zinc-400">{selectedApp.desc}</p>
              )}
            </div>
            {selectedApp.badge ? (
              <button
                disabled
                className="mt-2 w-full rounded-2xl bg-slate-700 px-6 py-3 text-sm font-extrabold text-slate-400 cursor-not-allowed"
              >
                準備中
              </button>
            ) : selectedApp.onOpen ? (
              <button
                onClick={selectedApp.onOpen}
                className="mt-2 w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 hover:bg-amber-300 active:scale-95 transition"
              >
                開く →
              </button>
            ) : selectedApp.href.startsWith("#") ? (
              <button
                onClick={() => setSelectedApp(null)}
                className="mt-2 w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 hover:bg-amber-300 active:scale-95 transition"
              >
                開く →
              </button>
            ) : (
              <Link
                href={selectedApp.href}
                className="mt-2 block w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 text-center hover:bg-amber-300 active:scale-95 transition"
                onClick={() => setSelectedApp(null)}
              >
                開く →
              </Link>
            )}
          </div>
        </div>
      </>
    )}

    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.14) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="mx-auto max-w-[920px] px-4 py-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,.35)]" />
                LIFAI APP HOME
              </div>

              <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
                LIFAIへようこそ
              </h1>
              <p className="mt-2 hidden text-xs text-slate-600 sm:block">
                使いたい機能を「アプリアイコン」から開けます。
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <BalanceBadge auth={auth} refreshTrigger={balanceTrigger} />

              <button
                onClick={logout}
                className="rounded-2xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                退出
              </button>
            </div>
          </div>

          {/* ✅ここ：ヘッダー直下、タイル一覧の直前 */}
          <PresaleHeader
            endAtISO="2026-05-01T23:59:59+09:00"
            raised={4825}
            goal={10000}
            currencyLabel="USDT"
          />

          {/* ✅ 追加：紹介コード表示（/api/me 経由で取得） */}
          <ReferralCard auth={auth} />

          {/* ✅ アプリグリッド（LINEミニアプリ風 4列） */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-extrabold text-slate-700">アプリ</p>
            <div className="grid grid-cols-4 gap-3 px-2">
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="flex flex-col items-center gap-1 focus:outline-none"
                >
                  <div className="relative">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-2xl shadow-md active:scale-95 transition`}
                    >
                      {app.icon}
                    </div>
                    {app.badge && (
                      <span className="absolute -top-1 -right-1 rounded-full bg-slate-700 px-1.5 py-0.5 text-[8px] font-bold text-white leading-none">
                        {app.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-600 text-center leading-tight">
                    {app.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <MissionCard
            loginId={loginId}
            onBpEarned={(_amount) => {
              setBalanceTrigger((n) => n + 1);
            }}
          />

          <RadioCard
            loginId={loginId}
            onEpEarned={() => setBalanceTrigger((n) => n + 1)}
          />

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            問い合わせはTOPページにございます。
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
    <LifaiCat
      loginId={loginId}
      currentPage="top"
    />
    </>
  );
}
