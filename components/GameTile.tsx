"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: string;
  disabled?: boolean;
};

export function GameTile({ href, title, subtitle, icon, badge, disabled }: Props) {
  const base =
    "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl transition";
  const hover = disabled ? "" : "hover:bg-white/10 hover:-translate-y-[1px] active:scale-[0.99]";

  const content = (
    <div className={`${base} ${hover} ${disabled ? "opacity-40" : ""}`}>
      {/* 角の光 */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/20 blur-2xl" />
      {/* badge */}
      {badge ? (
        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-slate-200">
          {badge}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-black/25 text-white">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-base font-extrabold text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-300/80">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );

  if (disabled) return <div>{content}</div>;
  return <Link href={href}>{content}</Link>;
}
