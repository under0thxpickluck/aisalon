import { NextRequest, NextResponse } from "next/server";
import { uploadImageBuffer } from "@/app/lib/image/image_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// ユーザーがアップロードしたキャラクターの元画像をR2に保存する。
// BPは消費しない（生成していないため）。保存したURLは
// /api/sticker/plan と /api/sticker/character に渡される。
export async function POST(req: NextRequest) {
  try {
    // multipart 以外が来ると formData() は例外を投げる。
    // 不正なリクエストで500を返さないよう、ここで400に落とす。
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { ok: false, error: "multipart_required" },
        { status: 400 }
      );
    }

    const id = String(form.get("id") ?? "");
    const code = String(form.get("code") ?? "");
    const file = form.get("file");

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "unsupported_type" },
        { status: 415 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImageBuffer(buffer, file.type, "stickers/source");

    // R2未設定だと data: URI が返る。それをプロジェクトJSONに入れると
    // シートのセル上限を超えて保存が壊れるため、ここで弾く。
    if (url.startsWith("data:")) {
      return NextResponse.json(
        { ok: false, error: "image_storage_unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[sticker/upload] failed:", e);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
}
