"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EncryptedMessageRecord } from "@/lib/media/MediaTypes";
import { useAuth } from "@/lib/auth/ClientAuth";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import { encryptTextWithSharedKey } from "@/public/shared/helpers/LibsodiumHelpers";
import { processMediaForMessage } from "@/public/shared/logic/MediaHandler";
import { getRealtimeClient } from "@/public/shared/services/AblyRealtime";
import {
  userChatNotificationChannel,
  type ChatNotificationEvent,
} from "@/lib/events/RealtimeEvents";
import {
  BlockState,
  ChatMessage,
  DecryptedMedia,
  SendMessageOptions,
  SendMessageResult,
  UseChatReturn,
  UseChatState,
} from "@/public/shared/chat/types/ChatTypes";
import { initialiseChatRealtime } from "@/public/shared/services/AblyRealtime";
import {
  convertDecryptedToUploaded,
  decryptRecord,
  encryptMediaItems,
  generateClientMessageId,
  useChatKeyManager,
} from "@/public/shared/chat/ChatEncryption";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";
import {
  blockFriendAction,
  fetchEncryptedMessage,
  loadChatHistory,
  removeFriendAction,
  unblockFriendAction,
} from "@/public/shared/chat/ChatActions";
import { cloneMetadata, mergeMessage } from "@/public/shared/chat/MessageUtils";

export type {
  BlockState,
  ChatMessage,
  DecryptedMedia,
  SendMessageOptions,
  SendMessageResult,
  UseChatReturn,
  UseChatState,
} from "@/public/shared/chat/types/ChatTypes";

interface SendMessageDeps {
  friend: FriendListEntry | null;
  userId: number | undefined;
  threadId: string | null;
  blockState: BlockState;
  ensureFriendPublicKey: () => Promise<string>;
  ensureSharedKey: () => Promise<Uint8Array>;
  getCachedSharedKey: (targetFriendId: number) => Uint8Array | null;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
}

async function executeSendMessage(
  deps: SendMessageDeps,
  text: string,
  options?: SendMessageOptions,
): Promise<SendMessageResult> {
  const {
    friend,
    userId,
    threadId,
    blockState,
    ensureFriendPublicKey,
    ensureSharedKey,
    getCachedSharedKey,
    setMessages,
    setIsSending,
    setThreadId,
  } = deps;

  if (!friend || !userId) {
    return { success: false, error: "Friend not selected" };
  }
  if (blockState.blockedBySelf || blockState.blockedByFriend) {
    return { success: false, error: "Messaging is blocked" };
  }
  try {
    await ensureFriendPublicKey();
  } catch (friendKeyError) {
    console.error("Friend public key unavailable:", friendKeyError);
    return { success: false, error: "Friend public key unavailable" };
  }
  const clientMessageId = options?.clientMessageId ?? generateClientMessageId();
  const createdAt = options?.createdAt ?? new Date().toISOString();
  try {
    const sharedKey = await ensureSharedKey();
    const metadata = cloneMetadata(options?.metadata);
    let decryptedMedia: DecryptedMedia[] = [];
    const attachments =
      options?.attachments && options.attachments.length > 0
        ? options.attachments
        : undefined;
    if (attachments) {
      const prepared = await encryptMediaItems(sharedKey, attachments);
      if (prepared.descriptors.length === 0) {
        throw new Error("Unable to prepare media attachments");
      }
      metadata.media = prepared.descriptors;
      decryptedMedia = prepared.decrypted;
    } else if (options?.mediaPreviews && options.mediaPreviews.length > 0) {
      const uploadedMedia = await processMediaForMessage(options.mediaPreviews);
      const prepared = await encryptMediaItems(sharedKey, uploadedMedia);
      if (prepared.descriptors.length === 0) {
        throw new Error("Unable to prepare media attachments");
      }
      metadata.media = prepared.descriptors;
      decryptedMedia = prepared.decrypted;
    }
    const { ciphertext, nonce } = await encryptTextWithSharedKey(
      sharedKey,
      text,
    );
    const optimistic: ChatMessage = {
      clientMessageId,
      senderId: userId,
      ciphertext,
      nonce,
      plaintext: text,
      metadata,
      media: decryptedMedia,
      status: {
        ...(options?.status ?? {}),
        delivery: "sending",
        sentAt: createdAt,
      },
      createdAt,
      state: "sending",
    };
    setMessages((prev) => mergeMessage(prev, optimistic));
    setIsSending(true);
    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        threadId,
        toUserId: friend.user.id,
        clientMessageId,
        ciphertext,
        nonce,
        metadata,
        status: options?.status ?? {},
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Failed to send message");
    }
    const stored = data.message as EncryptedMessageRecord;
    const storedThreadId = (data.threadId as string | undefined) ?? threadId;
    if (storedThreadId && storedThreadId !== threadId) {
      setThreadId(storedThreadId);
    }
    const shared = getCachedSharedKey(friend.user.id) ?? sharedKey;
    const finalized = await decryptRecord(stored, shared);
    setMessages((prev) => mergeMessage(prev, finalized));
    return { success: true, message: finalized };
  } catch (sendError) {
    console.error("Send message error:", sendError);
    setMessages((prev) =>
      prev.map((message) =>
        message.clientMessageId === clientMessageId
          ? {
              ...message,
              state: "error",
              error: (sendError as Error).message,
              status: {
                ...message.status,
                delivery: "failed",
                errorCode: (sendError as Error).name,
              },
            }
          : message,
      ),
    );
    return { success: false, error: (sendError as Error).message };
  } finally {
    setIsSending(false);
  }
}

