// app/features/music/providers/elevenlabsProvider.ts
// ElevenLabs Music Generation Provider
// 将来他のプロバイダーに差し替え可能なインターフェース実装

export type MusicGenerateInput = {
  prompt: string
  lyrics?: string
  lyricsMode: "auto" | "manual"
  language?: string
  durationTargetSec?: number
  vocalMode?: "vocal" | "instrumental"
  structurePreset?: string
  moodTags?: string[]
  genre?: string
  mood?: string
  bpm?: number
  key?: string
}

export type MusicGenerateResult = {
  provider: string
  audioUrl: string
  durationSec?: number
  rawResponse?: unknown
}

export interface MusicProvider {
  name: string
  generateMusic(input: MusicGenerateInput): Promise<MusicGenerateResult>
}

export function buildElevenLabsPrompt(input: MusicGenerateInput): string {
  const parts: string[] = []

  if (input.genre)  parts.push(input.genre)
  if (input.mood)   parts.push(input.mood)
  if (input.prompt) parts.push(input.prompt)

  const lang = input.language === "ja" ? "Japanese lyrics" : input.language === "en" ? "English lyrics" : ""
  if (lang) parts.push(lang)

  if (input.vocalMode === "vocal") {
    parts.push("vocal song, human-like singing, warm and natural voice")
  } else {
    parts.push("instrumental, no vocals")
  }

  if (input.bpm) parts.push(`${input.bpm} BPM`)
  if (input.key) parts.push(`key of ${input.key}`)

  parts.push("low noise, clear mix, studio quality")

  const duration = input.durationTargetSec ?? 165
  const minutes  = Math.floor(duration / 60)
  const seconds  = duration % 60
  parts.push(`around ${minutes} minutes ${seconds > 0 ? seconds + " seconds" : ""}`)

  if (input.structurePreset) {
    const structureMap: Record<string, string> = {
      short_pop:  "structure: intro, verse, chorus, outro",
      ballad:     "structure: intro, verse, chorus, verse, chorus, outro",
      upbeat:     "structure: intro, verse, chorus, verse, chorus, bridge, outro",
      cinematic:  "structure: intro, build, climax, resolution, outro",
    }
    const structStr = structureMap[input.structurePreset]
    if (structStr) parts.push(structStr)
  }

  if (input.moodTags && input.moodTags.length > 0) {
    parts.push(input.moodTags.join(", "))
  }

  return parts.filter(Boolean).join(", ")
}

export class ElevenLabsProvider implements MusicProvider {
  name = "elevenlabs"
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateMusic(input: MusicGenerateInput): Promise<MusicGenerateResult> {
    const prompt      = buildElevenLabsPrompt(input)
    const durationSec = input.durationTargetSec ?? 165

    console.log(`[ElevenLabs] Starting music generation`, {
      promptLength: prompt.length,
      durationSec,
      vocalMode: input.vocalMode,
    })

    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key":   this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text:              prompt,
        duration_seconds:  Math.min(durationSec, 180),
        prompt_influence:  0.5,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error")
      console.error(`[ElevenLabs] API error: ${res.status}`, errText)
      throw new Error(`elevenlabs_api_error: ${res.status} ${errText}`)
    }

    const audioBuffer = await res.arrayBuffer()
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      throw new Error("elevenlabs_empty_response")
    }

    console.log(`[ElevenLabs] Generation succeeded`, { audioBytes: audioBuffer.byteLength })

    const base64  = Buffer.from(audioBuffer).toString("base64")
    const audioUrl = `data:audio/mpeg;base64,${base64}`

    return {
      provider:    "elevenlabs",
      audioUrl,
      rawResponse: { bytes: audioBuffer.byteLength },
    }
  }
}

export async function uploadToR2(
  audioBuffer: ArrayBuffer,
  jobId: string,
  userId: string
): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const bucket    = process.env.CLOUDFLARE_R2_BUCKET_NAME
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL

  if (!accountId || !accessKey || !secretKey || !bucket) return null

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
    const s3 = new S3Client({
      region:      "auto",
      endpoint,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    })

    const key = `music/${userId}/${jobId}/final.mp3`
    await s3.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        Buffer.from(audioBuffer),
      ContentType: "audio/mpeg",
    }))

    console.log(`[R2] Uploaded: ${key}`)
    return publicUrl ? `${publicUrl}/${key}` : null
  } catch (err: any) {
    console.error(`[R2] Upload failed:`, err?.message)
    return null
  }
}
