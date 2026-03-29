import type { EncryptedMessageRecord } from "@/lib/types/TypesLogic";
import { getAuthHeaders } from "@/public/shared/Helpers/AuthHelpers";
import { decryptRecord } from "@/public/shared/hooks/chatEncryption";
import { sortMessages } from "@/public/shared/hooks/chatUtils";
import type { BlockState, ChatMessage } from "@/public/shared/hooks/chatTypes";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

const MESSAGE_PAGE_SIZE = 50;

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

interface LoadHistoryDeps {
  friend: FriendListEntry | null;
  loadSequenceRef: React.MutableRefObject<number>;
  activeFriendIdRef: React.MutableRefObject<number | null>;
  activeThreadIdRef: React.MutableRefObject<string | null>;
  historyDecryptAbortRef: React.MutableRefObject<AbortController | null>;
  ensureSharedKey: () => Promise<Uint8Array>;
  setIsThreadPreparing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setBlockState: React.Dispatch<React.SetStateAction<BlockState>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
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
