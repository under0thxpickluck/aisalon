// app/narasu-agency/terms/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, saveDraft, loadDraft } from "@/lib/narasu-agency/storage";
import { NARASU_TERMS_VERSION } from "@/lib/narasu-agency/constants";

const TERMS_TEXT = `
narasu代理申請サービス 確認事項（${NARASU_TERMS_VERSION}）

■ サービス概要
本フォームは、LIFAI運営がnarasuへの楽曲配信申請を代理で行うサービスです。

■ ご提供いただく情報
・narasuアカウントのログインIDおよびパスワード
・配信を希望する楽曲の音源URL
・その他、配信に必要な付帯情報

■ 情報の取り扱いについて
ご提供いただいたアカウント情報は、代理申請業務のみに使用します。
業務完了後は速やかに削除いたします。
第三者への提供は行いません。

■ 免責事項
・申請内容に誤りがあった場合の責任は申請者にあります。
・narasu側の審査結果についてLIFAI運営は保証しません。
・配信開始時期はnarasu側の都合により変動する場合があります。

■ 代行費用について
代行費用は以下の2通りからお選びいただけます。

・クレジットカード払い：1,280円
  申請後、公式LINEにてお支払い手続きのご案内をお送りします。

・BPポイント払い：300BP
  申請後の支払い選択画面でBPを消費して即時完了できます。

※本規約は法務レビュー前のドラフトです。正式版は後日更新されます。
`.trim();

export default function NarasuTermsPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isGatePassed()) {
      router.replace("/narasu-agency");
    }
  }, [router]);

  function handleAgree() {
    const existing = loadDraft();
    const base = existing ?? {
      narasuLoginId: "",
      narasuPassword: "",
      audioUrls: [{ id: crypto.randomUUID(), url: "" }],
      lyricsText: "",
      jacketImageUrl: "",
      jacketNote: "",
      artistName: "",
      note: "",
      agreedTermsVersion: "",
      agreedAt: "",
    };
    saveDraft({
      ...base,
      agreedTermsVersion: NARASU_TERMS_VERSION,
      agreedAt: new Date().toISOString(),
    });
    router.push("/narasu-agency/form");
  }

  function handleDisagree() {
    router.push("/top");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">代理申請に関する確認事項</h1>
          <p className="mt-1 text-xs text-slate-400">お申し込み前に必ずご確認ください</p>

          <div className="mt-6 h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{TERMS_TEXT}</pre>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            <span className="text-sm text-slate-700">上記内容を確認し、同意します</span>
          </label>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleAgree}
              disabled={!agreed}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              同意する →
            </button>
            <button
              onClick={handleDisagree}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              同意しない（トップへ戻る）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
