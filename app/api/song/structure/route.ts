// app/api/song/structure/route.ts
import { NextResponse } from "next/server";
import { getJob } from "../_jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READY_STATUSES = new Set(["structure_ready", "audio_generating", "completed"]);

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

  if (!READY_STATUSES.has(job.status) || !job.structureData) {
    return NextResponse.json(
      { ok: false, error: "structure_not_ready", status: job.status },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    bpm: job.structureData.bpm,
    key: job.structureData.key,
    sections: job.structureData.sections,
    hookSummary: job.structureData.hookSummary,
    title: job.structureData.title,
  });
}
