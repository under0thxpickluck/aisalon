// app/api/song/_jobStore.ts
// メモリキャッシュ、4時間TTL
import { BP_COSTS } from "@/app/lib/bp-config";

export type SongStatus =
  | "queued"
  | "lyrics_generating"
  | "lyrics_ready"
  | "structure_generating"
  | "structure_ready"
  | "audio_generating"
  | "completed"
  | "failed"
  | "cancelled";

export type SongJob = {
  jobId: string;
  userId: string;
  status: SongStatus;
  bpLocked: number;
  bpFinal: number | null;
  prompt: {
    theme: string;
    genre: string;
    mood: string;
    language?: string;
    durationTargetSec?: number;
    structurePreset?: string;
    moodTags?: string[];
  };
  lyricsData: {
    title: string;
    lyrics: string;
    editedByUser: boolean;
    version: number;
  } | null;
  structureData: {
    bpm: number;
    key: string;
    sections: string[];
    hookSummary: string;
    title: string;
  } | null;
  audioUrl: string | null;
  downloadUrl: string | null;
  stage?: "intro" | "verse" | "chorus" | "outro" | "merging" | "generating";
  rightsLog: {
    lyricsApproved: boolean;
    structureApproved: boolean;
    humanEditedLyrics: boolean;
  };
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

// シングルトンパターン：Next.jsのホットリロード時もjobMapを維持するためglobalを使用
// モジュールローカルのMapだと各APIルートで別インスタンスになり共有できない
const globalStore = global as typeof global & {
  __jobMap__: Map<string, SongJob>;
};
if (!globalStore.__jobMap__) {
  globalStore.__jobMap__ = new Map();
}
const store = globalStore.__jobMap__;

const TTL_MS = 4 * 60 * 60 * 1000; // 4時間

export function createJob(params: {
  jobId: string;
  userId: string;
  theme: string;
  genre: string;
  mood: string;
}): SongJob {
  const now = Date.now();
  const job: SongJob = {
    jobId: params.jobId,
    userId: params.userId,
    status: "lyrics_generating",
    bpLocked: BP_COSTS.music_full,
    bpFinal: null,
    prompt: { theme: params.theme, genre: params.genre, mood: params.mood },
    lyricsData: null,
    structureData: null,
    audioUrl: null,
    downloadUrl: null,
    rightsLog: {
      lyricsApproved: false,
      structureApproved: false,
      humanEditedLyrics: false,
    },
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  store.set(params.jobId, job);
  console.log(`[jobStore] created: ${params.jobId}, storeSize: ${store.size}`);
  setTimeout(() => store.delete(params.jobId), TTL_MS);
  return job;
}

export function getJob(jobId: string): SongJob | null {
  const job = store.get(jobId) ?? null;
  console.log(`[jobStore] get: ${jobId}, found: ${job !== null}, storeSize: ${store.size}`);
  return job;
}

export function updateJob(jobId: string, update: Partial<SongJob>): SongJob | null {
  const existing = store.get(jobId);
  if (!existing) return null;
  const updated: SongJob = { ...existing, ...update, updatedAt: Date.now() };
  store.set(jobId, updated);
  return updated;
}

export function listUserJobs(userId: string): SongJob[] {
  return Array.from(store.values()).filter((j) => j.userId === userId);
}
