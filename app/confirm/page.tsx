"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StepHeader } from "@/components/StepHeader";
import { clearDraft, loadDraft, type Draft } from "@/components/storage";
import { toast } from "@/components/useToast";

const AGE_BAND_LABEL: Record<string, string> = {
  "10s": "10代",
  "20s": "20代",
  "30s": "30代",
  "40s": "40代",
  "50s": "50代",
  "60s": "60代〜",
};

const JOB_LABEL: Record<string, string> = {
  company_employee: "会社員",
  freelance: "フリーランス",
  self_employed: "自営業",
  management: "経営者",
  student: "学生",
  housework: "主婦・主夫",
  part_time: "アルバイト・パート",
  public_servant: "公務員",
  engineer: "エンジニア",
  creator: "クリエイター",
  sales: "営業",
  medical: "医療・福祉",
  education: "教育",
  other: "その他",
};

const PREF_LABEL: Record<string, string> = {
  hokkaido: "北海道",
  aomori: "青森県",
  iwate: "岩手県",
  miyagi: "宮城県",
  akita: "秋田県",
  yamagata: "山形県",
  fukushima: "福島県",
  ibaraki: "茨城県",
  tochigi: "栃木県",
  gunma: "群馬県",
  saitama: "埼玉県",
  chiba: "千葉県",
  tokyo: "東京都",
  kanagawa: "神奈川県",
  niigata: "新潟県",
  toyama: "富山県",
  ishikawa: "石川県",
  fukui: "福井県",
  yamanashi: "山梨県",
  nagano: "長野県",
  gifu: "岐阜県",
  shizuoka: "静岡県",
  aichi: "愛知県",
  mie: "三重県",
  shiga: "滋賀県",
  kyoto: "京都府",
  osaka: "大阪府",
  hyogo: "兵庫県",
  nara: "奈良県",
  wakayama: "和歌山県",
  tottori: "鳥取県",
  shimane: "島根県",
  okayama: "岡山県",
  hiroshima: "広島県",
  yamaguchi: "山口県",
  tokushima: "徳島県",
  kagawa: "香川県",
  ehime: "愛媛県",
  kochi: "高知県",
  fukuoka: "福岡県",
  saga: "佐賀県",
  nagasaki: "長崎県",
  kumamoto: "熊本県",
  oita: "大分県",
  miyazaki: "宮崎県",
  kagoshima: "鹿児島県",
  okinawa: "沖縄県",
};

function labelOrRaw(map: Record<string, string>, v?: string) {
  if (!v) return "";
  return map[v] ?? v;
}

export default function ConfirmPage() {
  const router = useRouter();

  const [draft, setDraft] = useState<Partial<Draft> | null>(null);

  // ✅ 支払いステータス（IPN確認：参考用。送信条件にはしない）
  const [isPaid, setIsPaid] = useState(false);
  const [checking, setChecking] = useState(false);

  // ✅ 「支払い完了しました」チェック（ローカルでよい）
  const [paidChecked, setPaidChecked] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    setDraft(d);

    // applyIdがあれば支払い確認（参考表示用）
    if (d?.applyId) {
      checkPayment(d.applyId);
    }
  }, []);

  const checkPayment = async (applyId: string) => {
    try {
      setChecking(true);
      const res = await fetch(`/api/apply/status?applyId=${applyId}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && data?.status === "paid") {
        setIsPaid(true);
      }
    } catch {
      // noop
    } finally {
      setChecking(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Apply（Step2）と同じ必須条件に揃える
  const missing = useMemo(() => {
    if (!draft) return true;
    return (
      !draft.plan ||
      !draft.email ||
      !draft.name ||
      !draft.nameKana ||
      !draft.discordId ||
      !draft.ageBand ||
      !draft.prefecture ||
      !draft.city ||
      !draft.job
    );
  }, [draft]);

  // ✅ 送信条件：必須項目OK + チェックON（isPaidは必須にしない）
  const canSubmit = !missing && paidChecked && !loading;

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

    if (!paidChecked) {
      toast("支払い完了後に「支払い完了しました」にチェックを入れてください。");
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
                <Row k="Discord ID" v={String(draft?.discordId ?? "")} />

                <Row k="年齢帯" v={draft?.ageBand ? labelOrRaw(AGE_BAND_LABEL, String(draft.ageBand)) : "（未選択）"} muted={!draft?.ageBand} />
                <Row k="都道府県" v={draft?.prefecture ? labelOrRaw(PREF_LABEL, String(draft.prefecture)) : "（未選択）"} muted={!draft?.prefecture} />
                <Row k="市町村" v={draft?.city ? String(draft.city) : "（未入力）"} muted={!draft?.city} />
                <Row k="職業" v={draft?.job ? labelOrRaw(JOB_LABEL, String(draft.job)) : "（未選択）"} muted={!draft?.job} />

                <Row k="紹介者名" v={draft?.refName ? String(draft.refName) : "（なし）"} muted={!draft?.refName} />
                <Row k="紹介者ID" v={draft?.refId ? String(draft.refId) : "（なし）"} muted={!draft?.refId} />
              </div>
            </section>

            <aside className="grid gap-5">
              {/* ✅ 支払い完了チェック（復活） */}
              <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                <div className="text-sm font-extrabold text-slate-900">支払い方法</div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  お支払い完了後、このページに戻って「支払い完了」チェックを入れてから送信してください。
                </p>

                {/* ✅ MEXCバナー（仮想通貨を持ってない人向け） */}
                <a
                  href="https://promote.mexc.com/r/m54hsj74"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:opacity-95 transition"
                >
                  <Image
                    src="/mexc.png"
                    alt="仮想通貨をこれから買う方はこちら（MEXC）"
                    width={1280}
                    height={1600}
                    className="h-auto w-full"
                  />
                </a>
                <div className="mt-2 px-1 text-[11px] text-slate-500">
                  ※暗号通貨をお持ちでない方は、上のバナーから購入できます（外部サイト）
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">支払い完了後</div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    支払いが完了したら、下のチェックをONにしてください（ONにしないと送信できません）。
                  </p>

                  <label className="mt-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={paidChecked}
                      onChange={(e) => setPaidChecked(e.target.checked)}
                      disabled={missing}
                    />
                    <div className="text-sm">
                      <div className="font-extrabold text-slate-900">支払い完了しました</div>
                      <div className="text-xs text-slate-600">
                        ※未完了のまま送信すると、承認が遅れる可能性があります
                      </div>
                    </div>
                  </label>

                  {/* 参考表示（文章いじらないため、表示だけ小さく） */}
                  {draft?.applyId ? (
                    <div className="mt-3 text-[11px] text-slate-500">
                      {checking ? "支払い状況を確認中..." : isPaid ? "支払い状況：paid" : "支払い状況：未確認"}
                    </div>
                  ) : null}
                </div>
              </div>

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
