// app/api/song/_jobStore.ts
// GAS song_jobs シートによるジョブ永続化版
// Vercelサーバーレスのインスタンス切れによるjob_not_foundを解消

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

async function callGas(action: string, params: Record<string, unknown>) {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  const bodyStr = JSON.stringify({ action, key: GAS_API_KEY, ...params });
  const res = await fetch(url, {
    method:   "POST",
    headers:  {
      "Content-Type":   "application/json",
      "Content-Length": String(Buffer.byteLength(bodyStr)),
    },
    body:     bodyStr,
    cache:    "no-store",
    redirect: "follow",
  });
  return res.json();
}

// ========== 型定義（既存と互換） ==========

export type JobStatus =
  | "queued" | "lyrics_generating" | "lyrics_ready"
  | "structure_generating" | "structure_ready"
  | "audio_generating"        // 旧ステータス（後方互換）
  | "generating_audio"        // ElevenLabs 音声生成中
  | "postprocessing"          // EQ/Comp/Reverb/Loudness 処理中
  | "uploading_result"        // final 音源を R2 へ保存中
  | "completed" | "failed" | "cancelled";

export type SongJob = {
  jobId:          string;
  userId?:        string;
  status:         JobStatus;
  stage?:         string;
  lyricsData?:    { title?: string; lyrics?: string } | null;
  structureData?: { bpm?: number; key?: string; sections?: string[]; hook?: string; hookSummary?: string; title?: string } | null;
  prompt:         {
    theme?: string; genre?: string; mood?: string;
    language?: string; durationTargetSec?: number;
    structurePreset?: string; moodTags?: string[];
  };
  audioUrl?:      string;
  downloadUrl?:   string;
  error?:         string;
  bpLocked?:      number;
  bpFinal?:       number;
  rightsLog?:     {
    lyricsApproved?: boolean;
    structureApproved?: boolean;
    humanEdited?: boolean;
    postprocessApplied?: boolean;
    postprocessPreset?: string;
    postprocessVersion?: string;
    postprocessFallbackRaw?: boolean;
    fallbackReason?: string;
  };
  // 後加工パイプライン追加フィールド
  rawAudioUrl?:           string;
  processedAudioUrl?:     string;
  postprocessStatus?:     "pending" | "running" | "done" | "failed";
  postprocessPreset?:     string;
  postprocessVersion?:    string;
  analysisJson?:          string;
  postprocessStartedAt?:  string;
  postprocessCompletedAt?: string;
  postprocessError?:      string;
  finalLufs?:             number | null;
  finalPeakDb?:           number | null;
  humanizeLevel?:         number;
};

// ========== CRUD ==========

export async function createJob(
  jobId: string,
  userId: string,
  prompt: SongJob["prompt"],
  bpLocked: number
): Promise<void> {
  await callGas("create_music_job", { jobId, userId, prompt, bpLocked });
}

export async function getJob(jobId: string): Promise<SongJob | null> {
  const res = await callGas("get_music_job", { jobId });
  if (!res.ok) return null;
  return res as SongJob;
}

export async function updateJob(
  jobId: string,
  fields: Partial<Omit<SongJob, "jobId">>
): Promise<void> {
  await callGas("update_music_job", { jobId, fields });
}

// listUserJobs は今は未使用だがシグネチャ維持
export async function listUserJobs(_userId: string): Promise<SongJob[]> {
  return [];
}
