import { NextRequest, NextResponse } from "next/server";
import { FriendRepository, UserRepository, MessageRepository } from "@/lib";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { DatabaseError } from "@/lib/database/InitializeDB";
import { publishFriendEvent } from "@/lib/server/AblyServer";
import type { FriendUserPayload } from "@/lib/events/RealtimeEvents";

const friendRepository = new FriendRepository();
const userRepository = new UserRepository();
const messageRepository = new MessageRepository();

function toFriendUserPayload(user: {
  id: number;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  public_key?: string | null;
}): FriendUserPayload {
  return {
    id: user.id,
    user_id: user.user_id,
    username: user.username,
    avatar_url: user.avatar_url ?? undefined,
    public_key: user.public_key ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body = await request.json();
    const toUserId = body?.toUserId;
    if (typeof toUserId !== "number") {
      return NextResponse.json({ error: "Invalid toUserId" }, { status: 400 });
    }

    const targetUser = await userRepository.findById(toUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requestRecord = await friendRepository.sendFriendRequest(
      user.id,
      toUserId
    );
    const currentUserFull = await userRepository.findById(user.id);

    if (!currentUserFull) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await publishFriendEvent({
      type: "friend_request_sent",
      request: requestRecord,
      fromUser: toFriendUserPayload(currentUserFull),
      toUser: toFriendUserPayload(targetUser),
    });

    return NextResponse.json({ success: true, request: requestRecord });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Friend request send error:", error);
    return NextResponse.json(
      { error: "Failed to send friend request" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body = await request.json();
    const toUserId = body?.toUserId;
    const fromUserId = body?.fromUserId;

    if (typeof toUserId === "number") {
      const cancelled = await friendRepository.cancelFriendRequest(
        user.id,
        toUserId
      );

      if (!cancelled) {
        return NextResponse.json(
          { error: "No pending request" },
          { status: 404 }
        );
      }

      await publishFriendEvent({
        type: "friend_request_cancelled",
        fromUserId: user.id,
        toUserId,
      });

      return NextResponse.json({ success: true });
    }

    if (typeof fromUserId === "number") {
      const declined = await friendRepository.declineFriendRequest(
        fromUserId,
        user.id
      );

      if (!declined) {
        return NextResponse.json(
          { error: "No pending request" },
          { status: 404 }
        );
      }

      await publishFriendEvent({
        type: "friend_request_cancelled",
        fromUserId,
        toUserId: user.id,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Friend request cancel error:", error);
    return NextResponse.json(
      { error: "Failed to cancel friend request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body = await request.json();
    const fromUserId = body?.fromUserId;
    if (typeof fromUserId !== "number") {
      return NextResponse.json(
        { error: "Invalid fromUserId" },
        { status: 400 }
      );
    }

    const accepted = await friendRepository.acceptFriendRequest(
      fromUserId,
      user.id
    );

    if (!accepted) {
      return NextResponse.json(
        { error: "No pending request" },
        { status: 404 }
      );
    }

    const fromUser = await userRepository.findById(fromUserId);
    const currentUserFull = await userRepository.findById(user.id);

    if (!fromUser || !currentUserFull) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const blockStatus = await messageRepository.getBlockStatus(user.id, fromUserId);
    const blockedBySelf = blockStatus.isBlocked && blockStatus.blockedBy === user.id;
    const blockedByFriend = blockStatus.isBlocked && blockStatus.blockedBy === fromUserId;

    await publishFriendEvent({
      type: "friend_request_accepted",
      request: accepted,
      fromUser: toFriendUserPayload(fromUser),
      toUser: toFriendUserPayload(currentUserFull),
      blockedBySelf,
      blockedByFriend,
      blockCreatedAt: blockStatus.recordCreatedAt ?? null,
    });

    return NextResponse.json({ success: true, request: accepted });
  } catch (error) {
    console.error("Friend request accept error:", error);
    return NextResponse.json(
      { error: "Failed to accept friend request" },
      { status: 500 }
    );
  }
}
