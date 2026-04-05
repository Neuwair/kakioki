import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { MessageRepository } from "@/lib";

const messageRepository = new MessageRepository();

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  const clientMessageId = searchParams.get("clientMessageId");

  if (!threadId || !clientMessageId) {
    return NextResponse.json(
      { success: false, error: "Missing threadId or clientMessageId" },
      { status: 400 },
    );
  }

  const participants = await messageRepository.getThreadParticipants(threadId);
  if (
    !participants ||
    (participants.userAId !== user.id && participants.userBId !== user.id)
  ) {
    return NextResponse.json(
      { success: false, error: "Thread not found" },
      { status: 404 },
    );
  }

  const message = await messageRepository.getMessageByClientId(
    threadId,
    clientMessageId,
  );
  if (!message) {
    return NextResponse.json(
      { success: false, error: "Message not found" },
      { status: 404 },
    );
  }

  if (message.fromId !== user.id && message.toId !== user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true, message });
}
