import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/Auth/AuthServer";
import { FriendRepository, MessageRepository } from "@/lib";
import { publishChatControl } from "@/lib/Realtime/AblyServer";

const friendRepository = new FriendRepository();
const messageRepository = new MessageRepository();

type NukePayload = {
  threadId?: string | null;
  targetUserId?: number;
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  let payload: NukePayload;
  try {
    payload = (await request.json()) as NukePayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 }
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
      { status: 403 }
    );
  }

  if (!targetUserId && thread) {
    targetUserId = thread.userAId === user.id ? thread.userBId : thread.userAId;
  }

  if (!targetUserId) {
    return NextResponse.json(
      { success: false, error: "Target user missing" },
      { status: 400 }
    );
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { success: false, error: "Invalid target" },
      { status: 400 }
    );
  }

  const isFriend = await friendRepository.hasAcceptedFriendship(
    user.id,
    targetUserId
  );
  if (!isFriend) {
    return NextResponse.json(
      { success: false, error: "Users are not friends" },
      { status: 400 }
    );
  }

  if (!thread) {
    thread = await messageRepository.findThreadByParticipants(user.id, targetUserId);
  }

  if (!thread) {
    return NextResponse.json(
      { success: false, error: "Thread not found" },
      { status: 404 }
    );
  }

  const deleted = await messageRepository.deleteMessagesByThreadPublicId(thread.threadId);

  await publishChatControl({
    type: "chat_cleared",
    threadId: thread.threadId,
    initiatorId: user.id,
    targetId: targetUserId,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    deleted,
    threadId: thread.threadId,
    targetUserId,
  });
}
