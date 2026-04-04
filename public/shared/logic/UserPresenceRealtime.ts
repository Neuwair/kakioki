"use client";

import { useEffect, useRef, useState } from "react";
import type { PresenceMessage } from "ably";
import type { FriendRealtimeEvent } from "@/lib/events/RealtimeEvents";
import { friendChannel } from "@/lib/events/RealtimeEvents";
import { useAuth } from "@/lib/auth/ClientAuth";
import { getRealtimeClient } from "@/public/shared/services/AblyRealtime";

type PresenceStatus = "online" | "offline";

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
        const hasPresence = members.length > 0;
        setStatus(hasPresence ? "online" : "offline");
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
            setStatus("online");
            setIsReady(true);
            return;
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
  const [status, setStatus] = useState<PresenceStatus>("offline");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;
    let cleanup: (() => void) | undefined;

    const updateStatus = (state: string) => {
      if (!isActive) return;
      const isOnline = state === "connected" || state === "connecting";
      setStatus(isOnline ? "online" : "offline");
      setIsReady(true);
    };

    const subscribe = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) return;

        // Set initial status
        updateStatus(client.connection.state);

        // Listen for state changes
        const onStateChange = (stateChange: { current: string }) => {
          updateStatus(stateChange.current);
        };

        client.connection.on(onStateChange);

        cleanup = () => {
          if (isActive) {
            client.connection.off(onStateChange);
          }
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
