import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MissingAblyKeyError, getAblyRest } from "@/lib/server/AblyServer";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const rest = getAblyRest();
    const uid = user.id;
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: `user:${uid}`,
      capability: {
        [`user:chat:${uid}`]: ["subscribe"],
        [`user:${uid}:friends`]: ["subscribe"],
        [`user:lifecycle:${uid}`]: ["subscribe"],
        [`user:${uid}:presence`]: ["subscribe", "presence", "publish"],
        "user:*:presence": ["subscribe", "presence"],
        "chat:thread:*": ["subscribe"],
        "chat:status:*": ["subscribe"],
        "chat:control:*": ["subscribe"],
      },
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably token error:", error);
    if (error instanceof MissingAblyKeyError) {
      return NextResponse.json(
        { error: "Ably API key missing" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}
