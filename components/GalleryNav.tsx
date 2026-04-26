// components/GalleryNav.tsx
"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "music", label: "音楽生成" },
  { id: "bgm", label: "BGM" },
  { id: "image", label: "画像生成" },
  { id: "note", label: "note記事" },
  { id: "fortune", label: "占い" },
  { id: "music-boost", label: "Music Boost" },
  { id: "games", label: "ゲーム" },
  { id: "gacha", label: "ガチャ" },
  { id: "market", label: "マーケット" },
  { id: "radio", label: "ラジオ" },
  { id: "lifaneko", label: "LIFAネコ" },
  { id: "works",    label: "🎨 作品集" },
] as const;

export default function GalleryNav() {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex gap-1 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeId === id
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
