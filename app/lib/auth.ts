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

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
