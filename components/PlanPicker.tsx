"use client";

import type { Plan } from "./storage";

type Props = {
  value?: Plan;
  onChange: (p: Plan) => void;
};

const PLANS: { value: Plan; title: string; sub: string }[] = [
  { value: "30", title: "30 USDT", sub: "還元 45%" },
  { value: "100", title: "100 USDT", sub: "還元 50%" },
  { value: "500", title: "500 USDT", sub: "還元 55%" },
  { value: "1000", title: "1,000 USDT", sub: "還元 60%" },
];

export function PlanPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {PLANS.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={[
              "relative rounded-2xl border px-4 py-4 text-left transition",
              "focus:outline-none focus:ring-2 focus:ring-cyan-300/40",
              active
                ? "border-cyan-300/50 bg-white text-slate-900 shadow-[0_0_0_1px_rgba(34,211,238,.18),0_18px_40px_rgba(0,0,0,.25)]"
                : "border-white/10 bg-white/10 text-white hover:bg-white/12",
            ].join(" ")}
          >
            <div className="text-sm font-extrabold">{p.title}</div>
            <div className={active ? "text-xs font-semibold text-violet-700" : "text-xs font-semibold text-violet-200"}>
              {p.sub}
            </div>
            <div className={active ? "mt-1 text-[11px] text-slate-500" : "mt-1 text-[11px] text-slate-300/70"}>
              ※あとから確認できます
            </div>

            {/* 選択済みバッジ（100%分かる） */}
            <div
              className={[
                "absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-black",
                active ? "bg-violet-600 text-white" : "bg-white/10 text-white/60",
              ].join(" ")}
              aria-hidden
            >
              ✓
            </div>
          </button>
        );
      })}
    </div>
  );
}
