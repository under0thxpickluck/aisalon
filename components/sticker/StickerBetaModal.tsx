"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

// 先行公開であることを最初に伝えるお知らせ。
//
// 一度閉じたら再表示しない（localStorage に記録する）。
// 毎回出すとただの邪魔になり、本当に読んでほしいときに読まれなくなるため。
export default function StickerBetaModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-extrabold text-white">
            先行公開
          </span>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
            ベータテスト版です
          </h2>
        </div>

        <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            LINEスタンプ機能は、正式公開の前に先行して公開しています。
            まだ調整中のため、エラーが出たり、うまく動かないことがあるかもしれません。
          </p>

          <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 p-3">
            <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              知っておいてほしいこと
            </p>
            <ul className="flex flex-col gap-1.5 text-xs">
              <li className="flex gap-2">
                <span className="text-indigo-500">・</span>
                <span>
                  作成に失敗したときは自動でやり直します。
                  失敗した分のポイントはかかりません
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500">・</span>
                <span>
                  作成の途中でページを閉じても、次に開いたときに続きから再開できます
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500">・</span>
                <span>
                  スタンプの文字・背景エフェクト・LINE形式への変換は何度でも無料です
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500">・</span>
                <span>
                  まずは8個で試すのがおすすめです。数分で完成します
                </span>
              </li>
            </ul>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            うまくいかないことがあれば教えてください。
            いただいたご意見をもとに改善していきます。
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
        >
          わかりました
        </button>
      </div>
    </div>
  );
}
