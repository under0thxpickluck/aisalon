"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastItem = {
  id: string;
  message: string;
};

type ToastEvent = CustomEvent<ToastItem>;

const EVT = "addval_toast";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  const item: ToastItem = { id: crypto.randomUUID(), message };
  window.dispatchEvent(new CustomEvent(EVT, { detail: item }));
}

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const ev = e as ToastEvent;
      setItems((prev) => [...prev, ev.detail]);
      // 自動消滅（2.2秒）
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== ev.detail.id));
      }, 2200);
    };

    window.addEventListener(EVT, onToast);
    return () => window.removeEventListener(EVT, onToast);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { items, remove };
}
