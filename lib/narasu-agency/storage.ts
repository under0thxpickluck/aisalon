// lib/narasu-agency/storage.ts
import { NARASU_STORAGE_KEY, NARASU_GATE_KEY } from "./constants";
import type { NarasuAgencyDraft } from "./types";

const NARASU_PASSWORD_KEY = "lifai_narasu_pw_v1";

export function saveDraft(draft: NarasuAgencyDraft): void {
  if (typeof window === "undefined") return;
  const { narasuPassword, ...rest } = draft;
  localStorage.setItem(NARASU_STORAGE_KEY, JSON.stringify(rest));
  sessionStorage.setItem(NARASU_PASSWORD_KEY, narasuPassword);
}

export function loadDraft(): NarasuAgencyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NARASU_STORAGE_KEY);
    if (!raw) return null;
    const rest = JSON.parse(raw);
    const narasuPassword = sessionStorage.getItem(NARASU_PASSWORD_KEY) ?? "";
    return { ...rest, narasuPassword };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NARASU_STORAGE_KEY);
  sessionStorage.removeItem(NARASU_PASSWORD_KEY);
}

export function setGatePassed(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NARASU_GATE_KEY, "1");
}

export function isGatePassed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(NARASU_GATE_KEY) === "1";
}
