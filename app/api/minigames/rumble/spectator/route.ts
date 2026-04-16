import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_DATA = {
  ok: true, status: "ready", total: 5, date: new Date(Date.now() + 9*3600000).toISOString().slice(0,10),
  players: [
    { id: "mock1", display_name: "勇者アルファ", score: 180, rp: 50, rank: 1, is_self: true,  status: "alive" },
    { id: "mock2", display_name: "魔法使いβ",   score: 160, rp: 40, rank: 2, is_self: false, status: "alive" },
    { id: "mock3", display_name: "剣士ガンマ",  score: 140, rp: 30, rank: 3, is_self: false, status: "alive" },
    { id: "mock4", display_name: "忍者δ",       score: 120, rp: 20, rank: 4, is_self: false, status: "alive" },
    { id: "mock5", display_name: "戦士ε",       score: 100, rp: 10, rank: 5, is_self: false, status: "alive" },
  ],
  events: [
    { type: "intro",          text: "ランブルが はじまる！",                                    delay: 0    },
    { type: "log",            text: "きょうの せんしは 5にん！\nはげしい たたかいが はじまる！", delay: 800  },
    { type: "batch_eliminate",text: "2にん が だつらく！\nのこり 3にん！", ids: ["mock4","mock5"], delay: 2000 },
    { type: "battle",         text: "魔法使いβ が おそいかかる！\n勇者アルファ は うけとめた！\n42 ダメージ！",      a: "mock2", b: "mock1", is_crit: false, delay: 3500 },
    { type: "battle",         text: "剣士ガンマ が おそいかかる！\n勇者アルファ の かいしんの うけ！\n88 ダメージを はじき返した！！", a: "mock3", b: "mock1", is_crit: true, delay: 5000 },
    { type: "batch_eliminate",text: "2にん が だつらく！\nのこり 1にん！", ids: ["mock2","mock3"], delay: 6500 },
    { type: "ranking",        delay: 8000 },
    { type: "result",         text: "🏆 勇者アルファ が本日の勝者となった！",                   delay: 9500 },
  ],
  self:    { id: "mock1", display_name: "勇者アルファ", score: 180, rp: 50, rank: 1, is_self: true, status: "alive", week_rp: 200, week_rank: 1 },
  ranking: [
    { user_id: "mock1", display_name: "勇者アルファ", total_rp: 200 },
    { user_id: "mock2", display_name: "魔法使いβ",   total_rp: 160 },
    { user_id: "mock3", display_name: "剣士ガンマ",  total_rp: 120 },
  ],
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  const date   = searchParams.get("date") ?? "";

  if (searchParams.get("mock") === "1") {
    return NextResponse.json({ ...MOCK_DATA, self: { ...MOCK_DATA.self, id: userId || "mock1" } });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "rumble_spectator", userId, date }),
    });
    return NextResponse.json(await res.json().catch(() => ({ ok: false, error: "invalid_response" })));
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  }
}
