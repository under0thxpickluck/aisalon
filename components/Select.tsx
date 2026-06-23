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
      <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
        {label}
      </label>

      <div
        className={[
          "mt-2 rounded-2xl border bg-white dark:bg-gray-900 px-4 py-3 shadow-sm",
          hasError
            ? "border-rose-400 ring-2 ring-rose-100"
            : "border-slate-300 dark:border-gray-600 focus-within:border-slate-900 dark:focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200 dark:focus-within:ring-slate-700",
        ].join(" ")}
      >
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[15px] font-semibold text-slate-900 dark:text-white outline-none"
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
