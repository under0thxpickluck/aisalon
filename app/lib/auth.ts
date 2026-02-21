// app/lib/auth.ts
export type AuthStatus = "approved" | "pending";

export type AuthState = {
  status: AuthStatus;
  id: string;
  // 将来API化したら token を使う想定（今はモック）
  token?: string;
  updatedAt: number;
};

const KEY = "addval_auth_v1";

// ✅ 追加：ログイン時に入力した code(=password) は sessionStorage にだけ持つ
// ※ localStorage に置かない（漏洩リスク対策）
const KEY_SECRET = "addval_auth_secret_v1";

function safeParse(raw: string | null): AuthState | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as AuthState;
    if (!obj?.status || !obj?.id) return null;
    return obj;
  } catch {
    return null;
  }
}

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  return safeParse(localStorage.getItem(KEY));
}

export function setAuth(next: Omit<AuthState, "updatedAt">): AuthState {
  const state: AuthState = { ...next, updatedAt: Date.now() };
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  return state;
}

// ✅ 追加：code を sessionStorage に保存（ブラウザ閉じたら消える）
export function setAuthSecret(secret: string) {
  if (typeof window === "undefined") return;
  if (!secret) return;
  sessionStorage.setItem(KEY_SECRET, String(secret));
}

// ✅ 追加：保存した code を取得（/api/me などに渡す用）
export function getAuthSecret(): string {
  if (typeof window === "undefined") return "";
  return String(sessionStorage.getItem(KEY_SECRET) || "");
}

// ✅ 追加：secret だけ消す
export function clearAuthSecret() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_SECRET);
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  // ✅ 追加：一緒に secret も消す（壊さない）
  sessionStorage.removeItem(KEY_SECRET);
}