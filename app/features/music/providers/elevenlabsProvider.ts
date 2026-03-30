// app/features/music/providers/elevenlabsProvider.ts
// ElevenLabs Music Generation Provider
// 将来他のプロバイダーに差し替え可能なインターフェース実装

import { buildLyricsConstraintPrompt } from "@/lib/music/elevenlabs-constraints";

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
  isPro?: boolean
  anchorWords?: string[]   // Phase 1: 意味拘束キーワード
  hookLines?: string[]     // Phase 1: サビ固定行
  maxChorusRepeats?: number // Phase 3: 再生成時に反復制限を強化
}

export type MusicGenerateResult = {
  provider: string
  audioBuffer: ArrayBuffer
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

  if (input.vocalMode === "vocal") {
    // 日本語: 言語名を直接書かず、アジア系ボーカルスタイルで指定
    const vocalStyle = input.language === "ja"
      ? "vocal song, Asian female vocal, warm and natural voice, melodic singing style"
      : "vocal song, human-like singing, warm and natural voice"
    parts.push(vocalStyle)
  } else {
    parts.push("instrumental, no vocals")
  }

  if (input.bpm) parts.push(`${input.bpm} BPM`)
  if (input.key) parts.push(`key of ${input.key}`)

  // 歌詞拘束プロンプト（anchorWords / hookLines がある場合）
  if (input.anchorWords?.length || input.hookLines?.length) {
    parts.push(buildLyricsConstraintPrompt({
      anchorWords:      input.anchorWords,
      hookLines:        input.hookLines,
      maxChorusRepeats: input.maxChorusRepeats,
    }))
  }

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
      hook_only:  "structure: hook (chorus only)",
    }
    const structStr = structureMap[input.structurePreset]
    if (structStr) parts.push(structStr)
  }

  if (input.moodTags && input.moodTags.length > 0) {
    parts.push(input.moodTags.join(", "))
  }

  return parts.filter(Boolean).join(", ")
}

// Pro用の詳細プロンプト（Core/Infraプラン向け）
export function buildElevenLabsProPrompt(input: MusicGenerateInput): string {
  const parts: string[] = []

  // ジャンルを英語的な詳細表現に
  const genreMap: Record<string, string> = {
    "ポップ": "J-Pop, modern pop production",
    "ロック": "J-Rock, electric guitar driven rock",
    "ジャズ": "contemporary jazz, sophisticated chord progressions",
    "クラシック": "orchestral, classical arrangement, strings and piano",
    "EDM": "electronic dance music, powerful synthesizer leads, four-on-the-floor beat",
    "ヒップホップ": "J-Hip-Hop, trap influenced, heavy 808 bass",
    "R&B": "R&B, smooth groove, warm bass line, lush chords",
    "アニメ": "anime-style J-Pop, energetic and melodic, catchy hook",
    "ローファイ": "lo-fi hip-hop, relaxed tempo, warm vinyl texture, mellow chords",
    "シネマティック": "cinematic orchestral, epic build-up, emotional strings and piano",
  }
  parts.push(genreMap[input.genre ?? ""] || input.genre || "J-Pop")

  // ムードを詳細な英語表現に
  const moodMap: Record<string, string> = {
    "さわやか": "fresh, breezy, uplifting, bright atmosphere",
    "クール": "cool, sophisticated, smooth, laid-back vibe",
    "エモい": "emotionally resonant, heartfelt, nostalgic, bittersweet",
    "明るい": "cheerful, bright, energetic, positive energy",
    "落ち着いた": "calm, serene, relaxed, peaceful mood",
    "ロマンチック": "romantic, tender, warm and intimate, passionate",
    "激しい": "intense, powerful, high energy, dynamic and driving",
    "切ない": "melancholic, poignant, longing, emotional depth",
  }
  const moodStr = input.mood?.split("・").map((m) => moodMap[m.trim()] || m).join(", ")
  if (moodStr) parts.push(moodStr)

  // テーマ
  if (input.prompt) parts.push(input.prompt)

  // ボーカル（詳細指定）
  parts.push(
    "professional Japanese female vocalist, clear and expressive singing, " +
    "warm timbre, precise intonation, emotional delivery with natural vibrato, " +
    "studio vocal recording quality"
  )

  // BPM・Key
  if (input.bpm) parts.push(`${input.bpm} BPM, precise tempo`)
  if (input.key)  parts.push(`key of ${input.key}`)

  // 歌詞拘束プロンプト（anchorWords / hookLines がある場合）
  if (input.anchorWords?.length || input.hookLines?.length) {
    parts.push(buildLyricsConstraintPrompt({
      anchorWords:      input.anchorWords,
      hookLines:        input.hookLines,
      maxChorusRepeats: input.maxChorusRepeats,
    }))
  }

  // オーディオ品質（詳細）
  parts.push(
    "professional studio production, crystal clear mix, " +
    "well-balanced frequency spectrum, punchy transients, " +
    "wide stereo field, mastered to commercial loudness standards"
  )

  // デュレーション
  const duration = input.durationTargetSec ?? 180
  const minutes  = Math.floor(duration / 60)
  const seconds  = duration % 60
  parts.push(`around ${minutes} minutes ${seconds > 0 ? seconds + " seconds" : ""}`)

  // 構成（Proは詳細）
  const structureMap: Record<string, string> = {
    short_pop:  "song structure: 8-bar intro, 16-bar verse, 8-bar pre-chorus, 16-bar chorus, 16-bar verse, 16-bar chorus, 8-bar outro",
    ballad:     "song structure: 8-bar intro, 16-bar verse, 8-bar pre-chorus, 16-bar chorus, 16-bar verse, 16-bar chorus, 8-bar bridge, 16-bar final chorus, 8-bar outro",
    upbeat:     "song structure: 4-bar intro, 16-bar verse, 8-bar pre-chorus, 16-bar chorus, 16-bar verse, 16-bar chorus, 8-bar bridge, 16-bar final chorus, 4-bar outro",
    cinematic:  "song structure: 16-bar atmospheric intro, gradual build, 32-bar climax, emotional resolution, 8-bar outro",
    hook_only:  "song structure: 16-bar powerful hook chorus section, repeated with variation",
  }
  const structStr = structureMap[input.structurePreset ?? "short_pop"]
  if (structStr) parts.push(structStr)

  return parts.filter(Boolean).join(", ")
}

export class ElevenLabsProvider implements MusicProvider {
  name = "elevenlabs"
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateMusic(input: MusicGenerateInput): Promise<MusicGenerateResult> {
    const prompt      = input.isPro ? buildElevenLabsProPrompt(input) : buildElevenLabsPrompt(input)
    const durationSec = input.durationTargetSec ?? (input.isPro ? 180 : 165)

    console.log(`[ElevenLabs] Starting music generation`, {
      promptLength: prompt.length,
      durationSec,
      vocalMode: input.vocalMode,
    })

    const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
      method: "POST",
      headers: {
        "xi-api-key":   this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt:             prompt,
        lyrics:             input.lyrics ?? undefined,
        music_length_ms:    durationSec * 1000,
        model_id:           "music_v1",
        force_instrumental: input.vocalMode === "instrumental",
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

    return {
      provider:    "elevenlabs",
      audioBuffer,
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
