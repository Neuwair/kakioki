"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import { useAuth } from "@/lib/auth/ClientAuth";
import { useFriendRealtime } from "@/public/shared/logic/UserPresenceRealtime";
import type {
  FriendRealtimeEvent,
  FriendUserPayload,
} from "@/lib/events/RealtimeEvents";
import type {
  FriendRequestRecord,
  FriendSummaryEntry,
} from "@/lib/media/MediaTypes";

export interface FriendListUser {
  id: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  publicKey?: string;
}

export interface FriendListEntry {
  user: FriendListUser;
  request: FriendRequestRecord;
  threadId?: string | null;
  blockedBySelf?: boolean;
  blockedByFriend?: boolean;
  blockCreatedAt?: string | null;
}

interface FriendSummaryResponse {
  success: boolean;
  friends: FriendSummaryEntry[];
  incoming: FriendSummaryEntry[];
  outgoing: FriendSummaryEntry[];
  error?: string;
}

function mapUserPayload(payload: FriendUserPayload): FriendListUser {
  return {
    id: payload.id,
    userId: payload.user_id,
    username: payload.username,
    avatarUrl: payload.avatar_url ?? undefined,
    publicKey: payload.public_key ?? undefined,
  };
}

function mergeUnique(
  entries: FriendListEntry[],
  next: FriendListEntry,
  replace = false,
): FriendListEntry[] {
  const existingIndex = entries.findIndex(
    (entry) => entry.user.id === next.user.id,
  );
  if (existingIndex === -1) {
    return [...entries, next];
  }
  if (replace) {
    const clone = [...entries];
    clone[existingIndex] = next;
    return clone;
  }
  return entries;
}

function removeUser(
  entries: FriendListEntry[],
  userId: number,
): FriendListEntry[] {
  return entries.filter((entry) => entry.user.id !== userId);
}

function toFriendListEntry(entry: FriendSummaryEntry): FriendListEntry {
  const user = entry.user;
  return {
    user: {
      id: user.id,
      userId: user.user_id,
      username: user.username,
      avatarUrl: user.avatar_url ?? undefined,
      publicKey: user.public_key ?? undefined,
    },
    request: entry.request,
    threadId: entry.threadPublicId ?? null,
    blockedBySelf: entry.blockedBySelf ?? false,
    blockedByFriend: entry.blockedByFriend ?? false,
    blockCreatedAt: entry.blockedBySelf
      ? (entry.blockedSelfAt ?? null)
      : (entry.blockedFriendAt ?? null),
  };
}

