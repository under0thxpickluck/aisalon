import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { loginId } = await req.json();

    if (!loginId) {
      return NextResponse.json({ ok: false, error: 'loginId_required' }, { status: 400 });
    }

    const gasUrl  = process.env.GAS_WEBAPP_URL!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fortune_daily_bp', loginId, adminKey }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: 'failed' });
  }
}
