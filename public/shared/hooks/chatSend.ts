import type { EncryptedMessageRecord } from "@/lib/types/TypesLogic";
import { getAuthHeaders } from "@/public/shared/Helpers/AuthHelpers";
import { encryptTextWithSharedKey } from "@/public/shared/Helpers/KeyHelpers";
import { processMediaForMessage } from "@/public/shared/Logic/MediaHandler";
import {
  encryptMediaItems,
  convertDecryptedToUploaded,
} from "@/public/shared/hooks/chatMedia";
import { cloneMetadata, mergeMessage } from "@/public/shared/hooks/chatUtils";
import {
  generateClientMessageId,
  decryptRecord,
} from "@/public/shared/hooks/chatEncryption";
import type {
  BlockState,
  ChatMessage,
  DecryptedMedia,
  SendMessageOptions,
  SendMessageResult,
} from "@/public/shared/hooks/chatTypes";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

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

export async function executeSendMessage(
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
  const clientMessageId =
    options?.clientMessageId ?? generateClientMessageId();
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
      const uploadedMedia = await processMediaForMessage(
        options.mediaPreviews,
      );
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
    const storedThreadId =
      (data.threadId as string | undefined) ?? threadId;
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

export function buildRetryOptions(
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
