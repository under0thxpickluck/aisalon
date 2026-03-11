"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAIBot } from "./AIBotProvider";

export function AIBotWidget() {
  const { isOpen, setIsOpen, currentMessage, hasUnread, dismissMessage, bubbleVisible, dismissBubble } = useAIBot();
  const router = useRouter();

  const catSrc =
    currentMessage?.cat === "confused"
      ? "/aibot/cat_confused.png"
      : "/aibot/cat_normal.png";

  const handleCTA = (action: string, target?: string) => {
    if (action === "dismiss") {
      dismissMessage();
      setIsOpen(false);
    } else if (action === "scroll_to" && target) {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      dismissMessage();
      setIsOpen(false);
    } else if (action === "navigate" && target) {
      router.push(target);
      dismissMessage();
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* ── Chat panel ───────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            right: 16,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            height: 420,
            background: "#0F172A",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            zIndex: 9998,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <Image
                src={catSrc}
                alt="LIFAI CAT"
                width={32}
                height={32}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#EAF0FF" }}>
              LIFAI CAT
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(234,240,255,0.4)",
                fontSize: 20,
                lineHeight: 1,
                padding: "0 2px",
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "24px 20px",
              gap: 20,
              overflowY: "auto",
            }}
          >
            {currentMessage ? (
              <>
                {/* Cat image */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.1)",
                    flexShrink: 0,
                  }}
                >
                  <Image
                    src={catSrc}
                    alt="LIFAI CAT"
                    width={80}
                    height={80}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                {/* Message */}
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    color: "rgba(234,240,255,0.85)",
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {currentMessage.message}
                </p>

                {/* CTA buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  {currentMessage.cta.map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => handleCTA(btn.action, btn.target)}
                      className="active:scale-[0.98]"
                      style={{
                        width: "100%",
                        padding: "11px",
                        borderRadius: 14,
                        border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                        background:
                          i === 0
                            ? "linear-gradient(90deg,#6366F1,#A78BFA)"
                            : "rgba(255,255,255,0.04)",
                        color: i === 0 ? "#fff" : "rgba(234,240,255,0.7)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: i === 0 ? "0 4px 16px rgba(99,102,241,0.35)" : "none",
                        transition: "opacity 0.15s",
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.08)",
                    opacity: 0.45,
                  }}
                >
                  <Image
                    src="/aibot/cat_normal.png"
                    alt="LIFAI CAT"
                    width={64}
                    height={64}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(234,240,255,0.3)",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  新しいお知らせはありません
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Trigger button ───────────────────────────────────────── */}
      <style>{`
        @keyframes bubble-in {
          from { opacity: 0; transform: scale(0.9) translateY(6px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          zIndex: 9999,
        }}
      >
        {/* Speech bubble */}
        {bubbleVisible && currentMessage && !isOpen && (
          <div
            onClick={() => { setIsOpen(true); dismissBubble(); }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 12px)",
              right: 0,
              width: 220,
              background: "#0F172A",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              cursor: "pointer",
              animation: "bubble-in 0.2s ease-out",
            }}
          >
            <p style={{ fontSize: 12, color: "rgba(234,240,255,0.9)", lineHeight: 1.65, margin: 0 }}>
              {currentMessage.message}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {currentMessage.cta.map((btn, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); handleCTA(btn.action, btn.target); }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                    background: i === 0 ? "linear-gradient(90deg,#6366F1,#A78BFA)" : "rgba(255,255,255,0.04)",
                    color: i === 0 ? "#fff" : "rgba(234,240,255,0.7)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left" as const,
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            {/* Tail border */}
            <div style={{
              position: "absolute",
              bottom: -8,
              right: 20,
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid rgba(255,255,255,0.12)",
            }} />
            {/* Tail fill */}
            <div style={{
              position: "absolute",
              bottom: -6,
              right: 21,
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "7px solid #0F172A",
            }} />
          </div>
        )}
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="LIFAI AIBot"
          className="hover:scale-[1.05] active:scale-[0.98]"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            padding: 0,
            cursor: "pointer",
            overflow: "hidden",
            display: "block",
            background: "transparent",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            transition: "transform 0.15s",
          }}
        >
          <Image
            src={catSrc}
            alt="LIFAI CAT"
            width={56}
            height={56}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </button>

        {/* Unread badge */}
        {hasUnread && !isOpen && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#6366F1",
              border: "2px solid #0B1220",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              pointerEvents: "none",
            }}
          >
            💬
          </span>
        )}
      </div>
    </>
  );
}
