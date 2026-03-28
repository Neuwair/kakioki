import { getAuthHeaders } from "@/public/shared/Helpers/AuthHelpers";
import type { BlockState, ChatMessage } from "@/public/shared/hooks/chatTypes";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

interface ChatActionDeps {
  friend: FriendListEntry | null;
  threadId: string | null;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  updateBlockState: (update: Partial<BlockState>) => void;
}

export async function blockFriendAction(
  deps: ChatActionDeps,
): Promise<boolean> {
  const { friend, threadId, setThreadId, updateBlockState } = deps;
  if (!friend) {
    return false;
  }
  try {
    const response = await fetch("/api/chat/block", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        threadId,
        targetUserId: friend.user.id,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Block failed");
    }
    if (data.threadId && data.threadId !== threadId) {
      setThreadId(data.threadId as string);
    }
    updateBlockState({
      blockedBySelf: true,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (blockError) {
    console.error("Block friend error:", blockError);
    return false;
  }
}

export async function unblockFriendAction(
  deps: ChatActionDeps,
): Promise<boolean> {
  const { friend, threadId, setThreadId, updateBlockState } = deps;
  if (!friend) {
    return false;
  }
  try {
    const response = await fetch("/api/chat/unblock", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        threadId,
        targetUserId: friend.user.id,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Unblock failed");
    }
    if (data.threadId && data.threadId !== threadId) {
      setThreadId(data.threadId as string);
    }
    updateBlockState({ blockedBySelf: false, createdAt: null });
    return true;
  } catch (unblockError) {
    console.error("Unblock friend error:", unblockError);
    return false;
  }
}

export async function removeFriendAction(
  deps: ChatActionDeps,
): Promise<boolean> {
  const { friend, threadId, setMessages, updateBlockState } = deps;
  if (!friend) {
    return false;
  }
  try {
    const response = await fetch("/api/chat/remove", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        threadId,
        targetUserId: friend.user.id,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Remove friend failed");
    }
    setMessages([]);
    updateBlockState({
      blockedBySelf: false,
      blockedByFriend: false,
      createdAt: null,
    });
    return true;
  } catch (removeError) {
    console.error("Remove friend error:", removeError);
    return false;
  }
}
