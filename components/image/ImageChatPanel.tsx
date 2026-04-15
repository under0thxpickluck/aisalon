"use client";

import { FormEvent, useRef, useState } from "react";

type Message = { role: "ai" | "user"; text: string };

type Props = {
  messages: Message[];
  onSend: (text: string) => Promise<void>;
  loading: boolean;
};

export default function ImageChatPanel({ messages, onSend, loading }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await onSend(text);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0d1a2e]">
      {/* 会話ログ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[#A8B3CF] mt-8">
            どんな画像を作りたいか教えてください。<br />AIが一緒に考えます。
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                m.role === "ai"
                  ? "bg-[#1a2a4a] text-[#EAF0FF]"
                  : "bg-[#3a2a6a] text-[#EAF0FF]"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[#1a2a4a] px-4 py-2 text-sm text-[#A8B3CF] animate-pulse">
              考え中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ヒント */}
      <p className="px-4 pb-1 text-center text-xs text-[#A8B3CF]/60">
        この会話は画像内容に反映されます
      </p>

      {/* 入力欄 */}
      <form onSubmit={handleSubmit} className="border-t border-white/10 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as FormEvent); }
          }}
          placeholder="メッセージを入力（Enterで送信）"
          rows={2}
          className="flex-1 resize-none rounded-xl bg-[#1a2a4a] px-3 py-2 text-sm text-[#EAF0FF] placeholder-[#A8B3CF]/50 outline-none focus:ring-1 focus:ring-[#7C5CFF]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#3AA0FF] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}
