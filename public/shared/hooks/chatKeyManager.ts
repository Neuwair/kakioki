"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "@/public/shared/Helpers/AuthHelpers";
import {
  deriveSharedKey,
  ensurePrivateKeyAvailable,
} from "@/public/shared/Helpers/KeyHelpers";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

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
