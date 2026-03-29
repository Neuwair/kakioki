import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/Auth/AuthServer";
import { MessageRepository, FriendRepository } from "@/lib";
import {
  publishChatMessage,
  publishChatNotification,
} from "@/lib/Realtime/AblyServer";
import type {
  MessageMetadata,
  MessageStatusMetadata,
} from "@/lib/types/TypesLogic";

const messageRepository = new MessageRepository();
const friendRepository = new FriendRepository();

type SendPayload = {
  threadId?: string | null;
  toUserId: number;
  clientMessageId: string;
  ciphertext: string;
  nonce: string;
  metadata?: MessageMetadata | null;
  status?: MessageStatusMetadata | null;
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  let payload: SendPayload;
  try {
    payload = (await request.json()) as SendPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (
    !payload.toUserId ||
    !payload.clientMessageId ||
    !payload.ciphertext ||
    !payload.nonce
  ) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  const targetUserId = Number(payload.toUserId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid recipient" },
      { status: 400 },
    );
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { success: false, error: "Cannot message yourself" },
      { status: 400 },
    );
  }

  let threadId = payload.threadId?.trim() || null;
  let thread = threadId
    ? await messageRepository.getThreadByPublicId(threadId)
    : null;
  const isNewThread = !thread;

  if (thread && thread.threadId !== threadId) {
    thread = null;
  }

  if (thread && thread.userAId !== user.id && thread.userBId !== user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  if (!thread) {
    thread = await messageRepository.getOrCreateThread(user.id, targetUserId);
    threadId = thread.threadId;
  }

  const otherUserId =
    thread.userAId === user.id ? thread.userBId : thread.userAId;
  if (otherUserId !== targetUserId) {
    return NextResponse.json(
      { success: false, error: "Recipient mismatch" },
      { status: 400 },
    );
  }

  const [isFriend, blockStatus] = await Promise.all([
    friendRepository.hasAcceptedFriendship(user.id, otherUserId),
    messageRepository.getBlockStatus(user.id, otherUserId),
  ]);

  if (!isFriend) {
    return NextResponse.json(
      { success: false, error: "Users are not friends" },
      { status: 403 },
    );
  }

  if (blockStatus.isBlocked) {
    return NextResponse.json(
      { success: false, error: "Messaging is blocked" },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const statusMetadata: MessageStatusMetadata = {
    delivery: "sent",
    sentAt: nowIso,
    ...((payload.status ?? {}) as MessageStatusMetadata),
  };

  const metadata: MessageMetadata | undefined = payload.metadata ?? undefined;

  const storedMessage = await messageRepository.storeEncryptedMessage({
    threadPublicId: thread.threadId,
    fromId: user.id,
    toId: otherUserId,
    clientMessageId: payload.clientMessageId,
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    metadata,
    statusMetadata,
  });

  await publishChatMessage({
    type: "chat_message",
    threadId: thread.threadId,
    clientMessageId: storedMessage.clientMessageId,
    fromId: user.id,
    toId: otherUserId,
    ciphertext: storedMessage.ciphertext,
    nonce: storedMessage.nonce,
    metadata: storedMessage.metadata,
    status: storedMessage.statusMetadata,
    createdAt: storedMessage.createdAt,
  });

  if (isNewThread) {
    await publishChatNotification(otherUserId, {
      type: "chat_thread_created",
      threadId: thread.threadId,
      fromId: user.id,
      createdAt: storedMessage.createdAt,
    });
  }

  return NextResponse.json({
    success: true,
    threadId: thread.threadId,
    message: storedMessage,
  });
}
