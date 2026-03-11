"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { RULES } from "./rules";
import type { Cat, CTADef } from "./rules";

export type BotMessage = {
  ruleId: string;
  cat: Cat;
  message: string;
  cta: CTADef[];
};

type AIBotContextType = {
  isOpen: boolean;
  setIsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  currentMessage: BotMessage | null;
  hasUnread: boolean;
  bubbleVisible: boolean;
  trackEvent: (type: string, payload?: Record<string, string>) => void;
  dismissMessage: () => void;
  dismissBubble: () => void;
};

const AIBotContext = createContext<AIBotContextType | null>(null);

const SEEN_KEY = "lifai_aibot_seen_v1";
const TUTORIAL_KEY = "lifai_market_tutorial_seen";
const COOLDOWN_MS = 60_000;
const BUBBLE_DURATION_MS = 8_000;

function getSeenFlags(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}

function markSeen(ruleId: string) {
  const flags = getSeenFlags();
  flags[ruleId] = true;
  localStorage.setItem(SEEN_KEY, JSON.stringify(flags));
}

export function AIBotProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<BotMessage | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // Multiple pending timers (one per matching rule per page_view)
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Bubble auto-dismiss timer
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last time a message was shown (for cooldown between page navigations)
  const lastSpokenAt = useRef<number>(0);

  const dismissBubble = useCallback(() => {
    if (bubbleTimer.current) {
      clearTimeout(bubbleTimer.current);
      bubbleTimer.current = null;
    }
    setBubbleVisible(false);
  }, []);

  const showMessage = useCallback(
    (msg: BotMessage) => {
      markSeen(msg.ruleId);
      lastSpokenAt.current = Date.now();
      setCurrentMessage(msg);
      setHasUnread(true);

      // Show bubble and start 8s auto-dismiss
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      setBubbleVisible(true);
      bubbleTimer.current = setTimeout(() => {
        setBubbleVisible(false);
        bubbleTimer.current = null;
      }, BUBBLE_DURATION_MS);
    },
    [dismissBubble],
  );

  const trackEvent = useCallback(
    (type: string, payload?: Record<string, string>) => {
      // Cancel all pending rule timers on new navigation
      pendingTimers.current.forEach((t) => clearTimeout(t));
      pendingTimers.current = [];

      // Global cooldown: if the last message was shown within 60s, skip
      if (Date.now() - lastSpokenAt.current < COOLDOWN_MS) return;

      // Suppress page_view rules while the market tutorial is still active
      const tutorialActive =
        type === "page_view" &&
        typeof window !== "undefined" &&
        !localStorage.getItem(TUTORIAL_KEY);

      for (const rule of RULES) {
        // Match check
        let matches = false;
        if (rule.trigger === "page_view" && type === "page_view") {
          matches = rule.page_id === payload?.page_id;
        } else if (rule.trigger === "error_event" && type === "error_event") {
          matches = rule.error_code === payload?.error_code;
        }
        if (!matches) continue;

        // Seen flag (page_view rules fire only once per lifetime)
        if (rule.trigger === "page_view" && getSeenFlags()[rule.id]) continue;

        // Tutorial suppression
        if (tutorialActive) continue;

        // Optional condition (e.g. balance threshold)
        if (rule.condition && !rule.condition(payload ?? {})) continue;

        const msg: BotMessage = {
          ruleId: rule.id,
          cat: rule.cat,
          message: rule.message,
          cta: rule.cta,
        };

        const timer = setTimeout(() => {
          showMessage(msg);
          pendingTimers.current = pendingTimers.current.filter((t) => t !== timer);
        }, rule.delay_ms);

        pendingTimers.current.push(timer);
        // No break — schedule ALL matching rules (e.g. Rule 4 at 5s + Rule 5 at 10s)
      }
    },
    [showMessage],
  );

  const dismissMessage = useCallback(() => {
    setCurrentMessage(null);
    setHasUnread(false);
    dismissBubble();
  }, [dismissBubble]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pendingTimers.current.forEach((t) => clearTimeout(t));
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    };
  }, []);

  return (
    <AIBotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        currentMessage,
        hasUnread,
        bubbleVisible,
        trackEvent,
        dismissMessage,
        dismissBubble,
      }}
    >
      {children}
    </AIBotContext.Provider>
  );
}

/** Hook — gracefully returns no-ops when used outside AIBotProvider */
export function useAIBot(): AIBotContextType {
  const ctx = useContext(AIBotContext);
  if (!ctx) {
    return {
      isOpen: false,
      setIsOpen: () => {},
      currentMessage: null,
      hasUnread: false,
      bubbleVisible: false,
      trackEvent: () => {},
      dismissMessage: () => {},
      dismissBubble: () => {},
    };
  }
  return ctx;
}
