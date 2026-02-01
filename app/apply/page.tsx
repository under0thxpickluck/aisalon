"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { StepHeader } from "@/components/StepHeader";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { loadDraft, saveDraft, type Draft } from "@/components/storage";

const REGIONS = [
  { value: "hokkaido", label: "北海道" },
  { value: "tohoku", label: "東北" },
  { value: "kanto", label: "関東" },
  { value: "chubu", label: "中部" },
  { value: "kinki", label: "近畿" },
  { value: "chugoku", label: "中国" },
  { value: "shikoku", label: "四国" },
  { value: "kyushu", label: "九州" },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-slate-300/60 bg-white p-5 shadow-[0_18px_45px_rgba(2,6,23,.10)]">
      <div className="mb-4">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
      </div>
      {children}
    </section>
  );
}

/** 入力欄の視認性を上げるラッパー（Field/Selectの見た目が薄い時の保険） */
function InputWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-300/70 bg-slate-50 px-4 py-3">
      {children}
    </div>
  );
}

export default function ApplyPage() {
  const initial = useMemo(() => loadDraft(), []);
  const [draft, setDraft] = useState<Draft>(() => ({
    plan: initial.plan,
    email: initial.email ?? "",
    name: initial.name ?? "",
    nameKana: initial.nameKana ?? "",
    discordId: initial.discordId ?? "",
    refName: initial.refName ?? "",
    refId: initial.refId ?? "",
    region: initial.region ?? "",
  }));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    saveDraft(next);
  };

  const errors = {
    email: !draft.email ? "メールアドレスは必須です" : !isEmail(draft.email) ? "メール形式が正しくありません" : "",
    name: !draft.name ? "お名前は必須です" : "",
    nameKana: !draft.nameKana ? "カタカナは必須です" : "",
    discordId: !draft.discordId ? "Discord ID は必須です" : "",
    plan: !draft.plan ? "権利（プラン）が未選択です（前のページで選択してください）" : "",
  };

  const canGoNext = !errors.email && !errors.name && !errors.nameKana && !errors.discordId && !errors.plan;

  return (
    <main className="min-h-screen text-slate-900">
      {/* ✅ 背景：白すぎない・コントラスト確保 */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.22),transparent_60%),radial-gradient(900px_600px_at_115%_0%,rgba(34,211,238,.18),transparent_55%),linear-gradient(180deg,#F4F6FB,#FFFFFF_45%,#F4F6FB)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.12) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        {/* ✅ 上部ナビ（視認性UP） */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/purchase"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 underline decoration-slate-300 hover:decoration-slate-500"
          >
            ← 戻る（権利購入）
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <Image src="/lifai.png" alt="LIFAI" fill className="object-contain p-1" />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-wide text-slate-900">LIFAI</div>
              <div className="text-[11px] font-semibold text-slate-600">AI教育サロン</div>
            </div>

            <Link
              href="/login"
              className="ml-2 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-50"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* ✅ 本体カード（枠/影を強めて見やすく） */}
        <div className="rounded-[28px] border border-slate-300/70 bg-white p-6 shadow-[0_28px_80px_rgba(2,6,23,.14)]">
          <StepHeader step={2} total={3} title="参加申請フォーム" subtitle="必要情報を入力して、最終確認へ進みます" />

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            {/* 左：必須 */}
            <Box title="基本情報（必須）">
              <div className="mb-4 text-xs font-semibold text-slate-600">
                入力内容は端末内に一時保存されます（UIのみ）。
              </div>

              <div className="grid gap-4">
                <InputWrap>
                  <Field
                    label="メールアドレス"
                    required
                    type="email"
                    value={draft.email ?? ""}
                    onChange={(v) => set("email", v)}
                    placeholder="example@gmail.com"
                  />
                  {errors.email ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.email}</div> : null}
                </InputWrap>

                <InputWrap>
                  <Field
                    label="お名前"
                    required
                    value={draft.name ?? ""}
                    onChange={(v) => set("name", v)}
                    placeholder="例：山田太郎（スペースなし）"
                    hint="姓と名の間はスペースを空けずに入力してください。"
                  />
                  {errors.name ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.name}</div> : null}
                </InputWrap>

                <InputWrap>
                  <Field
                    label="お名前（カタカナ）"
                    required
                    value={draft.nameKana ?? ""}
                    onChange={(v) => set("nameKana", v)}
                    placeholder="例：ヤマダタロウ（スペースなし）"
                    hint="姓と名の間はスペースを空けずに入力してください。"
                  />
                  {errors.nameKana ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.nameKana}</div> : null}
                </InputWrap>

                <InputWrap>
                  <Field
                    label="Discord ID"
                    required
                    value={draft.discordId ?? ""}
                    onChange={(v) => set("discordId", v)}
                    placeholder="例：lifai_member"
                    hint="※今は必須のまま。将来Discord不要ならここも削除できます。"
                  />
                  {errors.discordId ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.discordId}</div> : null}
                </InputWrap>
              </div>
            </Box>

            {/* 右：任意＋次へ */}
            <aside className="grid gap-5">
              <Box title="紹介情報（任意）">
                <div className="grid gap-4">
                  <InputWrap>
                    <Field label="ご紹介者名" value={draft.refName ?? ""} onChange={(v) => set("refName", v)} placeholder="例：山田花子" />
                  </InputWrap>

                  <InputWrap>
                    <Field
                      label="ご紹介者ID"
                      value={draft.refId ?? ""}
                      onChange={(v) => set("refId", v)}
                      placeholder="例：001234"
                      hint="不明なら空欄でOK。"
                    />
                  </InputWrap>

                  <InputWrap>
                    <Select
                      label="地域"
                      value={draft.region ?? ""}
                      onChange={(v) => set("region", v)}
                      options={REGIONS}
                      placeholder="選択"
                    />
                  </InputWrap>
                </div>
              </Box>

              <section className="rounded-[22px] border border-slate-300/60 bg-white p-5 shadow-[0_18px_45px_rgba(2,6,23,.10)]">
                {errors.plan ? (
                  <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                    {errors.plan}
                  </div>
                ) : null}

                <Link
                  href="/confirm"
                  className={[
                    "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-extrabold transition",
                    canGoNext
                      ? "bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]"
                      : "pointer-events-none bg-slate-200 text-slate-500",
                  ].join(" ")}
                  aria-disabled={!canGoNext}
                >
                  最終確認へ（Step3） →
                </Link>

                <div className="mt-3 text-xs font-semibold text-slate-600">
                  ※ ここではまだ送信されません。次の画面で確認→送信します。
                </div>

                <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  <div className="font-extrabold text-slate-900">ヒント</div>
                  <div className="mt-1">
                    「権利（プラン）」未選択の場合は、前のページでプランを選択してから戻ってきてください。
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <div className="mt-6 text-center text-xs font-semibold text-slate-500">© LIFAI</div>
      </div>
    </main>
  );
}
