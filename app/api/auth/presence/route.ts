import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { UserRepository } from "@/lib";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const userRepository = new UserRepository();
    await userRepository.updateLastSeen(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update last_seen_at:", error);
    return NextResponse.json(
      { error: "Failed to update presence" },
      { status: 500 },
    );
  }
}
