// lib/narasu-agency/storage.ts
import { NARASU_STORAGE_KEY, NARASU_GATE_KEY } from "./constants";
import type { NarasuAgencyDraft } from "./types";

export function saveDraft(draft: NarasuAgencyDraft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NARASU_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): NarasuAgencyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NARASU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NARASU_STORAGE_KEY);
}

export function setGatePassed(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NARASU_GATE_KEY, "1");
}

export function isGatePassed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(NARASU_GATE_KEY) === "1";
}
