import Ably from "ably";
import { startTransition } from "react";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { getTabSessionId, sessionKey } from "@/public/shared/helpers/TabSessionHelpers";
import {
  chatMessageChannel,
  chatStatusChannel,
  chatControlChannel,
} from "@/lib/events/RealtimeEvents";
import type {
  ChatMessageEvent,
  ChatStatusEvent,
  ChatControlEvent,
} from "@/lib/events/RealtimeEvents";
import type { EncryptedMessageRecord } from "@/lib/media/MediaTypes";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";
import { decryptRecord } from "@/public/shared/chat/ChatEncryption";
import {
  applyStatusToMessage,
  mergeMessage,
} from "@/public/shared/chat/MessageUtils";
import type {
  BlockState,
  ChatMessage,
  MessageRecordInput,
} from "@/public/shared/chat/types/ChatTypes";

type AblyMessage = {
  name?: string;
  data: unknown;
};

type AblyChannel = {
  subscribe: (listener: (message: AblyMessage) => void) => void;
  unsubscribe: (listener: (message: AblyMessage) => void) => void;
};

type RealtimeClient = InstanceType<typeof Ably.Realtime>;

let realtimeClient: RealtimeClient | null = null;
let creatingClientPromise: Promise<RealtimeClient> | null = null;
let isRealtimeClosing = false;
let clientTabSession: string | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: unknown } | null | undefined;
    const msg =
      typeof reason?.message === "string"
        ? reason.message
        : String(reason ?? "");
    if (/Connection (closed|failed)/i.test(msg)) {
      event.preventDefault();
    }
  });
}

function resetRealtimeSingletons() {
  realtimeClient = null;
  creatingClientPromise = null;
  isRealtimeClosing = false;
  clientTabSession = null;
}

async function createRealtimeClient(): Promise<RealtimeClient> {
  if (isRealtimeClosing) {
    throw new Error("Realtime client is closing");
  }

  const currentTabSession =
    typeof window !== "undefined" ? getTabSessionId() : "";

  if (realtimeClient) {
    const state = realtimeClient.connection.state;
    if (
      state === "closed" ||
      state === "failed" ||
      clientTabSession !== currentTabSession
    ) {
      resetRealtimeSingletons();
    } else {
      return realtimeClient;
    }
  }

  if (
    typeof window !== "undefined" &&
    !sessionStorage.getItem(sessionKey("token"))
  ) {
    throw new Error("Realtime client requires authentication");
  }

  if (!creatingClientPromise) {
    creatingClientPromise = (async () => {
      const client = new Ably.Realtime({
        authCallback: (
          _tokenParams: Ably.TokenParams,
          callback: (
            error: Ably.ErrorInfo | string | null,
            tokenRequestOrDetails:
              | Ably.TokenRequest
              | Ably.TokenDetails
              | string
              | null,
          ) => void,
        ) => {
          fetch("/api/security", {
            method: "POST",
            headers: getAuthHeaders(),
          })
            .then((res) => {
              if (!res.ok) {
                callback(`Ably auth failed: ${res.status}`, null);
                return;
              }
              return res.json();
            })
            .then((tokenRequest) => {
              if (tokenRequest) {
                callback(null, tokenRequest as Ably.TokenRequest);
              }
            })
            .catch((err: unknown) => {
              callback(
                err instanceof Error ? err.message : String(err ?? ""),
                null,
              );
            });
        },
        closeOnUnload: false,
      });
      client.connection.once("closed", resetRealtimeSingletons);
      client.connection.once("failed", resetRealtimeSingletons);
      clientTabSession = currentTabSession;
      realtimeClient = client;
      return client;
    })();
  }

  return creatingClientPromise;
}

export async function getRealtimeClient(): Promise<RealtimeClient> {
  return createRealtimeClient();
}

export function closeRealtimeClient(): void {
  if (isRealtimeClosing) return;
  isRealtimeClosing = true;
  creatingClientPromise = null;
  if (realtimeClient) {
    try {
      realtimeClient.close();
    } catch {
      resetRealtimeSingletons();
    }
  } else {
    resetRealtimeSingletons();
  }
}

export function isRealtimeClientClosing(): boolean {
  return isRealtimeClosing;
}

export async function reauthorizeRealtimeClient(): Promise<void> {
  if (!realtimeClient) return;
  const state = realtimeClient.connection.state;
  if (state === "closed" || state === "failed") return;
  await realtimeClient.auth.authorize();
  if (realtimeClient.connection.state !== "connected") {
    await new Promise<void>((resolve) => {
      const TIMEOUT_MS = KAKIOKI_CONFIG.transport.realtimeReauthTimeoutMs;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      realtimeClient!.connection.once("connected", finish);
      setTimeout(finish, TIMEOUT_MS);
    });
  }
}

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
  realtimeDecryptAbortRef: { current: AbortController | null };
  historyDecryptAbortRef: { current: AbortController | null };
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
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const subscriptions: Array<{
    channel: AblyChannel;
    listener: (message: AblyMessage) => void;
  }> = [];

  const scheduleRetry = () => {
    if (!isActive || retryTimer) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void subscribe();
    }, 2000);
  };

  async function subscribe(): Promise<void> {
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
        if (
          (payload.fromId !== userId && payload.toId !== userId) ||
          (payload.fromId !== friend.user.id && payload.toId !== friend.user.id)
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
            const fallbackRecord: MessageRecordInput = {
              clientMessageId: payload.clientMessageId,
              fromId: payload.fromId,
              toId: payload.toId,
              ciphertext: payload.ciphertext,
              nonce: payload.nonce,
              metadata: payload.metadata ?? {},
              status: payload.status ?? {},
              createdAt: payload.createdAt,
            };
            let record: MessageRecordInput | null = null;
            if (needsFetch) {
              const stored = await fetchEncryptedMessage(
                payload.threadId,
                payload.clientMessageId,
              );
              if (stored) {
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
                record = fallbackRecord;
              }
            } else {
              record = fallbackRecord;
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
      scheduleRetry();
    }
  }

  void subscribe();

  return () => {
    isActive = false;
    if (clearErrorTimer) {
      clearTimeout(clearErrorTimer);
      clearErrorTimer = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
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
