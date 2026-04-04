"use client";

import type {
  EncryptedMediaDescriptor,
  MessageStatusMetadata,
} from "@/lib/media/MediaTypes";
import {
  applyStatusToMessage,
  cloneMetadata,
} from "@/public/shared/chat/MessageUtils";
import type {
  ChatMessage,
  DecryptedMedia,
  MessageRecordInput,
} from "@/public/shared/chat/types/ChatTypes";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import {
  encryptTextWithSharedKey,
  decryptTextWithSharedKey,
  deriveSharedKey,
  ensurePrivateKeyAvailable,
} from "@/public/shared/helpers/LibsodiumHelpers";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";
import type { UploadedMediaItem } from "@/public/shared/logic/MediaHandler";

interface ChatUser {
  id: number;
  publicKey?: string;
  secretKeyEncrypted?: string;
}

export interface ChatKeyManager {
  isPrivateKeyReady: boolean;
  friendPublicKey: string | null;
  setFriendPublicKey: React.Dispatch<React.SetStateAction<string | null>>;
  getCachedSharedKey: (targetFriendId: number) => Uint8Array | null;
  ensureFriendPublicKey: () => Promise<string>;
  ensureSharedKey: () => Promise<Uint8Array>;
  clearKeyCache: () => void;
}

export function generateClientMessageId(): string {
  const cryptoObj =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj) {
    if (typeof cryptoObj.randomUUID === "function") {
      return cryptoObj.randomUUID();
    }
    if (typeof cryptoObj.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      );
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
        .slice(6, 8)
        .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }
  }
  const now = Date.now().toString(16);
  const rand = () => Math.random().toString(16).slice(2, 10);
  return `${now}-${rand()}-${rand()}`;
}

export async function decryptRecord(
  record: MessageRecordInput,
  sharedKey: Uint8Array,
): Promise<ChatMessage> {
  let plaintext: string | null = null;
  try {
    plaintext = await decryptTextWithSharedKey(
      sharedKey,
      record.ciphertext,
      record.nonce,
    );
  } catch (decryptError) {
    console.error("Message decrypt error", {
      messageId: record.id,
      clientMessageId: record.clientMessageId,
      cause:
        decryptError instanceof Error ? decryptError.message : decryptError,
    });
    plaintext = null;
  }
  const metadata = cloneMetadata(record.metadata ?? undefined);
  const status: MessageStatusMetadata = {
    ...(record.statusMetadata ?? record.status ?? {}),
  };
  const mediaDescriptors = metadata.media ?? [];
  metadata.media = mediaDescriptors;
  const media = await decryptMediaDescriptors(mediaDescriptors, sharedKey);
  const message: ChatMessage = {
    id: record.id,
    clientMessageId: record.clientMessageId,
    senderId: record.fromId,
    ciphertext: record.ciphertext,
    nonce: record.nonce,
    plaintext,
    metadata,
    media,
    status,
    createdAt: record.createdAt,
    state: "sent",
  };
  const nextState = applyStatusToMessage(message);
  return { ...message, state: nextState };
}

function getSubtleCrypto(): SubtleCrypto | null {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    globalThis.crypto.subtle
  ) {
    return globalThis.crypto.subtle;
  }
  return null;
}

