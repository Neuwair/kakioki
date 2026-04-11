import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import {
  MissingAblyKeyError,
  getAblyRest,
  buildAblyCapability,
} from "@/lib/server/AblyServer";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const rest = getAblyRest();
    const uid = user.id;
    const capability = buildAblyCapability(uid);
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: uid.toString(),
      capability,
    });
    console.log("[security] Issued Ably token", {
      userId: uid,
      channels: Object.keys(capability),
      capability: tokenRequest.capability,
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably token error:", error);
    if (error instanceof MissingAblyKeyError) {
      return NextResponse.json(
        { error: "Ably API key missing" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 },
    );
  }
}
