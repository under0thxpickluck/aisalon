// app/api/song/status/route.ts
import { NextResponse } from "next/server";
import { getJob } from "../_jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId_required" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.jobId,
    status: job.status,
    bpLocked: job.bpLocked,
    bpFinal: job.bpFinal,
    ...(job.status === "audio_generating" && { stage: job.stage }),
  });
}
