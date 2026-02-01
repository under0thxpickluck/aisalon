"use client";

export function StepHeader({
  step,
  total = 3,
  title,
  subtitle,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
}) {
  const pct = Math.max(0, Math.min(100, (step / total) * 100));

  return (
    <div className="mb-4">
      <div className="text-xs font-bold tracking-widest text-violet-200/90">
        STEP {step} / {total}
      </div>

      <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-slate-300/80">{subtitle}</div> : null}

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
