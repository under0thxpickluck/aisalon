"use client";

const STYLES = [
  { id: "anime",     label: "アニメ",     desc: "+10BP" },
  { id: "realistic", label: "リアル",     desc: "+10BP" },
  { id: "watercolor",label: "水彩画",     desc: "+10BP" },
  { id: "oil",       label: "油絵",       desc: "+10BP" },
  { id: "pixel",     label: "ピクセルアート", desc: "+10BP" },
  { id: "sketch",    label: "スケッチ",   desc: "+10BP" },
];

type Props = {
  selected: string | undefined;
  onChange: (style: string | undefined) => void;
};

export default function ImageStylePicker({ selected, onChange }: Props) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-[#A8B3CF]">画風を選ぶ（任意）</p>
      <div className="grid grid-cols-3 gap-2">
        {STYLES.map((s) => {
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onChange(active ? undefined : s.id)}
              className={`rounded-xl border px-2 py-2.5 text-left transition focus:outline-none ${
                active
                  ? "border-[#7C5CFF] bg-[#7C5CFF]/20 text-[#EAF0FF]"
                  : "border-white/10 bg-[#0d1a2e] text-[#A8B3CF] hover:border-white/20"
              }`}
            >
              <p className="text-xs font-semibold leading-tight">{s.label}</p>
              <p className="mt-0.5 text-[10px] text-[#7C5CFF]">{s.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
