import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { FriendRepository, MessageRepository } from "@/lib";
import {
  publishChatControl,
  publishFriendEvent,
} from "@/lib/server/AblyServer";

const friendRepository = new FriendRepository();
const messageRepository = new MessageRepository();

type RemovePayload = {
  threadId?: string | null;
  targetUserId?: number;
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  let payload: RemovePayload;
  try {
    payload = (await request.json()) as RemovePayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  let targetUserId =
    typeof payload.targetUserId === "number" ? payload.targetUserId : null;
  let thread = payload.threadId
    ? await messageRepository.getThreadByPublicId(payload.threadId)
    : null;

  if (thread && thread.userAId !== user.id && thread.userBId !== user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  if (!targetUserId && thread) {
    targetUserId = thread.userAId === user.id ? thread.userBId : thread.userAId;
  }

  if (!targetUserId) {
    return NextResponse.json(
      { success: false, error: "Target user missing" },
      { status: 400 },
    );
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { success: false, error: "Invalid target" },
      { status: 400 },
    );
  }

  const isFriend = await friendRepository.hasAcceptedFriendship(
    user.id,
    targetUserId,
  );
  if (!isFriend) {
    return NextResponse.json(
      { success: false, error: "Users are not friends" },
      { status: 400 },
    );
  }

  const friendshipRemoved = await friendRepository.removeFriendship(
    user.id,
    targetUserId,
  );

  if (!thread) {
    thread = await messageRepository.findThreadByParticipants(
      user.id,
      targetUserId,
    );
  }

  if (!thread) {
    thread = await messageRepository.getOrCreateThread(user.id, targetUserId);
  }

  let removedThread = false;
  if (thread) {
    removedThread = await messageRepository.deleteThreadByPublicId(
      thread.threadId,
    );
  }

  if (thread) {
    await publishChatControl({
      type: "chat_removed",
      threadId: thread.threadId,
      initiatorId: user.id,
      targetId: targetUserId,
      createdAt: new Date().toISOString(),
    });
  }

  await publishFriendEvent({
    type: "friend_removed",
    initiatorId: user.id,
    targetId: targetUserId,
  });

  return NextResponse.json({
    success: true,
    removedFriendship: friendshipRemoved,
    removedThread,
    targetUserId,
    threadId: thread?.threadId ?? null,
  });
}
