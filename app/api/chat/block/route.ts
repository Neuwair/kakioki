import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MessageRepository } from "@/lib";
import { publishChatControl } from "@/lib/server/AblyServer";

const messageRepository = new MessageRepository();

type BlockPayload = {
  threadId?: string | null;
  targetUserId?: number;
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  let payload: BlockPayload;
  try {
    payload = (await request.json()) as BlockPayload;
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
      { success: false, error: "Cannot block yourself" },
      { status: 400 }
    );
  }

  if (!thread) {
    thread = await messageRepository.getOrCreateThread(user.id, targetUserId);
  }

  await messageRepository.blockUser(user.id, targetUserId);

  await publishChatControl({
    type: "chat_block",
    threadId: thread.threadId,
    blockerId: user.id,
    blockedId: targetUserId,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    threadId: thread.threadId,
    blockerId: user.id,
    blockedId: targetUserId,
  });
}
