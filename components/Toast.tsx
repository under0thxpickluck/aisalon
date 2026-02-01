"use client";

import { useToast } from "./useToast";

export function ToastHost() {
  const { items, remove } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex justify-center px-3">
      <div className="flex w-full max-w-md flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white shadow-[0_12px_40px_rgba(0,0,0,.45)] backdrop-blur"
            onClick={() => remove(t.id)}
            role="button"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
