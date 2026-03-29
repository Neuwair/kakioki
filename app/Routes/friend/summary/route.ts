import { NextRequest, NextResponse } from "next/server";
import { FriendRepository } from "@/lib";
import type { DbUser, FriendSummaryEntry } from "@/lib/types/TypesLogic";
import { requireAuth } from "@/lib/Auth/AuthServer";

const friendRepository = new FriendRepository();

function sanitizeUser(user: DbUser) {
  return {
    id: user.id,
    user_id: user.user_id,
    username: user.username,
    avatar_url: user.avatar_url ?? null,
    public_key: user.public_key ?? null,
  };
}

function mapSummaryEntry(entry: FriendSummaryEntry) {
  return {
    user: sanitizeUser(entry.user),
    request: entry.request,
    threadPublicId: entry.threadPublicId ?? null,
    threadInternalId: entry.threadInternalId ?? null,
    blockedBySelf: entry.blockedBySelf ?? false,
    blockedSelfAt: entry.blockedSelfAt ?? null,
    blockedByFriend: entry.blockedByFriend ?? false,
    blockedFriendAt: entry.blockedFriendAt ?? null,
  };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const summary = await friendRepository.getFriendSummary(user.id);

    return NextResponse.json({
      success: true,
      friends: summary.friends.map(mapSummaryEntry),
      incoming: summary.incoming.map(mapSummaryEntry),
      outgoing: summary.outgoing.map(mapSummaryEntry),
    });
  } catch (error) {
    console.error("Friend summary error:", error);
    return NextResponse.json(
      { error: "Failed to load friend data" },
      { status: 500 },
    );
  }
}
