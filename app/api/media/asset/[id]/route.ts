import { NextRequest, NextResponse } from "next/server";
import { MediaRepository } from "@/lib/repository/MediaRepository";
import { verifyToken } from "@/lib/security/TokenLogic";

function getTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get("kakiokiToken")?.value ?? null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const mediaRepo = new MediaRepository();
  const asset = await mediaRepo.findById(id);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!asset.is_public) {
    const token = getTokenFromCookie(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowed = await mediaRepo.canAccess(id, decoded.id);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const full = await mediaRepo.getDataById(id);
  if (!full) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(full.data), {
    status: 200,
    headers: {
      "Content-Type": full.content_type,
      "Content-Length": full.byte_size.toString(),
      "Cache-Control": asset.is_public
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
    },
  });
}
