import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MessageRepository } from "@/lib";
import { publishChatStatus } from "@/lib/server/AblyServer";
import type {
  MessageStatusMetadata,
  EncryptedMessageRecord,
} from "@/lib/media/MediaTypes";

const messageRepository = new MessageRepository();

type StatusPayload = {
  threadId: string;
  messageIds: string[];
  status: MessageStatusMetadata;
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  let payload: StatusPayload;
  try {
    payload = (await request.json()) as StatusPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  if (
    !payload?.threadId ||
    !Array.isArray(payload.messageIds) ||
    payload.messageIds.length === 0
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  const thread = await messageRepository.getThreadByPublicId(payload.threadId);
  if (!thread) {
    return NextResponse.json(
      { success: false, error: "Thread not found" },
      { status: 404 }
    );
  }

  if (thread.userAId !== user.id && thread.userBId !== user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const records: EncryptedMessageRecord[] = [];
  const limit = Math.min(payload.messageIds.length, 50);
  const statusUpdate: MessageStatusMetadata = { ...payload.status };
  const timestamp = new Date().toISOString();
  if (statusUpdate.delivery === "delivered" && !statusUpdate.deliveredAt) {
    statusUpdate.deliveredAt = timestamp;
  }
  if (statusUpdate.delivery === "read" && !statusUpdate.readAt) {
    statusUpdate.readAt = timestamp;
  }
  for (const messageId of payload.messageIds.slice(0, limit)) {
    if (typeof messageId !== "string" || messageId.trim().length === 0) {
      continue;
    }
    const record = await messageRepository.updateMessageStatusByClientId(
      messageId,
      statusUpdate
    );
    if (!record) {
      continue;
    }
    if (record.fromId !== user.id && record.toId !== user.id) {
      continue;
    }
    records.push(record);
    await publishChatStatus({
      type: "chat_status",
      threadId: payload.threadId,
      clientMessageId: record.clientMessageId,
      actorId: user.id,
      status: record.statusMetadata,
      createdAt: record.createdAt,
    });
  }

  return NextResponse.json({
    success: true,
    updated: records,
  });
}
