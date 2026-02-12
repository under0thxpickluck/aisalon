"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StepHeader } from "@/components/StepHeader";
import { clearDraft, loadDraft, type Draft } from "@/components/storage";
import { toast } from "@/components/useToast";

export default function ConfirmPage() {
  const router = useRouter();

  const [draft, setDraft] = useState<Partial<Draft> | null>(null);

  // ✅ 支払いステータス（IPN確認）
  const [isPaid, setIsPaid] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    setDraft(d);

    // applyIdがあれば支払い確認
    if (d?.applyId) {
      checkPayment(d.applyId);
    }
  }, []);

  const checkPayment = async (applyId: string) => {
    try {
      setChecking(true);
      const res = await fetch(`/api/apply/status?applyId=${applyId}`);
      const data = await res.json();
      if (data?.ok && data?.status === "paid") {
        setIsPaid(true);
      }
    } catch {}
    finally {
      setChecking(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const missing = useMemo(() => {
    if (!draft) return true;
    return !draft.plan || !draft.email || !draft.name || !draft.nameKana;
  }, [draft]);

  const canSubmit = !missing && isPaid && !loading;

  const submit = async () => {
    setErr(null);

    if (!draft) {
      toast("読み込み中です。少し待ってからもう一度お試しください。");
      return;
    }

    if (missing) {
      toast("必須項目が足りません。Step2 に戻って入力してください。");
      return;
    }

    if (!isPaid) {
      toast("支払い確認中です。完了後に送信できます。");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }).then((r) => r.json());

      if (res?.ok) {
        clearDraft();
        router.push("/pending");
        return;
      }

      setErr("送信に失敗しました。もう一度お試しください。");
    } catch (e) {
      setErr("送信に失敗しました。通信状況をご確認ください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_20%_-10%,rgba(99,102,241,.20),transparent_60%),radial-gradient(820px_560px_at_115%_0%,rgba(34,211,238,.16),transparent_55%),linear-gradient(180deg,#FFFFFF,#F3F6FF_55%,#FFFFFF)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.12) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/apply" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ← 戻る（Step2）
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            最終確認
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(2,6,23,.10)]">
          <StepHeader step={3} total={3} title="最終確認" subtitle="内容を確認して送信してください" />

          {!draft ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              読み込み中...
            </div>
          ) : null}

          {draft && missing ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              必須項目が足りません。Step2 に戻って入力してください。
            </div>
          ) : null}

          {err ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {err}
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-[22px] border border-slate-200 bg-white p-5">
              <div className="text-sm font-extrabold text-slate-900">申請内容</div>
              <div className="mt-4 grid gap-3 text-sm">
                <Row k="プラン" v={String(draft?.plan ?? "")} />
                <Row k="メール" v={String(draft?.email ?? "")} />
                <Row k="お名前" v={String(draft?.name ?? "")} />
                <Row k="カタカナ" v={String(draft?.nameKana ?? "")} />
                <Row k="紹介者名" v={draft?.refName ? String(draft.refName) : "（なし）"} muted={!draft?.refName} />
                <Row k="紹介者ID" v={draft?.refId ? String(draft.refId) : "（なし）"} muted={!draft?.refId} />
                <Row k="地域" v={draft?.region ? String(draft.region) : "（未選択）"} muted={!draft?.region} />
              </div>
            </section>

            <aside className="grid gap-5">
              <button
                onClick={submit}
                disabled={!canSubmit}
                className={[
                  "w-full rounded-2xl px-4 py-4 text-base font-extrabold transition",
                  !canSubmit
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:opacity-95 active:scale-[0.99]",
                ].join(" ")}
              >
                {loading ? "送信中..." : "送信する"}
              </button>

              <Link
                href="/apply"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                入力を修正する（Step2へ）
              </Link>
            </aside>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-2">
      <div className="text-slate-600">{k}</div>
      <div className={["text-right font-semibold", muted ? "text-slate-500" : "text-slate-900"].join(" ")}>
        {v}
      </div>
    </div>
  );
}
