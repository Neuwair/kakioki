import { startTransition } from "react";
import { getRealtimeClient } from "@/public/shared/Realtime/ablyClient";
import {
  chatMessageChannel,
  chatStatusChannel,
  chatControlChannel,
} from "@/lib/Realtime/ChatEvents";
import type {
  ChatMessageEvent,
  ChatStatusEvent,
  ChatControlEvent,
} from "@/lib/Realtime/ChatEvents";
import type { EncryptedMessageRecord } from "@/lib/types/TypesLogic";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";
import { decryptRecord } from "@/public/shared/hooks/chatEncryption";
import {
  applyStatusToMessage,
  mergeMessage,
} from "@/public/shared/hooks/chatUtils";
import type {
  BlockState,
  ChatMessage,
  MessageRecordInput,
} from "@/public/shared/hooks/chatTypes";

type AblyMessage = {
  name?: string;
  data: unknown;
};

type AblyChannel = {
  subscribe: (listener: (message: AblyMessage) => void) => void;
  unsubscribe: (listener: (message: AblyMessage) => void) => void;
};

interface ChatRealtimeParams {
  threadId: string;
  friend: FriendListEntry;
  userId: number;
  ensureSharedKey: () => Promise<Uint8Array>;
  fetchEncryptedMessage: (
    targetThreadId: string,
    clientMessageId: string,
  ) => Promise<EncryptedMessageRecord | null>;
  updateBlockState: (update: Partial<BlockState>) => void;
  resetState: () => void;
  setThreadId: (value: string | null) => void;
  setError: (value: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  realtimeDecryptAbortRef: React.MutableRefObject<AbortController | null>;
  historyDecryptAbortRef: React.MutableRefObject<AbortController | null>;
}

export function initialiseChatRealtime({
  threadId,
  friend,
  userId,
  ensureSharedKey,
  fetchEncryptedMessage,
  updateBlockState,
  resetState,
  setThreadId,
  setError,
  setMessages,
  realtimeDecryptAbortRef,
  historyDecryptAbortRef,
}: ChatRealtimeParams): () => void {
  let isActive = true;
  let clearErrorTimer: ReturnType<typeof setTimeout> | null = null;
  const subscriptions: Array<{
    channel: AblyChannel;
    listener: (message: AblyMessage) => void;
  }> = [];

  const subscribe = async () => {
    try {
      const client = await getRealtimeClient();
      if (!isActive) {
        return;
      }
      const messageChannel = client.channels.get(
        chatMessageChannel(threadId),
      ) as unknown as AblyChannel;
      const statusChannel = client.channels.get(
        chatStatusChannel(threadId),
      ) as unknown as AblyChannel;
      const controlChannel = client.channels.get(
        chatControlChannel(threadId),
      ) as unknown as AblyChannel;

      const handleMessage = (message: AblyMessage) => {
        const payload = message.data as ChatMessageEvent | undefined;
        if (
          !payload ||
          payload.type !== "chat_message" ||
          payload.threadId !== threadId
        ) {
          return;
        }
        void (async () => {
          const aborter = new AbortController();
          const previousAborter = realtimeDecryptAbortRef.current;
          realtimeDecryptAbortRef.current = aborter;
          previousAborter?.abort();
          try {
            const needsFetch = payload.hasFullMetadata === false;
            let record: MessageRecordInput | null = null;
            if (needsFetch) {
              const stored = await fetchEncryptedMessage(
                payload.threadId,
                payload.clientMessageId,
              );
              if (!stored) {
                return;
              }
              record = {
                id: stored.id,
                clientMessageId: stored.clientMessageId,
                fromId: stored.fromId,
                toId: stored.toId,
                ciphertext: stored.ciphertext,
                nonce: stored.nonce,
                metadata: stored.metadata,
                statusMetadata: stored.statusMetadata,
                status: stored.statusMetadata,
                createdAt: stored.createdAt,
              };
            } else {
              record = {
                clientMessageId: payload.clientMessageId,
                fromId: payload.fromId,
                toId: payload.toId,
                ciphertext: payload.ciphertext,
                nonce: payload.nonce,
                metadata: payload.metadata ?? {},
                status: payload.status ?? {},
                createdAt: payload.createdAt,
              };
            }

            if (!record) {
              return;
            }

            const sharedKey = await ensureSharedKey();
            if (aborter.signal.aborted) {
              return;
            }
            if (!isActive) {
              return;
            }
            const decrypted = await decryptRecord(record, sharedKey);
            if (aborter.signal.aborted) {
              return;
            }
            if (!isActive) {
              return;
            }
            startTransition(() => {
              setMessages((prev) => mergeMessage(prev, decrypted));
            });
          } catch (err) {
            console.error("Realtime message decrypt error:", err);
          } finally {
            if (realtimeDecryptAbortRef.current === aborter) {
              realtimeDecryptAbortRef.current = null;
            }
          }
        })();
      };

      const handleStatus = (message: AblyMessage) => {
        const payload = message.data as ChatStatusEvent | undefined;
        if (
          !payload ||
          payload.type !== "chat_status" ||
          payload.threadId !== threadId
        ) {
          return;
        }
        startTransition(() => {
          setMessages((prev) =>
            prev.map((entry) => {
              if (entry.clientMessageId !== payload.clientMessageId) {
                return entry;
              }
              const nextStatus = { ...entry.status, ...payload.status };
              const nextState = applyStatusToMessage({
                ...entry,
                status: nextStatus,
              });
              return { ...entry, status: nextStatus, state: nextState };
            }),
          );
        });
      };

      const handleControl = (message: AblyMessage) => {
        const payload = message.data as ChatControlEvent | undefined;
        if (!payload || payload.threadId !== threadId) {
          return;
        }
        if (payload.type === "chat_block") {
          if (
            payload.blockerId === userId &&
            payload.blockedId === friend.user.id
          ) {
            updateBlockState({
              blockedBySelf: true,
              createdAt: payload.createdAt,
            });
          } else if (
            payload.blockerId === friend.user.id &&
            payload.blockedId === userId
          ) {
            updateBlockState({
              blockedByFriend: true,
              createdAt: payload.createdAt,
            });
          }
        } else if (payload.type === "chat_unblock") {
          if (
            payload.blockerId === userId &&
            payload.blockedId === friend.user.id
          ) {
            updateBlockState({ blockedBySelf: false, createdAt: null });
          } else if (
            payload.blockerId === friend.user.id &&
            payload.blockedId === userId
          ) {
            updateBlockState({ blockedByFriend: false, createdAt: null });
          }
        } else if (payload.type === "chat_removed") {
          if (payload.threadId === threadId) {
            resetState();
            setThreadId(null);
            if (payload.initiatorId !== userId) {
              setError("Friend removed the conversation");
            } else {
              setError("Conversation removed");
            }
          }
        } else if (payload.type === "chat_cleared") {
          if (payload.threadId === threadId) {
            setMessages([]);
            setError("Conversation messages cleared");
            if (clearErrorTimer) {
              clearTimeout(clearErrorTimer);
            }
            clearErrorTimer = setTimeout(() => {
              setError(null);
              clearErrorTimer = null;
            }, 5000);
          }
        }
      };

      messageChannel.subscribe(handleMessage);
      statusChannel.subscribe(handleStatus);
      controlChannel.subscribe(handleControl);
      subscriptions.push({
        channel: messageChannel,
        listener: handleMessage,
      });
      subscriptions.push({ channel: statusChannel, listener: handleStatus });
      subscriptions.push({ channel: controlChannel, listener: handleControl });
    } catch (subscriptionError) {
      console.error("Realtime subscription error:", subscriptionError);
    }
  };

  void subscribe();

  return () => {
    isActive = false;
    if (clearErrorTimer) {
      clearTimeout(clearErrorTimer);
      clearErrorTimer = null;
    }
    historyDecryptAbortRef.current?.abort();
    historyDecryptAbortRef.current = null;
    realtimeDecryptAbortRef.current?.abort();
    realtimeDecryptAbortRef.current = null;
    subscriptions.forEach(({ channel, listener }) => {
      try {
        channel.unsubscribe(listener);
      } catch (unsubscribeError) {
        console.error("Realtime unsubscribe error:", unsubscribeError);
      }
    });
  };
}
