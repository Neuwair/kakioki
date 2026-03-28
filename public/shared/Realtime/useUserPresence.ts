"use client";

import { useEffect, useState } from "react";
import type { PresenceMessage } from "ably";
import { userPresenceChannel } from "@/lib/Realtime/UserPresence";
import { getRealtimeClient } from "@/public/shared/Realtime/ablyClient";

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
          userPresenceChannel(targetUserId)
        ) as unknown as PresenceChannel;
        await channel.attach();

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
        void channel.detach().catch((detachError: unknown) => {
          console.error("Presence channel detach error:", detachError);
        });
      }
    };
  }, [targetUserId]);

  return {
    status,
    isReady,
  };
}
