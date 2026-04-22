import { NextResponse } from 'next/server'
import { getAllJobStats } from '../../music/_cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stats = getAllJobStats()
    return NextResponse.json({
      ok: true,
      ...stats,
      avg_duration_sec: null,
      p95_duration_sec: null,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
