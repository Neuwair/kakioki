"use client";

import { useEffect, useRef, useState } from "react";
import type { PresenceMessage } from "ably";
import type { FriendRealtimeEvent } from "@/lib/events/RealtimeEvents";
import { friendChannel } from "@/lib/events/RealtimeEvents";
import { useAuth } from "@/lib/auth/ClientAuth";
import { getRealtimeClient } from "@/public/shared/services/AblyRealtime";

export type PresenceStatus = "online" | "away" | "offline";

export type PresencePayload = {
  userId?: string;
  status: PresenceStatus;
  updatedAt: string;
};

export const CURRENT_USER_PRESENCE_STATUS_STORAGE_KEY = "kakiokiPresenceStatus";
export const CURRENT_USER_PRESENCE_STATUS_EVENT =
  "kakioki:presence-status-change";

const DEFAULT_PRESENCE_STATUS: PresenceStatus = "online";

export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return value === "online" || value === "away" || value === "offline";
}

export function getStoredCurrentUserPresenceStatus(): PresenceStatus {
  try {
    if (typeof window === "undefined") {
      return DEFAULT_PRESENCE_STATUS;
    }

    const storedStatus = window.localStorage.getItem(
      CURRENT_USER_PRESENCE_STATUS_STORAGE_KEY,
    );

    return isPresenceStatus(storedStatus)
      ? storedStatus
      : DEFAULT_PRESENCE_STATUS;
  } catch {
    return DEFAULT_PRESENCE_STATUS;
  }
}

export function setStoredCurrentUserPresenceStatus(
  status: PresenceStatus,
): void {
  try {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      CURRENT_USER_PRESENCE_STATUS_STORAGE_KEY,
      status,
    );
    window.dispatchEvent(
      new CustomEvent(CURRENT_USER_PRESENCE_STATUS_EVENT, {
        detail: status,
      }),
    );
  } catch {}
}

export function buildPresencePayload(
  userId: string | undefined,
  status: PresenceStatus,
): PresencePayload {
  return {
    userId,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function readPresenceStatus(data: unknown): PresenceStatus {
  if (
    typeof data === "object" &&
    data !== null &&
    isPresenceStatus((data as { status?: unknown }).status)
  ) {
    return (data as { status: PresenceStatus }).status;
  }

  return DEFAULT_PRESENCE_STATUS;
}

type PresenceResult = {
  status: PresenceStatus;
  isReady: boolean;
};

type PresenceChannel = {
  attach: () => Promise<unknown>;
  detach: () => Promise<unknown>;
  presence: {
    get: () => Promise<PresenceMessage[]>;
    subscribe: (listener: (message: PresenceMessage) => void) => void;
    unsubscribe: (listener: (message: PresenceMessage) => void) => void;
  };
};

type AblyChannel = {
  subscribe: (listener: (message: { data: unknown }) => void) => void;
  unsubscribe: (listener: (message: { data: unknown }) => void) => void;
};

const ONLINE_ACTIONS: PresenceMessage["action"][] = [
  "enter",
  "present",
  "update",
];

function resolvePresenceStatus(members: PresenceMessage[]): PresenceStatus {
  if (members.length === 0) {
    return "offline";
  }

  let hasAway = false;

  for (const member of members) {
    const memberStatus = readPresenceStatus(member.data);

    if (memberStatus === "online") {
      return "online";
    }

    if (memberStatus === "away") {
      hasAway = true;
    }
  }

  return hasAway ? "away" : "offline";
}

export function useUserPresence(targetUserId: number | null): PresenceResult {
  const [status, setStatus] = useState<PresenceStatus>("offline");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;
    let channel: PresenceChannel | null = null;
    let listener: ((message: PresenceMessage) => void) | null = null;
    let attachPromise: Promise<unknown> | null = null;

    const reset = () => {
      if (!isActive) {
        return;
      }
      setStatus("offline");
      setIsReady(false);
    };

    const updateFromMembers = async () => {
      if (!channel) {
        return;
      }
      try {
        const members = await channel.presence.get();
        if (!isActive) {
          return;
        }
        setStatus(resolvePresenceStatus(members));
        setIsReady(true);
      } catch (error) {
        console.error("Presence state fetch error:", error);
        if (isActive) {
          setStatus("offline");
          setIsReady(true);
        }
      }
    };

    const subscribe = async () => {
      if (!targetUserId) {
        reset();
        return;
      }
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(
          `user:${targetUserId}:presence`,
        ) as unknown as PresenceChannel;
        attachPromise = channel.attach();
        await attachPromise;

        listener = async (message: PresenceMessage) => {
          if (!isActive) {
            return;
          }
          if (ONLINE_ACTIONS.includes(message.action)) {
            const memberStatus = readPresenceStatus(message.data);
            if (memberStatus === "online") {
              setStatus("online");
              setIsReady(true);
              return;
            }
          }
          await updateFromMembers();
        };

        channel.presence.subscribe(listener);
        await updateFromMembers();
      } catch (error) {
        console.error("User presence subscription error:", error);
        reset();
      }
    };

    subscribe();

    return () => {
      isActive = false;
      if (channel && listener) {
        try {
          channel.presence.unsubscribe(listener);
        } catch (unsubscribeError) {
          console.error("Presence unsubscribe error:", unsubscribeError);
        }
      }
      if (channel) {
        void (async () => {
          try {
            if (attachPromise) {
              await attachPromise;
            }
            await channel.detach();
          } catch (detachError) {
            const message =
              detachError instanceof Error
                ? detachError.message
                : String(detachError);
            if (!/superseded by a subsequent detach/i.test(message)) {
              console.error("Presence channel detach error:", detachError);
            }
          }
        })();
      }
    };
  }, [targetUserId]);

  return {
    status,
    isReady,
  };
}

