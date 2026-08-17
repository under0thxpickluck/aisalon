import { NextRequest, NextResponse } from "next/server";
import { gasPost } from "@/app/lib/sticker/gas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// プロジェクトの取得。project_id 省略時は一覧を返す。
export async function POST(req: NextRequest) {
  try {
    const { id, code, projectId } = (await req.json()) as {
      id?: string;
      code?: string;
      projectId?: string;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const res = await gasPost("sticker_get", {
      id,
      project_id: projectId ?? "",
    });

    if (!res?.ok) {
      return NextResponse.json(
        { ok: false, error: res?.error ?? "fetch_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      projects: res.projects ?? [],
      project: res.project ?? null,
      credits: Number(res.credits ?? 0),
    });
  } catch (e) {
    console.error("[sticker/project] failed:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// プロジェクトの保存。credits 列は触らない（start / render のみが更新する）。
export async function PUT(req: NextRequest) {
  try {
    const { id, code, projectId, name, status, project } = (await req.json()) as {
      id?: string;
      code?: string;
      projectId?: string;
      name?: string;
      status?: string;
      project?: unknown;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!projectId || !project) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }

    const res = await gasPost("sticker_save", {
      id,
      project_id: projectId,
      name: name ?? "",
      status: status ?? "draft",
      project_json: JSON.stringify(project),
    });

    if (!res?.ok) {
      return NextResponse.json(
        { ok: false, error: res?.error ?? "save_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, credits: Number(res.credits ?? 0) });
  } catch (e) {
    console.error("[sticker/project] failed:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
