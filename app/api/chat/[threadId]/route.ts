import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MessageRepository, FriendRepository } from "@/lib";

const messageRepository = new MessageRepository();
const friendRepository = new FriendRepository();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const { threadId } = await context.params;
  if (!threadId) {
    return NextResponse.json(
      { success: false, error: "Thread id missing" },
      { status: 400 },
    );
  }

  const thread = await messageRepository.getThreadByPublicId(threadId);
  if (!thread) {
    return NextResponse.json(
      { success: false, error: "Thread not found" },
      { status: 404 },
    );
  }

  if (thread.userAId !== user.id && thread.userBId !== user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const otherUserId =
    thread.userAId === user.id ? thread.userBId : thread.userAId;
  const searchParams = request.nextUrl.searchParams;
  const limitParam = searchParams.get("limit");
  const afterParam = searchParams.get("after");
  const limit = limitParam ? Number(limitParam) : undefined;
  const after = afterParam && afterParam.trim().length > 0 ? afterParam : null;

  const [messages, blockStatus, isFriend] = await Promise.all([
    messageRepository.fetchThreadMessages({
      threadPublicId: thread.threadId,
      limit,
      after,
    }),
    messageRepository.getBlockStatus(user.id, otherUserId),
    friendRepository.hasAcceptedFriendship(user.id, otherUserId),
  ]);

  const blockedBySelf =
    blockStatus.isBlocked && blockStatus.blockedBy === user.id;
  const blockedByOther =
    blockStatus.isBlocked && blockStatus.blockedBy === otherUserId;

  return NextResponse.json({
    success: true,
    thread: {
      threadId: thread.threadId,
      participants: [thread.userAId, thread.userBId],
      isFriend,
      block: {
        isBlocked: blockStatus.isBlocked,
        blockedBySelf,
        blockedByOther,
        createdAt: blockStatus.recordCreatedAt ?? null,
      },
    },
    messages,
  });
}