export function useCurrentUserPresence(): PresenceResult {
  const [status, setStatus] = useState<PresenceStatus>(() =>
    getStoredCurrentUserPresenceStatus(),
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;
    let cleanup: (() => void) | undefined;
    let connectionState = "initialized";

    const updateStatus = (state: string) => {
      if (!isActive) return;
      connectionState = state;
      const isConnected = state === "connected" || state === "connecting";
      setStatus(isConnected ? getStoredCurrentUserPresenceStatus() : "offline");
      setIsReady(true);
    };

    const syncStoredStatus = () => {
      if (!isActive) {
        return;
      }

      const isConnected =
        connectionState === "connected" || connectionState === "connecting";

      setStatus(isConnected ? getStoredCurrentUserPresenceStatus() : "offline");
      setIsReady(true);
    };

    const subscribe = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) return;

        updateStatus(client.connection.state);

        const onStateChange = (stateChange: { current: string }) => {
          updateStatus(stateChange.current);
        };

        const onStorage = (event: StorageEvent) => {
          if (
            event.key &&
            event.key !== CURRENT_USER_PRESENCE_STATUS_STORAGE_KEY
          ) {
            return;
          }

          syncStoredStatus();
        };

        client.connection.on(onStateChange);
        window.addEventListener(
          CURRENT_USER_PRESENCE_STATUS_EVENT,
          syncStoredStatus,
        );
        window.addEventListener("storage", onStorage);

        cleanup = () => {
          client.connection.off(onStateChange);
          window.removeEventListener(
            CURRENT_USER_PRESENCE_STATUS_EVENT,
            syncStoredStatus,
          );
          window.removeEventListener("storage", onStorage);
        };
      } catch (error) {
        console.error("Current user presence subscription error:", error);
        if (isActive) {
          setStatus("offline");
          setIsReady(true);
        }
      }
    };

    subscribe();

    return () => {
      isActive = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return {
    status,
    isReady,
  };
}

export function useFriendRealtime(
  onEvent: (event: FriendRealtimeEvent) => void,
) {
  const { user } = useAuth();
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let isActive = true;
    let channel: AblyChannel | null = null;
    let listener: ((message: { data: unknown }) => void) | null = null;

    const subscribe = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(friendChannel(user.id)) as AblyChannel;
        if (!channel) {
          return;
        }
        listener = (message) => {
          const payload = message.data as FriendRealtimeEvent;
          handlerRef.current(payload);
        };
        channel.subscribe(listener);
      } catch (error) {
        console.error("Friend realtime subscription error:", error);
      }
    };

    subscribe();

    return () => {
      isActive = false;
      if (channel && listener) {
        channel.unsubscribe(listener);
      }
    };
  }, [user]);
}
