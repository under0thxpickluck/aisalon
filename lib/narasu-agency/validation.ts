// lib/narasu-agency/validation.ts
import type { NarasuAgencyDraft } from "./types";

function isValidUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

export type ValidationErrors = Partial<Record<keyof NarasuAgencyDraft | "audioUrls_items", string>>;

export function validateDraft(draft: NarasuAgencyDraft): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!draft.narasuLoginId.trim()) {
    errors.narasuLoginId = "narasuアカウントID（メールアドレス）を入力してください";
  }
  if (!draft.narasuPassword.trim()) {
    errors.narasuPassword = "narasuパスワードを入力してください";
  }

  const filledUrls = draft.audioUrls.filter((e) => e.url.trim());
  if (filledUrls.length === 0) {
    errors.audioUrls = "音源URLを1件以上入力してください";
  } else {
    const invalidUrl = filledUrls.find((e) => !isValidUrl(e.url.trim()));
    if (invalidUrl) {
      errors.audioUrls_items = "URL形式が正しくありません: " + invalidUrl.url;
    }
  }

  if (draft.jacketImageUrl.trim() && !isValidUrl(draft.jacketImageUrl.trim())) {
    errors.jacketImageUrl = "ジャケット画像URLの形式が正しくありません";
  }

  return errors;
}
