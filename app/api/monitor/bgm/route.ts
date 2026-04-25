import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    queued: 0,
    running: 0,
    failed_today: 0,
    avg_duration_sec: null,
  })
}
