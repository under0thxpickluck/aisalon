export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "pending" | "invalid" };

type MockUserDB = Record<
  string,
  { password: string; status: "approved" | "pending" }
>;

// モックDB：ここを後でAPI/DBに置き換える
const MOCK_USERS: MockUserDB = {
  "demo01": { password: "pass01", status: "approved" },
  "demo02": { password: "pass02", status: "pending" },
};

export async function loginMock(id: string, password: string): Promise<LoginResult> {
  // ちょい待ち（実際のAPIっぽく）
  await new Promise((r) => setTimeout(r, 500));

  // ✅ 一時的に「全部OK」にする（誰でもTOPへ）
  return { ok: true };
}
  const u = MOCK_USERS[id];
  if (!u) return { ok: false, reason: "invalid" };
  if (u.password !== password) return { ok: false, reason: "invalid" };
  if (u.status === "pending") return { ok: false, reason: "pending" };
  return { ok: true };
}
