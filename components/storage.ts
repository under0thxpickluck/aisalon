/* =========================================
   Draft Storage (sessionStorage)
   versioned / type-safe / merge-safe
========================================= */

const STORAGE_KEY = "addval_apply_draft_v1";
const STORAGE_VERSION = 1;

/* -----------------------------------------
   Types
------------------------------------------ */

export type Plan = "30" |  "50" | "100" | "500" | "1000";
export type Chain = "BEP20" | "TRC20";

export type Draft = {
  version?: number;

  plan?: Plan;
  chain?: Chain;

  email?: string;
  name?: string;
  nameKana?: string;
  discordId?: string;

  refName?: string;
  refId?: string;
  region?: string;

  receiveWallet?: string;
  txid?: string;

  updatedAt?: number;
};

/* -----------------------------------------
   Safe Helpers
------------------------------------------ */

function isBrowser() {
  return typeof window !== "undefined";
}

function safeParse(json: string | null): Draft | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as Draft;
  } catch {
    return null;
  }
}

/* -----------------------------------------
   Load
------------------------------------------ */

export function loadDraft(): Draft {
  if (!isBrowser()) return {};

  const raw = sessionStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);

  if (!parsed) return {};

  // バージョン不一致ならリセット
  if (parsed.version !== STORAGE_VERSION) {
    sessionStorage.removeItem(STORAGE_KEY);
    return {};
  }

  return parsed;
}

/* -----------------------------------------
   Save (merge safe)
------------------------------------------ */

export function saveDraft(next: Partial<Draft>) {
  if (!isBrowser()) return;

  const current = loadDraft();

  const merged: Draft = {
    ...current,
    ...next,
    version: STORAGE_VERSION,
    updatedAt: Date.now(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

/* -----------------------------------------
   Clear
------------------------------------------ */

export function clearDraft() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/* -----------------------------------------
   Utilities
------------------------------------------ */

// 単一フィールド更新
export function updateDraftField<K extends keyof Draft>(
  key: K,
  value: Draft[K]
) {
  saveDraft({ [key]: value });
}

// 存在チェック
export function hasDraft(): boolean {
  if (!isBrowser()) return false;
  return !!sessionStorage.getItem(STORAGE_KEY);
}

// デバッグ用
export function getRawDraft(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(STORAGE_KEY);
}
