import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import { useAuth } from "@/lib/auth/ClientAuth";
import { useFriendRealtime } from "@/public/shared/logic/UserPresenceRealtime";
import type { FriendRealtimeEvent } from "@/lib/events/RealtimeEvents";

export type FriendRelationshipStatus =
  | "none"
  | "incoming"
  | "outgoing"
  | "friends";

export interface FriendSearchItem {
  id: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  status: FriendRelationshipStatus;
  requestId: number | null;
  requesterId: number | null;
  addresseeId: number | null;
}

interface FriendSearchResponse {
  results: Array<{
    id: number;
    userId: string;
    username: string;
    avatarUrl?: string;
    status: FriendRelationshipStatus;
    requestId: number | null;
    requesterId: number | null;
    addresseeId: number | null;
  }>;
}

export function useFriendSearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestingIds, setRequestingIds] = useState<Set<number>>(new Set());
  const [cancelingIds, setCancelingIds] = useState<Set<number>>(new Set());
  const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      if (abortRef.current) {
        abortRef.current.abort();
      }
      return;
    }

    setIsSearching(true);
    setError(null);

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    lastQueryRef.current = trimmed;

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch("/api/friend/search", {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: trimmed }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const data = (await response.json()) as FriendSearchResponse;
        setResults(
          data.results.map((item) => ({
            id: item.id,
            userId: item.userId,
            username: item.username,
            avatarUrl: item.avatarUrl,
            status: item.status,
            requestId: item.requestId,
            requesterId: item.requesterId,
            addresseeId: item.addresseeId,
          })),
        );
        setIsSearching(false);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Friend search fetch error:", err);
        setError("Unable to search for friends");
        setIsSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const updateResult = useCallback(
    (userId: number, updater: (item: FriendSearchItem) => FriendSearchItem) => {
      setResults((prev) =>
        prev.map((item) => (item.id === userId ? updater(item) : item)),
      );
    },
    [],
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: number) => {
      if (requestingIds.has(targetUserId)) {
        return;
      }

      const previous = results.find((item) => item.id === targetUserId);
      setRequestingIds((prev) => new Set(prev).add(targetUserId));

      try {
        const response = await fetch("/api/friend/request", {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ toUserId: targetUserId }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
      } catch (err) {
        console.error("Send friend request error:", err);
        if (previous) {
          updateResult(targetUserId, () => previous);
        }
        setError("Unable to send friend request");
        setRequestingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      }
    },
    [requestingIds, results, updateResult],
  );

  const cancelFriendRequest = useCallback(
    async (targetUserId: number) => {
      if (cancelingIds.has(targetUserId)) {
        return;
      }

      const previous = results.find((item) => item.id === targetUserId);
      setCancelingIds((prev) => new Set(prev).add(targetUserId));

      try {
        const response = await fetch("/api/friend/request", {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ toUserId: targetUserId }),
        });

        if (!response.ok) {
          throw new Error(`Cancel failed with status ${response.status}`);
        }
      } catch (err) {
        console.error("Cancel friend request error:", err);
        if (previous) {
          updateResult(targetUserId, () => previous);
        }
        setError("Unable to cancel friend request");
        setCancelingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      }
    },
    [cancelingIds, results, updateResult],
  );

  const acceptFriendRequest = useCallback(
    async (sourceUserId: number) => {
      if (acceptingIds.has(sourceUserId)) {
        return;
      }

      const previous = results.find((item) => item.id === sourceUserId);
      setAcceptingIds((prev) => new Set(prev).add(sourceUserId));

      if (previous) {
        updateResult(sourceUserId, (item) => ({
          ...item,
          status: "friends",
        }));
      }

      try {
        const response = await fetch("/api/friend/request", {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fromUserId: sourceUserId }),
        });

        if (!response.ok) {
          throw new Error(`Accept failed with status ${response.status}`);
        }

        const data = await response.json();
        updateResult(sourceUserId, (item) => ({
          ...item,
          status: "friends",
          requestId: data?.request?.id ?? item.requestId,
          requesterId: data?.request?.from_id ?? item.requesterId,
          addresseeId: data?.request?.to_id ?? item.addresseeId,
        }));
      } catch (err) {
        console.error("Accept friend request error:", err);
        if (previous) {
          updateResult(sourceUserId, () => previous);
        }
        setError("Unable to accept friend request");
      } finally {
        setAcceptingIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceUserId);
          return next;
        });
      }
    },
    [acceptingIds, results, updateResult],
  );

  const state = useMemo(
    () => ({
      query,
      setQuery,
      results,
      isSearching,
      error,
      requestingIds,
      cancelingIds,
      acceptingIds,
      sendFriendRequest,
      cancelFriendRequest,
      acceptFriendRequest,
      lastQuery: lastQueryRef.current,
    }),
    [
      query,
      results,
      isSearching,
      error,
      requestingIds,
      cancelingIds,
      sendFriendRequest,
      cancelFriendRequest,
      acceptingIds,
      acceptFriendRequest,
    ],
  );

  const handleRealtime = useCallback(
    (event: FriendRealtimeEvent) => {
      if (!user) {
        return;
      }

      const currentUserId = user.id;

      if (event.type === "friend_request_sent") {
        if (event.request.from_id === currentUserId) {
          updateResult(event.request.to_id, (item) => ({
            ...item,
            status: "outgoing",
            requestId: event.request.id,
            requesterId: event.request.from_id,
            addresseeId: event.request.to_id,
          }));
          setRequestingIds((prev) => {
            const next = new Set(prev);
            next.delete(event.request.to_id);
            return next;
          });
        } else if (event.request.to_id === currentUserId) {
          updateResult(event.request.from_id, (item) => ({
            ...item,
            status: "incoming",
            requestId: event.request.id,
            requesterId: event.request.from_id,
            addresseeId: event.request.to_id,
          }));
        }
      } else if (event.type === "friend_request_cancelled") {
        if (event.fromUserId === currentUserId) {
          updateResult(event.toUserId, (item) => ({
            ...item,
            status: "none",
            requestId: null,
            requesterId: null,
            addresseeId: null,
          }));
          setCancelingIds((prev) => {
            const next = new Set(prev);
            next.delete(event.toUserId);
            return next;
          });
        } else if (event.toUserId === currentUserId) {
          updateResult(event.fromUserId, (item) => ({
            ...item,
            status: "none",
            requestId: null,
            requesterId: null,
            addresseeId: null,
          }));
        }
      } else if (event.type === "friend_request_accepted") {
        if (event.request.from_id === currentUserId) {
          updateResult(event.request.to_id, (item) => ({
            ...item,
            status: "friends",
            requestId: event.request.id,
            requesterId: event.request.from_id,
            addresseeId: event.request.to_id,
          }));
        } else if (event.request.to_id === currentUserId) {
          updateResult(event.request.from_id, (item) => ({
            ...item,
            status: "friends",
            requestId: event.request.id,
            requesterId: event.request.from_id,
            addresseeId: event.request.to_id,
          }));
        }
      }
    },
    [updateResult, user],
  );

  useFriendRealtime(handleRealtime);

  return state;
}
