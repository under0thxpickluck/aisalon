"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuth } from "@/app/lib/auth";

type MusicHistoryEntry = {
  jobId: string;
  title: string;
  audioUrl: string;
  downloadUrl: string;
  lyrics: string;
  createdAt: string;
};

type Props = {
  musicHistory?: MusicHistoryEntry[];
  activePage?: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return ""; }
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.click();
}

export function AppSidebar({ musicHistory = [], activePage }: Props) {
  const [bp, setBp] = useState<number | null>(null);
  const [ep, setEp] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    if (!id) { setBalanceLoading(false); return; }

    (async () => {
      try {
        const res = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (data.ok) {
          setBp(Number(data.bp ?? 0));
          setEp(Number(data.ep ?? 0));
        }
      } catch {}
      finally { setBalanceLoading(false); }
    })();
  }, []);

  const navItems = [
    { href: "/top",    icon: "🏠", label: "ホーム" },
    { href: "/music2", icon: "🎵", label: "音楽生成NEW" },
    { href: "/music",  icon: "🎼", label: "BGM生成" },
    { href: "/fortune",icon: "🔮", label: "団子占い" },
    { href: "/market", icon: "🛒", label: "マーケット" },
  ];

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col gap-4">
      {/* BP/EP残高 */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">残高</p>
        {balanceLoading ? (
          <p className="text-[11px] text-slate-400">読み込み中…</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">BP</span>
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                {bp ?? "–"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">EP</span>
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                {ep ?? "–"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 px-1">メニュー</p>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                activePage === item.href
                  ? "bg-indigo-600 text-white"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* 最近の曲履歴 */}
      {musicHistory.length > 0 && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 px-1">最近の曲</p>
          <div className="flex flex-col gap-2">
            {musicHistory.map((entry) => (
              <div key={entry.jobId} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="text-[11px] font-bold text-slate-800 truncate" title={entry.title}>
                  {entry.title || "無題"}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(entry.createdAt)}</p>
                <audio controls src={entry.audioUrl} className="mt-1.5 w-full" style={{ height: "28px" }} />
                <div className="mt-1.5 flex gap-1">
                  <button
                    onClick={() => downloadFile(entry.downloadUrl, `${entry.title || "song"}.mp3`)}
                    className="flex-1 rounded-lg border border-indigo-200 bg-white py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50"
                  >
                    MP3
                  </button>
                  {entry.lyrics && (
                    <button
                      onClick={() => {
                        const blob = new Blob([`${entry.title}\n\n${entry.lyrics}`], { type: "text/plain;charset=utf-8" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${entry.title || "lyrics"}_lyrics.txt`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      歌詞
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
