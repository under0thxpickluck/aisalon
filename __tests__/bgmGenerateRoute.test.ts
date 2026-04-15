import { POST } from '@/app/api/bgm/generate/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.REPLICATE_API_TOKEN = 'test-token'
})

afterEach(() => {
  delete process.env.REPLICATE_API_TOKEN
})

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/bgm/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

test('REPLICATE_API_TOKEN未設定なら500', async () => {
  delete process.env.REPLICATE_API_TOKEN
  const res = await POST(makeRequest({ theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(500)
  const json = await res.json()
  expect(json.ok).toBe(false)
})

test('正常: predictionId を返す', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'pred-abc123', status: 'starting' }),
  })
  const res = await POST(makeRequest({ theme: '朝の森', genre: 'クラシック', mood: '落ち着いた', duration: 60 }))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
  expect(json.predictionId).toBe('pred-abc123')
})

test('Replicate APIエラーなら502', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 422,
    json: async () => ({ detail: 'invalid input' }),
  })
  const res = await POST(makeRequest({ theme: 'test', genre: 'ポップ', mood: 'さわやか', duration: 30 }))
  expect(res.status).toBe(502)
  const json = await res.json()
  expect(json.ok).toBe(false)
})

test('プロンプトにinstrumental onlyが含まれる', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'pred-xyz', status: 'starting' }),
  })
  await POST(makeRequest({ theme: 'カフェ', genre: 'ジャズ', mood: 'クール', duration: 30, bpm: 90 }))
  const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
  expect(callBody.input.prompt).toContain('instrumental only')
  expect(callBody.input.prompt).toContain('no vocals')
})
