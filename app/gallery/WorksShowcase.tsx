"use client";

import { useState } from "react";
import { WORKS } from "@/data/works";
import type { Work } from "@/data/works";
import WorkCard from "@/components/WorkCard";

const TABS: { key: Work["tab"] | "all"; label: string }[] = [
  { key: "all",     label: "すべて" },
  { key: "music",   label: "🎵 音楽" },
  { key: "image",   label: "🖼️ 画像" },
  { key: "article", label: "✍️ 記事" },
];

export default function WorksShowcase() {
  const [activeTab, setActiveTab] = useState<Work["tab"] | "all">("all");

  const filtered = activeTab === "all"
    ? WORKS
    : WORKS.filter(w => w.tab === activeTab);

  return (
    <div>
      {/* タブ */}
      <div className="mb-6 flex gap-1 rounded-xl bg-neutral-100 p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              activeTab === t.key
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* カードグリッド */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(work => (
          <WorkCard key={work.slug} work={work} />
        ))}
      </div>

      <p className="mt-4 text-xs text-neutral-400">{filtered.length} 件</p>
    </div>
  );
}
