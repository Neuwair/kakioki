import { getAuthHeaders } from "@/public/shared/Helpers/AuthHelpers";
import type { ChatMessage } from "@/public/shared/hooks/chatTypes";

export async function markMessagesAsRead(
  threadId: string | null,
  clientMessageIds: string[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): Promise<void> {
  if (!threadId || clientMessageIds.length === 0) {
    return;
  }
  try {
    await fetch("/api/chat/status", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        threadId,
        messageIds: clientMessageIds,
        status: { delivery: "read" },
      }),
    });
    setMessages((prev) =>
      prev.map((message) =>
        clientMessageIds.includes(message.clientMessageId)
          ? {
              ...message,
              status: {
                ...message.status,
                delivery: "read",
                readAt: new Date().toISOString(),
              },
              state: "read",
            }
          : message,
      ),
    );
  } catch (statusError) {
    console.error("Mark as read error:", statusError);
  }
}
