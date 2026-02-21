// components/WalletBadge.tsx
"use client";

import { useEffect, useState } from "react";

type Balance = {
  ok: boolean;
  bp?: number;
  ep?: number;
  error?: string;
};

function getLoginId() {
  try {
    // 例：login成功後に localStorage に保存している想定
    // 実際のキー名に合わせて変更してOK
    return localStorage.getItem("login_id") || "";
  } catch {
    return "";
  }
}

export function WalletBadge() {
  const [bp, setBp] = useState<number>(0);
  const [ep, setEp] = useState<number>(0);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const id = getLoginId();
    if (!id) {
      setErr("no_login_id");
      return;
    }

    (async () => {
      try {
        const r = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id }),
        });

        const data: Balance = await r.json().catch(() => ({ ok: false, error: "not_json" }));

        if (!data.ok) {
          setErr(data.error || "failed");
          return;
        }

        setBp(Number(data.bp || 0));
        setEp(Number(data.ep || 0));
      } catch (e: any) {
        setErr(String(e));
      }
    })();
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
      <div className="font-semibold">BP: {bp}</div>
      <div className="opacity-70">/</div>
      <div className="font-semibold">EP: {ep}</div>
      {err ? <div className="ml-2 text-xs opacity-60">({err})</div> : null}
    </div>
  );
}