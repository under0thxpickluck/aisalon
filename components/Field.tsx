"use client";

import { useId } from "react";

type Props = {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string; // ← 追加：エラー文を直接渡せる
  maxLength?: number;
};

export function Field({
  label,
  required,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
  error,
  maxLength,
}: Props) {
  const id = useId();
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
        {label}
        {required ? <span className="rounded-md bg-rose-50 px-2 py-[2px] text-[11px] font-extrabold text-rose-700">必須</span> : null}
      </label>

      <div
        className={[
          "mt-2 rounded-2xl border bg-white dark:bg-gray-900 px-4 py-3 shadow-sm",
          hasError
            ? "border-rose-400 ring-2 ring-rose-100"
            : "border-slate-300 dark:border-gray-600 focus-within:border-slate-900 dark:focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200 dark:focus-within:ring-slate-700",
        ].join(" ")}
      >
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full bg-transparent text-[15px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          autoComplete="off"
        />
        {hint ? <div className="mt-2 text-[12px] font-semibold text-slate-600 dark:text-slate-400">{hint}</div> : null}
      </div>

      {hasError ? <div className="mt-2 text-[12px] font-extrabold text-rose-700">{error}</div> : null}
    </div>
  );
}