export function useFriendRelationships() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendListEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set());
  const [cancelingIds, setCancelingIds] = useState<Set<number>>(new Set());
  const [decliningIds, setDecliningIds] = useState<Set<number>>(new Set());

  const fetchSummary = useCallback(async () => {
    if (!user) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/friend/summary", {
        method: "GET",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });

      const contentType = response.headers.get("content-type") ?? "";
      let parsed: unknown = null;
      if (contentType.includes("application/json")) {
        try {
          parsed = await response.json();
        } catch {
          parsed = null;
        }
      } else {
        try {
          parsed = await response.text();
        } catch {
          parsed = null;
        }
      }

      if (!response.ok) {
        let serverMessage: string | null = null;
        if (parsed && typeof parsed === "object") {
          const messageContainer = parsed as {
            error?: unknown;
            message?: unknown;
          };
          if (typeof messageContainer.error === "string") {
            serverMessage = messageContainer.error;
          } else if (typeof messageContainer.message === "string") {
            serverMessage = messageContainer.message;
          }
        } else if (typeof parsed === "string" && parsed.trim().length > 0) {
          serverMessage = parsed.trim();
        }
        const friendly =
          response.status === 500
            ? (serverMessage ??
              "Friend data unavailable. Please run the database migrations and try again.")
            : (serverMessage ?? `Failed with status ${response.status}`);
        throw new Error(friendly);
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Unexpected response from server");
      }
      const data = parsed as FriendSummaryResponse;
      if (!data.success) {
        throw new Error(data.error || "Unable to load friends");
      }

      setFriends(data.friends.map(toFriendListEntry));
      setIncoming(data.incoming.map(toFriendListEntry));
      setOutgoing(data.outgoing.map(toFriendListEntry));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (!/NetworkError|Failed to fetch|Load failed/i.test(msg)) {
        console.error("Friend summary fetch error:", err);
      }
      setError(err instanceof Error ? err.message : "Unable to load friends");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [fetchSummary, user]);

  const handleSentEvent = useCallback(
    (event: FriendRealtimeEvent) => {
      if (!user || event.type !== "friend_request_sent") {
        return;
      }

      if (event.request.from_id === user.id) {
        const entry: FriendListEntry = {
          user: mapUserPayload(event.toUser),
          request: event.request,
          threadId: null,
          blockedBySelf: false,
          blockedByFriend: false,
          blockCreatedAt: null,
        };
        setOutgoing((prev) => mergeUnique(prev, entry, true));
      } else if (event.request.to_id === user.id) {
        const entry: FriendListEntry = {
          user: mapUserPayload(event.fromUser),
          request: event.request,
          threadId: null,
          blockedBySelf: false,
          blockedByFriend: false,
          blockCreatedAt: null,
        };
        setIncoming((prev) => mergeUnique(prev, entry, true));
      }
    },
    [user],
  );

  const handleCancelledEvent = useCallback(
    (event: FriendRealtimeEvent) => {
      if (!user || event.type !== "friend_request_cancelled") {
        return;
      }

      if (event.fromUserId === user.id) {
        setOutgoing((prev) => removeUser(prev, event.toUserId));
      } else if (event.toUserId === user.id) {
        setIncoming((prev) => removeUser(prev, event.fromUserId));
      }
    },
    [user],
  );

  const handleAcceptedEvent = useCallback(
    (event: FriendRealtimeEvent) => {
      if (!user || event.type !== "friend_request_accepted") {
        return;
      }

      const friendUserId =
        event.request.from_id === user.id
          ? event.request.to_id
          : event.request.from_id;
      const friendPayload =
        event.request.from_id === user.id ? event.toUser : event.fromUser;

      const isAcceptor = event.request.to_id === user.id;
      const blockedBySelf = isAcceptor
        ? (event.blockedBySelf ?? false)
        : (event.blockedByFriend ?? false);
      const blockedByFriend = isAcceptor
        ? (event.blockedByFriend ?? false)
        : (event.blockedBySelf ?? false);

      const entry: FriendListEntry = {
        user: mapUserPayload(friendPayload),
        request: event.request,
        threadId: null,
        blockedBySelf,
        blockedByFriend,
        blockCreatedAt: event.blockCreatedAt ?? null,
      };

      setFriends((prev) => {
        const existing = prev.find(
          (current) => current.user.id === entry.user.id,
        );
        const merged = existing
          ? { ...entry, threadId: existing.threadId ?? null }
          : entry;
        return mergeUnique(prev, merged, true);
      });
      setIncoming((prev) => removeUser(prev, friendUserId));
      setOutgoing((prev) => removeUser(prev, friendUserId));
    },
    [user],
  );

  const realtimeHandler = useCallback(
    (event: FriendRealtimeEvent) => {
      if (event.type === "friend_request_sent") {
        handleSentEvent(event);
      } else if (event.type === "friend_request_cancelled") {
        handleCancelledEvent(event);
      } else if (event.type === "friend_request_accepted") {
        handleAcceptedEvent(event);
      } else if (event.type === "friend_removed") {
        const otherUserId =
          event.initiatorId === user?.id ? event.targetId : event.initiatorId;
        setFriends((prev) => removeUser(prev, otherUserId));
      }
    },
    [handleAcceptedEvent, handleCancelledEvent, handleSentEvent, user?.id],
  );

  useFriendRealtime(realtimeHandler);

  const acceptRequest = useCallback(
    async (fromUserId: number) => {
      if (!user) {
        return;
      }
      if (acceptingIds.has(fromUserId)) {
        return;
      }
      setAcceptingIds((prev) => new Set(prev).add(fromUserId));
      try {
        const response = await fetch("/api/friend/request", {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fromUserId }),
        });
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const data = await response.json();
        if (data?.request) {
          const entry = incoming.find((item) => item.user.id === fromUserId);
          if (entry) {
            const updatedEntry: FriendListEntry = {
              user: entry.user,
              request: data.request as FriendRequestRecord,
              threadId: entry.threadId,
              blockedBySelf: entry.blockedBySelf,
              blockedByFriend: entry.blockedByFriend,
              blockCreatedAt: entry.blockCreatedAt,
            };
            setFriends((prev) => mergeUnique(prev, updatedEntry, true));
            setIncoming((prev) => removeUser(prev, fromUserId));
          }
        }
      } catch (err) {
        console.error("Accept friend request error:", err);
      } finally {
        setAcceptingIds((prev) => {
          const next = new Set(prev);
          next.delete(fromUserId);
          return next;
        });
      }
    },
    [acceptingIds, incoming, user],
  );

  const cancelOutgoing = useCallback(
    async (toUserId: number) => {
      if (cancelingIds.has(toUserId)) {
        return;
      }
      setCancelingIds((prev) => new Set(prev).add(toUserId));
      try {
        const response = await fetch("/api/friend/request", {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ toUserId }),
        });
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        setOutgoing((prev) => removeUser(prev, toUserId));
      } catch (err) {
        console.error("Cancel outgoing request error:", err);
      } finally {
        setCancelingIds((prev) => {
          const next = new Set(prev);
          next.delete(toUserId);
          return next;
        });
      }
    },
    [cancelingIds],
  );

  const declineIncoming = useCallback(
    async (fromUserId: number) => {
      if (decliningIds.has(fromUserId)) {
        return;
      }
      setDecliningIds((prev) => new Set(prev).add(fromUserId));
      try {
        const response = await fetch("/api/friend/request", {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fromUserId }),
        });
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        setIncoming((prev) => removeUser(prev, fromUserId));
      } catch (err) {
        console.error("Decline incoming request error:", err);
      } finally {
        setDecliningIds((prev) => {
          const next = new Set(prev);
          next.delete(fromUserId);
          return next;
        });
      }
    },
    [decliningIds],
  );

  const state = useMemo(
    () => ({
      friends,
      incoming,
      outgoing,
      isLoading,
      error,
      acceptingIds,
      cancelingIds,
      decliningIds,
      acceptRequest,
      cancelOutgoing,
      declineIncoming,
      refresh: fetchSummary,
    }),
    [
      friends,
      incoming,
      outgoing,
      isLoading,
      error,
      acceptingIds,
      cancelingIds,
      decliningIds,
      acceptRequest,
      cancelOutgoing,
      declineIncoming,
      fetchSummary,
    ],
  );

  return state;
}
