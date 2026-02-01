"use client";

import { useId } from "react";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
};

export function Select({ label, value, onChange, options, placeholder = "選択", error }: Props) {
  const id = useId();
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
        {label}
      </label>

      <div
        className={[
          "mt-2 rounded-2xl border bg-white px-4 py-3 shadow-sm",
          hasError ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-300 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-200",
        ].join(" ")}
      >
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[15px] font-semibold text-slate-900 outline-none"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {hasError ? <div className="mt-2 text-[12px] font-extrabold text-rose-700">{error}</div> : null}
    </div>
  );
}
