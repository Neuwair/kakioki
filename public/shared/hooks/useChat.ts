"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/context/AuthClientUI";
import {
  BlockState,
  ChatMessage,
  SendMessageOptions,
  SendMessageResult,
  UseChatReturn,
  UseChatState,
} from "@/public/shared/hooks/chatTypes";
import { initialiseChatRealtime } from "@/public/shared/hooks/chatRealtime";
import { useChatKeyManager } from "@/public/shared/hooks/chatKeyManager";
import {
  blockFriendAction,
  unblockFriendAction,
  removeFriendAction,
} from "@/public/shared/hooks/chatActions";
import {
  executeSendMessage,
  buildRetryOptions,
} from "@/public/shared/hooks/chatSend";
import { markMessagesAsRead } from "@/public/shared/hooks/chatStatus";
import {
  fetchEncryptedMessage,
  loadChatHistory,
} from "@/public/shared/hooks/chatHistory";

export type {
  BlockState,
  ChatMessage,
  DecryptedMedia,
  SendMessageOptions,
  SendMessageResult,
  UseChatReturn,
  UseChatState,
} from "@/public/shared/hooks/chatTypes";

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
    if (friend.threadId !== threadId) {
      return;
    }
    const resolvedFriendKey = friend.user.publicKey ?? friendPublicKey;
    if (!resolvedFriendKey) {
      return;
    }
    loadHistory(threadId);
  }, [friend, friendPublicKey, threadId, loadHistory]);

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
    loadLatest,
  };
}