async function computeDigestBase64(value: string): Promise<string | undefined> {
  const subtle = getSubtleCrypto();
  if (!subtle) {
    return undefined;
  }
  try {
    const data = new TextEncoder().encode(value);
    const hash = await subtle.digest("SHA-256", data);
    let binary = "";
    const bytes = new Uint8Array(hash);
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    if (typeof globalThis.btoa === "function") {
      return globalThis.btoa(binary);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function encryptMediaItems(
  sharedKey: Uint8Array,
  items: UploadedMediaItem[],
): Promise<{
  descriptors: EncryptedMediaDescriptor[];
  decrypted: DecryptedMedia[];
}> {
  const descriptors: EncryptedMediaDescriptor[] = [];
  const decrypted: DecryptedMedia[] = [];
  for (const item of items) {
    if (!item.url) {
      continue;
    }
    try {
      const { ciphertext, nonce } = await encryptTextWithSharedKey(
        sharedKey,
        item.url,
      );
      const digest = await computeDigestBase64(item.url);
      const descriptor: EncryptedMediaDescriptor = {
        url: "",
        ciphertext,
        nonce,
        type: item.type,
        format: item.format,
        size: item.size,
        width: item.width,
        height: item.height,
        digest,
      };
      if (typeof item.thumbnail !== "undefined") {
        descriptor.thumbnail = item.thumbnail ?? null;
      }
      if (item.name) {
        descriptor.name = item.name;
      }
      descriptors.push(descriptor);
      decrypted.push({
        source: item.url,
        type: item.type,
        format: item.format,
        size: item.size,
        width: item.width,
        height: item.height,
        digest,
        thumbnail: item.thumbnail ?? null,
        name: item.name,
      });
    } catch (error) {
      console.error("Media encryption error:", error);
    }
  }
  return { descriptors, decrypted };
}

export function convertDecryptedToUploaded(
  items: DecryptedMedia[],
): UploadedMediaItem[] {
  return items
    .filter(
      (item) => item.source && (item.type === "image" || item.type === "video"),
    )
    .map((item) => ({
      url: item.source,
      type: item.type === "video" ? "video" : "image",
      format: item.format,
      size: item.size,
      width: item.width,
      height: item.height,
      thumbnail:
        typeof item.thumbnail === "undefined" ? null : (item.thumbnail ?? null),
      name: item.name,
    }));
}

export async function decryptMediaDescriptors(
  descriptors: EncryptedMediaDescriptor[] | undefined,
  sharedKey: Uint8Array,
): Promise<DecryptedMedia[]> {
  if (!descriptors || descriptors.length === 0) {
    return [];
  }
  const results: DecryptedMedia[] = [];
  for (const descriptor of descriptors) {
    if (!descriptor.ciphertext || !descriptor.nonce) {
      continue;
    }
    try {
      const source = await decryptTextWithSharedKey(
        sharedKey,
        descriptor.ciphertext,
        descriptor.nonce,
      );
      const type = descriptor.type === "file" ? "file" : descriptor.type;
      results.push({
        source,
        type,
        format: descriptor.format,
        size: descriptor.size,
        width: descriptor.width,
        height: descriptor.height,
        digest: descriptor.digest,
        thumbnail: descriptor.thumbnail ?? null,
        name: descriptor.name,
      });
    } catch (error) {
      console.error("Media decrypt error:", error);
    }
  }
  return results;
}

export function useChatKeyManager(
  user: ChatUser | null | undefined,
  friend: FriendListEntry | null,
): ChatKeyManager {
  const [isPrivateKeyReady, setIsPrivateKeyReady] = useState(false);
  const [friendPublicKey, setFriendPublicKey] = useState<string | null>(
    friend?.user.publicKey ?? null,
  );

  const sharedKeyCacheRef = useRef<Map<string, Uint8Array>>(new Map());
  const sharedKeyPromisesRef = useRef<Map<string, Promise<Uint8Array>>>(
    new Map(),
  );
  const friendSharedKeyTokenRef = useRef<Map<number, string>>(new Map());

  const getCachedSharedKey = useCallback((targetFriendId: number) => {
    const token = friendSharedKeyTokenRef.current.get(targetFriendId);
    if (!token) {
      return null;
    }
    return sharedKeyCacheRef.current.get(token) ?? null;
  }, []);

  const clearKeyCache = useCallback(() => {
    sharedKeyCacheRef.current.clear();
    friendSharedKeyTokenRef.current.clear();
    sharedKeyPromisesRef.current.clear();
  }, []);

  useEffect(() => {
    let active = true;
    const initialiseKey = async () => {
      if (!user?.secretKeyEncrypted) {
        setIsPrivateKeyReady(false);
        return;
      }
      try {
        await ensurePrivateKeyAvailable(user.secretKeyEncrypted);
        if (active) {
          setIsPrivateKeyReady(true);
        }
      } catch (initialiseError) {
        if (active) {
          setIsPrivateKeyReady(false);
        }
        console.error("Private key initialisation failed:", initialiseError);
      }
    };
    void initialiseKey();
    return () => {
      active = false;
    };
  }, [user?.id, user?.secretKeyEncrypted]);

  useEffect(() => {
    clearKeyCache();
  }, [user?.id, clearKeyCache]);

  const fetchFriendPublicKey = useCallback(async () => {
    if (!friend) {
      return null;
    }
    try {
      const response = await fetch(
        `/api/friend/profile?friendId=${friend.user.id}`,
        {
          headers: {
            ...getAuthHeaders(),
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error(
          "Failed to fetch friend key:",
          data?.error || response.status,
        );
        return null;
      }
      const key = (data?.friend?.publicKey as string | undefined) ?? null;
      if (key) {
        setFriendPublicKey(key);
      }
      return key;
    } catch (error) {
      console.error("Friend key fetch error:", error);
      return null;
    }
  }, [friend]);

  const ensureFriendPublicKey = useCallback(async () => {
    if (!friend) {
      throw new Error("Friend not selected");
    }
    if (friend.user.publicKey) {
      if (friendPublicKey !== friend.user.publicKey) {
        setFriendPublicKey(friend.user.publicKey);
      }
      return friend.user.publicKey;
    }
    if (friendPublicKey) {
      return friendPublicKey;
    }
    const fetched = await fetchFriendPublicKey();
    if (fetched) {
      return fetched;
    }
    throw new Error("Friend public key unavailable");
  }, [friend, friendPublicKey, fetchFriendPublicKey]);

  const ensureSharedKey = useCallback(async () => {
    if (!friend) {
      throw new Error("Missing friend key");
    }
    if (!user?.id) {
      throw new Error("User session missing");
    }
    const resolvedFriendKey = await ensureFriendPublicKey();
    const cacheToken = `${user.id}:${friend.user.id}:${resolvedFriendKey}`;
    const cached = sharedKeyCacheRef.current.get(cacheToken);
    if (cached) {
      friendSharedKeyTokenRef.current.set(friend.user.id, cacheToken);
      if (!isPrivateKeyReady) {
        setIsPrivateKeyReady(true);
      }
      return cached;
    }
    const existingToken = friendSharedKeyTokenRef.current.get(friend.user.id);
    if (existingToken && existingToken !== cacheToken) {
      friendSharedKeyTokenRef.current.delete(friend.user.id);
    }
    const pending = sharedKeyPromisesRef.current.get(cacheToken);
    if (pending) {
      const shared = await pending;
      friendSharedKeyTokenRef.current.set(friend.user.id, cacheToken);
      if (!isPrivateKeyReady) {
        setIsPrivateKeyReady(true);
      }
      return shared;
    }
    const derivationPromise = (async () => {
      try {
        await ensurePrivateKeyAvailable(user.secretKeyEncrypted);
      } catch (availabilityError) {
        console.error("Shared key derivation failed: private key unavailable", {
          userId: user.id,
          friendId: friend.user.id,
        });
        throw availabilityError;
      }
      if (!user.publicKey) {
        console.warn(
          "Proceeding without cached user public key; will derive from private key",
          {
            userId: user.id,
          },
        );
      }
      const selfPublicKey =
        user.publicKey && user.publicKey.length > 0
          ? user.publicKey
          : undefined;
      const derivedKey = await deriveSharedKey(
        user.id,
        friend.user.id,
        resolvedFriendKey,
        selfPublicKey,
      );
      sharedKeyCacheRef.current.set(cacheToken, derivedKey);
      friendSharedKeyTokenRef.current.set(friend.user.id, cacheToken);
      if (!isPrivateKeyReady) {
        setIsPrivateKeyReady(true);
      }
      return derivedKey;
    })();
    sharedKeyPromisesRef.current.set(cacheToken, derivationPromise);
    try {
      const derived = await derivationPromise;
      return derived;
    } finally {
      sharedKeyPromisesRef.current.delete(cacheToken);
    }
  }, [ensureFriendPublicKey, friend, isPrivateKeyReady, user]);

  return {
    isPrivateKeyReady,
    friendPublicKey,
    setFriendPublicKey,
    getCachedSharedKey,
    ensureFriendPublicKey,
    ensureSharedKey,
    clearKeyCache,
  };
}
