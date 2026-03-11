// lyrics in-memory cache keyed by predictionId
// Node.js single-process では generate/status 間で共有される
const cache = new Map<string, string>();

export function cacheLyrics(predictionId: string, lyrics: string): void {
  cache.set(predictionId, lyrics);
  // 2時間後に自動削除（メモリリーク防止）
  setTimeout(() => cache.delete(predictionId), 2 * 60 * 60 * 1000);
}

export function getCachedLyrics(predictionId: string): string | null {
  return cache.get(predictionId) ?? null;
}

// ── 3セクションジョブキャッシュ ──────────────────────────────────
export type JobStage = "verse" | "chorus" | "bridge" | "merging" | "done" | "failed";

export type JobState = {
  verseId: string;
  chorusId: string;
  bridgeId: string;
  stage: JobStage;
  lyrics: string;
  verseUrl?: string;
  chorusUrl?: string;
  bridgeUrl?: string;
  outputUrl?: string;
};

const jobCache = new Map<string, JobState>();

export function cacheJob(jobId: string, job: JobState): void {
  jobCache.set(jobId, job);
  // 4時間後に自動削除
  setTimeout(() => jobCache.delete(jobId), 4 * 60 * 60 * 1000);
}

export function getJob(jobId: string): JobState | null {
  return jobCache.get(jobId) ?? null;
}

export function updateJob(jobId: string, update: Partial<JobState>): void {
  const existing = jobCache.get(jobId);
  if (existing) jobCache.set(jobId, { ...existing, ...update });
}
