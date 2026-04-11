"use client";

import { useEffect, useRef, useState } from "react";
import type { PresenceMessage } from "ably";
import type { FriendRealtimeEvent } from "@/lib/events/RealtimeEvents";
import {
  APP_PRESENCE_CHANNEL,
  friendChannel,
} from "@/lib/events/RealtimeEvents";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { useAuth } from "@/lib/auth/ClientAuth";
import { getRealtimeClient } from "@/public/shared/services/AblyRealtime";
import { sessionKey } from "@/public/shared/helpers/TabSessionHelpers";

export type PresenceStatus = "online" | "away" | "offline";

export type PresencePayload = {
  status: PresenceStatus;
  updatedAt: number;
};

const PRESENCE_STALE_TTL_MS = KAKIOKI_CONFIG.presence.staleTtlMs;

export const CURRENT_USER_PRESENCE_STATUS_EVENT =
  "kakioki:presence-status-change";

export function getCurrentUserPresenceStatusStorageKey(): string {
  return sessionKey("presenceStatus");
}

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
      getCurrentUserPresenceStatusStorageKey(),
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
      getCurrentUserPresenceStatusStorageKey(),
      status,
    );
    window.dispatchEvent(
      new CustomEvent(CURRENT_USER_PRESENCE_STATUS_EVENT, {
        detail: status,
      }),
    );
  } catch {}
}

export function buildPresencePayload(status: PresenceStatus): PresencePayload {
  return { status, updatedAt: Date.now() };
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

const PRESENCE_CLOCK_SKEW_TOLERANCE_MS =
  KAKIOKI_CONFIG.presence.clockSkewToleranceMs;

function readPresenceUpdatedAt(data: unknown): number {
  if (typeof data === "object" && data !== null) {
    const updatedAt = (data as { updatedAt?: unknown }).updatedAt;
    if (typeof updatedAt !== "number") {
      return 0;
    }
    return Math.min(updatedAt, Date.now() + PRESENCE_CLOCK_SKEW_TOLERANCE_MS);
  }
  return 0;
}

function isStale(data: unknown): boolean {
  return Date.now() - readPresenceUpdatedAt(data) > PRESENCE_STALE_TTL_MS;
}

function resolvePresenceStatusFromClientId(
  members: PresenceMessage[],
  targetClientId: string,
): PresenceStatus {
  const relevant = members.filter(
    (m) => m.clientId === targetClientId && !isStale(m.data),
  );

  if (relevant.length === 0) {
    return "offline";
  }

  let hasAway = false;

  for (const member of relevant) {
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

export function useUserPresence(targetUserId: number | null): PresenceResult {
  const [status, setStatus] = useState<PresenceStatus>("offline");
  const [isReady, setIsReady] = useState(false);
  const [resolvedTargetUserId, setResolvedTargetUserId] = useState<
    number | null
  >(null);
  const latestUpdatedAtRef = useRef<number>(0);

  useEffect(() => {
    if (targetUserId === null) {
      latestUpdatedAtRef.current = 0;
      return;
    }

    const targetClientId = targetUserId.toString();
    let isActive = true;
    let channel: PresenceChannel | null = null;
    let listener: ((message: PresenceMessage) => void) | null = null;
    latestUpdatedAtRef.current = 0;

    const applyFromMembers = async () => {
      if (!channel) {
        return;
      }
      try {
        const all = await channel.presence.get();
        if (!isActive) {
          return;
        }
        latestUpdatedAtRef.current = all
          .filter((member) => member.clientId === targetClientId)
          .reduce(
            (latestUpdatedAt, member) =>
              Math.max(latestUpdatedAt, readPresenceUpdatedAt(member.data)),
            0,
          );
        const resolved = resolvePresenceStatusFromClientId(all, targetClientId);
        setResolvedTargetUserId(targetUserId);
        setStatus(resolved);
        setIsReady(true);
      } catch (error) {
        console.error("Presence state fetch error:", error);
        if (isActive) {
          setResolvedTargetUserId(targetUserId);
          setStatus("offline");
          setIsReady(true);
        }
      }
    };

    const subscribe = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(
          APP_PRESENCE_CHANNEL,
        ) as unknown as PresenceChannel;
        await channel.attach();
        if (!isActive) {
          return;
        }

        await applyFromMembers();
        if (!isActive) {
          return;
        }

        listener = async (message: PresenceMessage) => {
          if (!isActive || message.clientId !== targetClientId) {
            return;
          }

          const incomingUpdatedAt = readPresenceUpdatedAt(message.data);
          if (incomingUpdatedAt < latestUpdatedAtRef.current) {
            return;
          }
          latestUpdatedAtRef.current = incomingUpdatedAt;

          if (ONLINE_ACTIONS.includes(message.action)) {
            const memberStatus = readPresenceStatus(message.data);
            if (memberStatus === "online") {
              setResolvedTargetUserId(targetUserId);
              setStatus("online");
              setIsReady(true);
              return;
            }
          }

          await applyFromMembers();
        };

        channel.presence.subscribe(listener);
      } catch (error) {
        console.error("User presence subscription error:", error);
        if (isActive) {
          setResolvedTargetUserId(targetUserId);
          setStatus("offline");
          setIsReady(false);
        }
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
    };
  }, [targetUserId]);

  const hasResolvedTarget =
    targetUserId !== null && resolvedTargetUserId === targetUserId;

  return {
    status: hasResolvedTarget ? status : "offline",
    isReady: hasResolvedTarget ? isReady : false,
  };
}

export function useCurrentUserPresence(): PresenceResult {
  const { user } = useAuth();
  return useUserPresence(user?.id ?? null);
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
