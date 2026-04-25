import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GAS_URL = process.env.GAS_WEBAPP_URL!
const GAS_API_KEY = process.env.GAS_API_KEY!

export async function GET() {
  try {
    const url = `${GAS_URL}${GAS_URL.includes('?') ? '&' : '?'}key=${encodeURIComponent(GAS_API_KEY)}`
    const bodyStr = JSON.stringify({ action: 'monitor_boost_subscribers', key: GAS_API_KEY })
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(bodyStr)) },
      body: bodyStr,
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
