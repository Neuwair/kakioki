import type { EncryptedMessageRecord } from "@/lib/media/MediaTypes";
import { decryptRecord } from "@/public/shared/chat/ChatEncryption";
import { sortMessages } from "@/public/shared/chat/MessageUtils";
import type {
  BlockState,
  ChatMessage,
} from "@/public/shared/chat/types/ChatTypes";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";

const MESSAGE_PAGE_SIZE = 50;

type WritableRefObject<T> = React.RefObject<T> & { current: T };

interface ChatActionDeps {
  friend: FriendListEntry | null;
  threadId: string | null;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  updateBlockState: (update: Partial<BlockState>) => void;
}

interface LoadHistoryDeps {
  friend: FriendListEntry | null;
  loadSequenceRef: WritableRefObject<number>;
  activeFriendIdRef: WritableRefObject<number | null>;
  activeThreadIdRef: WritableRefObject<string | null>;
  historyDecryptAbortRef: WritableRefObject<AbortController | null>;
  ensureSharedKey: () => Promise<Uint8Array>;
  setIsThreadPreparing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setBlockState: React.Dispatch<React.SetStateAction<BlockState>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
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
  const { friend, threadId, setMessages } = deps;
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
    return true;
  } catch (removeError) {
    console.error("Remove friend error:", removeError);
    return false;
  }
}

export async function fetchEncryptedMessage(
  targetThreadId: string,
  clientMessageId: string,
): Promise<EncryptedMessageRecord | null> {
  try {
    const params = new URLSearchParams({
      threadId: targetThreadId,
      clientMessageId,
    });
    const response = await fetch(`/api/chat/message?${params.toString()}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Encrypted message fetch failed", {
        status: response.status,
        error: (errorData as { error?: string })?.error,
      });
      return null;
    }
    const data = await response.json().catch(() => ({}));
    return (
      (data as { message?: EncryptedMessageRecord | null })?.message ?? null
    );
  } catch (error) {
    console.error("Encrypted message fetch error", error);
    return null;
  }
}

export async function loadChatHistory(
  targetThreadId: string,
  deps: LoadHistoryDeps,
): Promise<void> {
  const {
    friend,
    loadSequenceRef,
    activeFriendIdRef,
    activeThreadIdRef,
    historyDecryptAbortRef,
    ensureSharedKey,
    setIsThreadPreparing,
    setIsLoading,
    setMessages,
    setHasMore,
    setThreadId,
    setBlockState,
    setError,
  } = deps;

  const currentFriend = friend;
  if (!currentFriend) {
    return;
  }
  const requestFriendId = currentFriend.user.id;
  if (!requestFriendId) {
    return;
  }
  const requestId = loadSequenceRef.current + 1;
  loadSequenceRef.current = requestId;
  let expectedThreadId = targetThreadId;
  const isStale = () =>
    loadSequenceRef.current !== requestId ||
    activeFriendIdRef.current !== requestFriendId ||
    (activeThreadIdRef.current !== null &&
      activeThreadIdRef.current !== expectedThreadId);
  const aborter = new AbortController();
  historyDecryptAbortRef.current?.abort();
  historyDecryptAbortRef.current = aborter;
  setIsThreadPreparing(true);
  setIsLoading(true);
  try {
    const response = await fetch(`/api/chat/${targetThreadId}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    const responseData = await response.json().catch(() => ({}));
    if (aborter.signal.aborted || isStale()) {
      return;
    }
    if (!response.ok) {
      throw new Error(
        (responseData as { error?: string })?.error ||
          `Failed to load chat (${response.status})`,
      );
    }
    const data = responseData;
    const encryptedMessages = (data?.messages ??
      []) as EncryptedMessageRecord[];
    const sharedKey = await ensureSharedKey();
    if (aborter.signal.aborted || isStale()) {
      return;
    }
    const decryptedMessages = await Promise.all(
      encryptedMessages.map((record) => decryptRecord(record, sharedKey)),
    );
    if (aborter.signal.aborted || isStale()) {
      return;
    }
    setMessages(sortMessages(decryptedMessages));
    setHasMore(encryptedMessages.length >= MESSAGE_PAGE_SIZE);
    const nextThreadId =
      (data?.thread?.threadId as string | undefined) ?? targetThreadId;
    expectedThreadId = nextThreadId ?? targetThreadId;
    if (aborter.signal.aborted || isStale()) {
      return;
    }
    setThreadId(nextThreadId);
    if (data?.thread?.block) {
      if (aborter.signal.aborted || isStale()) {
        return;
      }
      setBlockState({
        blockedBySelf: !!data.thread.block.blockedBySelf,
        blockedByFriend: !!data.thread.block.blockedByOther,
        createdAt: data.thread.block.createdAt ?? null,
      });
    }
  } catch (fetchError) {
    console.error("Chat history fetch error:", fetchError);
    if (!aborter.signal.aborted && !isStale()) {
      setError("Unable to load conversation");
    }
  } finally {
    if (historyDecryptAbortRef.current === aborter) {
      historyDecryptAbortRef.current = null;
    }
    if (!aborter.signal.aborted && !isStale()) {
      setIsLoading(false);
      setIsThreadPreparing(false);
    }
  }
}