function buildRetryOptions(
  message: ChatMessage,
): { text: string; options: SendMessageOptions } | null {
  if (!message.plaintext) {
    return null;
  }
  const attachments = convertDecryptedToUploaded(message.media);
  return {
    text: message.plaintext,
    options: {
      metadata: message.metadata,
      status: { ...message.status, delivery: "sending" },
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt,
      attachments,
    },
  };
}

async function markMessagesAsRead(
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

export function useChat({ friend }: UseChatState): UseChatReturn {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(
    friend?.threadId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [blockState, setBlockState] = useState<BlockState>({
    blockedBySelf: friend?.blockedBySelf ?? false,
    blockedByFriend: friend?.blockedByFriend ?? false,
    createdAt: friend?.blockCreatedAt ?? null,
  });
  const [isThreadPreparing, setIsThreadPreparing] = useState(false);

  const loadSequenceRef = useRef(0);
  const activeFriendIdRef = useRef<number | null>(friend?.user.id ?? null);
  const activeThreadIdRef = useRef<string | null>(friend?.threadId ?? null);
  const historyDecryptAbortRef = useRef<AbortController | null>(null);
  const realtimeDecryptAbortRef = useRef<AbortController | null>(null);
  const loadedThreadIdRef = useRef<string | null>(null);

  const keyManager = useChatKeyManager(user, friend);
  const {
    friendPublicKey,
    setFriendPublicKey,
    ensureSharedKey,
    ensureFriendPublicKey,
    getCachedSharedKey,
  } = keyManager;

  const resetState = useCallback(() => {
    setMessages([]);
    setError(null);
    setHasMore(true);
    setIsLoading(false);
    setIsThreadPreparing(false);
    loadSequenceRef.current += 1;
    loadedThreadIdRef.current = null;
    historyDecryptAbortRef.current?.abort();
    historyDecryptAbortRef.current = null;
    realtimeDecryptAbortRef.current?.abort();
    realtimeDecryptAbortRef.current = null;
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setThreadId(friend?.threadId ?? null);
      setBlockState({
        blockedBySelf: friend?.blockedBySelf ?? false,
        blockedByFriend: friend?.blockedByFriend ?? false,
        createdAt: friend?.blockCreatedAt ?? null,
      });
      resetState();
      setFriendPublicKey(friend?.user.publicKey ?? null);
      setIsThreadPreparing(!!friend?.threadId);
    });
  }, [
    friend?.user.id,
    friend?.user.publicKey,
    friend?.threadId,
    friend?.blockedBySelf,
    friend?.blockedByFriend,
    friend?.blockCreatedAt,
    resetState,
    setFriendPublicKey,
  ]);

  useEffect(() => {
    activeFriendIdRef.current = friend?.user.id ?? null;
  }, [friend?.user.id]);

  useEffect(() => {
    activeThreadIdRef.current = threadId ?? null;
  }, [threadId]);

  const loadHistory = useCallback(
    async (targetThreadId: string) => {
      await loadChatHistory(targetThreadId, {
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
      });
    },
    [ensureSharedKey, friend],
  );

  useEffect(() => {
    if (!friend || !threadId) {
      queueMicrotask(() => {
        setIsLoading(false);
        setIsThreadPreparing(false);
      });
      return;
    }
    if (loadedThreadIdRef.current === threadId) {
      return;
    }
    const resolvedFriendKey = friend.user.publicKey ?? friendPublicKey;
    if (!resolvedFriendKey) {
      return;
    }
    loadedThreadIdRef.current = threadId;
    loadHistory(threadId);
  }, [friend, friendPublicKey, threadId, loadHistory]);

  useEffect(() => {
    if (!user?.id || !friend || threadId) {
      return undefined;
    }
    let isActive = true;
    type AblyChannel = {
      subscribe: (listener: (msg: { data: unknown }) => void) => void;
      unsubscribe: (listener: (msg: { data: unknown }) => void) => void;
    };
    let channel: AblyChannel | null = null;
    let listener: ((msg: { data: unknown }) => void) | null = null;
    const subscribe = async () => {
      const client = await getRealtimeClient();
      if (!isActive) return;
      channel = client.channels.get(
        userChatNotificationChannel(user.id),
      ) as unknown as AblyChannel;
      listener = (message) => {
        const payload = message.data as ChatNotificationEvent | undefined;
        if (
          payload?.type === "chat_thread_created" &&
          payload.fromId === friend.user.id &&
          payload.threadId
        ) {
          setThreadId(payload.threadId);
        }
      };
      channel.subscribe(listener);
    };
    void subscribe();
    return () => {
      isActive = false;
      if (channel && listener) {
        try {
          channel.unsubscribe(listener);
        } catch {}
      }
    };
  }, [user?.id, friend, threadId]);

  const updateBlockState = useCallback((update: Partial<BlockState>) => {
    setBlockState((prev) => ({
      blockedBySelf: update.blockedBySelf ?? prev.blockedBySelf,
      blockedByFriend: update.blockedByFriend ?? prev.blockedByFriend,
      createdAt: update.createdAt ?? prev.createdAt,
    }));
  }, []);

  useEffect(() => {
    if (!threadId || !friend || !user?.id) {
      return undefined;
    }
    const resolvedFriendKey = friend.user.publicKey ?? friendPublicKey;
    if (!resolvedFriendKey) {
      return undefined;
    }
    const cleanup = initialiseChatRealtime({
      threadId,
      friend,
      userId: user.id,
      ensureSharedKey,
      fetchEncryptedMessage,
      updateBlockState,
      resetState,
      setThreadId,
      setError,
      setMessages,
      realtimeDecryptAbortRef,
      historyDecryptAbortRef,
    });
    return cleanup;
  }, [
    threadId,
    friend,
    friendPublicKey,
    user?.id,
    ensureSharedKey,
    updateBlockState,
    resetState,
    setThreadId,
    setError,
    setMessages,
  ]);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: SendMessageOptions,
    ): Promise<SendMessageResult> => {
      return executeSendMessage(
        {
          friend,
          userId: user?.id,
          threadId,
          blockState,
          ensureFriendPublicKey,
          ensureSharedKey,
          getCachedSharedKey,
          setMessages,
          setIsSending,
          setThreadId,
        },
        text,
        options,
      );
    },
    [
      blockState,
      ensureFriendPublicKey,
      ensureSharedKey,
      friend,
      getCachedSharedKey,
      threadId,
      user?.id,
    ],
  );

  const retryMessage = useCallback(
    async (clientMessageId: string): Promise<SendMessageResult> => {
      const message = messages.find(
        (item) => item.clientMessageId === clientMessageId,
      );
      if (!message) {
        return { success: false, error: "Message not found" };
      }
      const retryData = buildRetryOptions(message);
      if (!retryData) {
        return { success: false, error: "Message not found" };
      }
      setMessages((prev) =>
        prev.map((item) =>
          item.clientMessageId === clientMessageId
            ? { ...item, state: "sending", error: undefined }
            : item,
        ),
      );
      return sendMessage(retryData.text, retryData.options);
    },
    [messages, sendMessage],
  );

  const markAsRead = useCallback(
    async (clientMessageIds: string[]) => {
      await markMessagesAsRead(threadId, clientMessageIds, setMessages);
    },
    [threadId],
  );

  const nukeMessages = useCallback(async (): Promise<boolean> => {
    if (!friend || !threadId || !user?.id) {
      return false;
    }
    try {
      const response = await fetch("/api/chat/nuke", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          threadId,
          targetUserId: friend.user.id,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to nuke messages");
      }
      setMessages([]);
      return true;
    } catch (error) {
      console.error("Nuke messages error:", error);
      return false;
    }
  }, [friend, threadId, user?.id]);

  const actionDeps = useMemo(
    () => ({
      friend,
      threadId,
      setThreadId,
      setMessages,
      updateBlockState,
    }),
    [friend, threadId, updateBlockState],
  );

  const blockFriend = useCallback(
    async () => blockFriendAction(actionDeps),
    [actionDeps],
  );

  const unblockFriend = useCallback(
    async () => unblockFriendAction(actionDeps),
    [actionDeps],
  );

  const removeFriend = useCallback(
    async () => removeFriendAction(actionDeps),
    [actionDeps],
  );

  const loadLatest = useCallback(async () => {
    if (threadId) {
      await loadHistory(threadId);
    }
  }, [loadHistory, threadId]);

  const isBlocked = useMemo(
    () => blockState.blockedBySelf || blockState.blockedByFriend,
    [blockState.blockedByFriend, blockState.blockedBySelf],
  );

  return {
    threadId,
    messages,
    isLoading,
    isPreparing: isThreadPreparing,
    isSending,
    hasMore,
    isBlocked,
    blockState,
    error,
    sendMessage,
    retryMessage,
    markAsRead,
    blockFriend,
    unblockFriend,
    removeFriend,
    nukeMessages,
    loadLatest,
  };
}
