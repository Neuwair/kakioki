import { NextRequest, NextResponse } from "next/server";
import { FriendRepository } from "@/lib";
import { requireAuth } from "@/lib/auth/ServerAuth";

const friendRepository = new FriendRepository();

type FriendSearchPayload = {
  query?: string;
  limit?: number;
};

function mapRelationship(
  currentUserId: number,
  status?: string,
  requesterId?: number | null,
  addresseeId?: number | null,
): "none" | "incoming" | "outgoing" | "friends" {
  if (status === "accepted") {
    return "friends";
  }
  if (status === "pending" && requesterId && addresseeId) {
    if (requesterId === currentUserId) {
      return "outgoing";
    }
    if (addresseeId === currentUserId) {
      return "incoming";
    }
  }
  return "none";
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const rawBody = await request.text();
    let body: FriendSearchPayload = {};

    if (rawBody.trim().length > 0) {
      try {
        body = JSON.parse(rawBody) as FriendSearchPayload;
      } catch (parseError) {
        console.error("Friend search payload parse error:", parseError);
        return NextResponse.json(
          { error: "Invalid search payload" },
          { status: 400 },
        );
      }
    }

    const query = typeof body.query === "string" ? body.query : "";
    const limit =
      typeof body.limit === "number"
        ? Math.min(Math.max(body.limit, 1), 50)
        : 20;

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const matches = await friendRepository.searchUsersFuzzy(
      query,
      user.id,
      limit,
    );

    const results = matches.map((match) => ({
      id: match.id,
      userId: match.user_id,
      username: match.username,
      avatarUrl: match.avatar_url,
      status: mapRelationship(
        user.id,
        match.friendship_status,
        match.requester_id,
        match.addressee_id,
      ),
      requestId: match.friendship_id ?? null,
      requesterId: match.requester_id ?? null,
      addresseeId: match.addressee_id ?? null,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Friend search error:", error);
    return NextResponse.json(
      { error: "Failed to search for friends" },
      { status: 500 },
    );
  }
}
