"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faTimes,
  faCheck,
  faSpinner,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { SafeImage } from "@/public/shared/utils/chat/MessageMedia";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import {
  useFriendRealtime,
  useUserPresence,
} from "@/public/shared/logic/UserPresenceRealtime";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";
import { AvatarUploadModal } from "@/public/shared/utils/interface/AvatarSelection";
import { useAuth } from "@/lib/auth/ClientAuth";

type SelectedFriendPreview = {
  id: number;
  username: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  userId?: string;
  bio?: string | null;
};

type FriendProfile = {
  id: number;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

type FriendProfileResponse = {
  success?: boolean;
  friend?: FriendProfile;
  error?: string;
};

function resolveBio(bio: string | null | undefined): string {
  const trimmed = bio?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : KAKIOKI_CONFIG.account.defaultBio;
}

export const ChatUserHeader: React.FC<{
  selectedFriend?: SelectedFriendPreview | null;
  showPreview?: boolean;
  onClose?: () => void;
  actions?: React.ReactNode;
}> = ({ selectedFriend, showPreview = false, onClose, actions = null }) => {
  const presence = useUserPresence(selectedFriend?.id ?? null);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(
    null,
  );

  useEffect(() => {
    if (!selectedFriend) {
      return;
    }

    const controller = new AbortController();

    const fetchFriendProfile = async () => {
      try {
        const response = await fetch(
          `/api/friend/profile?friendId=${selectedFriend.id}`,
          {
            headers: getAuthHeaders(),
            signal: controller.signal,
          },
        );

        const data = (await response
          .json()
          .catch(() => ({}))) as FriendProfileResponse;

        if (!response.ok || !data.friend) {
          return;
        }

        setFriendProfile({
          ...data.friend,
          bio: resolveBio(data.friend.bio),
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
      }
    };

    void fetchFriendProfile();

    return () => {
      controller.abort();
    };
  }, [selectedFriend]);

  useFriendRealtime(
    useCallback(
      (event) => {
        if (
          event.type !== "friend_profile_updated" ||
          !selectedFriend ||
          event.user.id !== selectedFriend.id
        ) {
          return;
        }

        setFriendProfile((previous) => ({
          id: event.user.id,
          userId: event.user.user_id,
          username: event.user.username,
          avatarUrl: event.user.avatar_url ?? previous?.avatarUrl ?? undefined,
          bio: resolveBio(event.user.bio ?? previous?.bio),
        }));
      },
      [selectedFriend],
    ),
  );

  if (!selectedFriend) {
    return (
      <div className=" bg-white/5 sticky top-0 z-20 min-h-20 flex items-center justify-center user-header">
        <p className="text-lg text-neutral-50/70 font-medium cursor-default">
          Select a friend to start a message
        </p>
      </div>
    );
  }

  const resolvedFriendProfile =
    friendProfile?.id === selectedFriend.id ? friendProfile : null;
  const previewAvatar =
    resolvedFriendProfile?.avatarUrl ??
    selectedFriend.avatar_url ??
    selectedFriend.avatarUrl ??
    undefined;
  const previewUsername =
    resolvedFriendProfile?.username ?? selectedFriend.username;
  const previewUserId =
    resolvedFriendProfile?.userId || selectedFriend.userId || "----";
  const previewBio = resolveBio(
    resolvedFriendProfile?.bio ?? selectedFriend.bio,
  );

  const statusContent = (() => {
    if (!presence.isReady) {
      return (
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-100/80">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-600 "></span>
          </span>
          Checking status…
        </div>
      );
    }

    const isOnline = presence.status === "online";
    const isAway = presence.status === "away";
    const label = isOnline ? "Online" : isAway ? "Away" : "Offline";
    const labelColor = isOnline
      ? "text-emerald-200"
      : isAway
        ? "text-amber-200"
        : "text-rose-200";
    const dotColor = isOnline
      ? "bg-emerald-400"
      : isAway
        ? "bg-amber-400"
        : "bg-rose-400";
    const haloColor = isOnline
      ? "bg-emerald-400/60"
      : isAway
        ? "bg-amber-400/50"
        : "bg-rose-400/50";
    const dotAnimation = isOnline ? "animate-pulse" : "";

    return (
      <div className={`mt-1 flex items-center gap-2 text-sm ${labelColor}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${haloColor} ${isOnline ? "motion-safe:animate-[ping_1.8s_ease-in-out_infinite]" : ""}`}
          ></span>
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor} ${dotAnimation}`}
          ></span>
        </span>
        {label}
      </div>
    );
  })();

  return (
    <div className="bg-white/5 flex-col flex sticky top-0 z-20 user-header shadow-[0_9px_12px_-4px_rgba(0,0,0,0.20)]">
      <div className="p-3 flex flex-row flex-wrap items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/20 overflow-hidden flex items-center justify-center">
          {(() => {
            const avatar =
              selectedFriend.avatar_url ??
              selectedFriend.avatarUrl ??
              undefined;
            if (!avatar) {
              return (
                <FontAwesomeIcon
                  icon={faUser}
                  size="lg"
                  className="text-neutral-50/70"
                />
              );
            }
            return (
              <div className="relative w-full h-full">
                <SafeImage
                  src={avatar}
                  alt={`${selectedFriend.username}'s avatar`}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            );
          })()}
        </div>
        <div className="flex-1 cursor-default">
          <h3 className=" text-lg text-neutral-50">
            {selectedFriend.username}
          </h3>
          {statusContent}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-neutral-700/50 text-neutral-50 flex items-center justify-center cursor-pointer transition-all duration-200 interface-btn"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>
      </div>
      <div
        aria-hidden={!showPreview}
        className={
          showPreview
            ? "flex flex-row-reverse items-center animate-preview-fade-in"
            : "flex flex-row-reverse items-center max-h-0 overflow-hidden opacity-0 pointer-events-none animate-preview-fade-out"
        }
      >
        <div className="flex flex-col p-4 gap-2 align-middle justify-center items-center shrink-0">
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/20 overflow-hidden flex items-center justify-center">
            {previewAvatar ? (
              <div className="relative w-full h-full">
                <SafeImage
                  src={previewAvatar}
                  alt={`${previewUsername}'s avatar`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : (
              <FontAwesomeIcon
                icon={faUser}
                size="2x"
                className="text-neutral-50/70"
              />
            )}
          </div>
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <div className="h-full text-sm flex items-center text-neutral-50 cursor-default">
              {previewUsername}
            </div>
            <div className="h-full text-sm flex items-center text-neutral-50/70 cursor-default">
              ID: {previewUserId}
            </div>
          </div>
        </div>
        <div className="flex flex-1 min-w-0">
          <div className="w-full items-center justify-center flex text-sm text-neutral-50/70 wrap-break-word whitespace-pre-wrap cursor-default">
            {previewBio}
          </div>
        </div>
      </div>
    </div>
  );
};

export const UserInfoHeader: React.FC<{}> = () => {
  const { logout, user } = useAuth();
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const openAvatarModal = useCallback(() => setIsAvatarModalOpen(true), []);
  const closeAvatarModal = useCallback(() => setIsAvatarModalOpen(false), []);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-50 cursor-default">
            Kakioki
          </h2>
        </div>
        <div className="flex flex-row flex-wrap gap-2">
          <div className="flex flex-col flex-wrap justify-center text-right">
            <h3 className="text-sm text-neutral-50 cursor-default">
              {user ? user.username : "Your Username"}
            </h3>
            <button
              onClick={logout}
              className="text-xs text-neutral-50/60 hover:text-neutral-50 border-none cursor-pointer flex items-center gap-1 mt-1 no-theme"
            >
              <FontAwesomeIcon icon={faSignOutAlt} size="xs" />
              Logout
            </button>
          </div>
          <div className="flex flex-col flex-wrap justify-center">
            <div
              className="w-10 h-10 rounded-full bg-white/5 border border-white/20 flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={openAvatarModal}
              title="Change profile picture"
            >
              {user?.avatarUrl ? (
                <div className="relative w-full h-full">
                  <SafeImage
                    src={user.avatarUrl}
                    alt={`${user.username}'s avatar`}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <FontAwesomeIcon
                  icon={faUser}
                  size="lg"
                  className="text-neutral-50/70"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <AvatarUploadModal
        isOpen={isAvatarModalOpen}
        onClose={closeAvatarModal}
      />
    </>
  );
};

export const FriendItem: React.FC<{
  friend: { username: string; avatar_url?: string | null; avatarUrl?: string };
  onClick?: () => void;
}> = ({ friend, onClick }) => {
  const avatar = friend.avatar_url ?? friend.avatarUrl ?? undefined;
  return (
    <div
      className="relative shrink-0 w-20 h-20 mx-2 cursor-pointer group bouncy-hover"
      onClick={onClick}
      title={friend.username}
      tabIndex={0}
    >
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:transform group-hover:scale-110">
          {avatar ? (
            <div className="relative w-full h-full">
              <SafeImage
                src={avatar}
                alt={`${friend.username}'s avatar`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          ) : (
            <FontAwesomeIcon
              icon={faUser}
              size="lg"
              className="text-neutral-50/70"
            />
          )}
        </div>
        <span className="text-sm text-neutral-50 mt-1 truncate w-full text-center">
          {friend.username}
        </span>
      </div>
    </div>
  );
};

interface FriendListHeaderProps {
  friends: FriendListEntry[];
  isLoading: boolean;
  onSelect?: (friend: FriendListEntry) => void;
}

export const FriendListHeader: React.FC<FriendListHeaderProps> = ({
  friends,
  isLoading,
  onSelect,
}) => {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = React.useState(false);
  const lastScrollTime = React.useRef(0);

  const checkScrollability = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      const hasScrollableContent = el.scrollWidth > el.clientWidth;
      setCanScroll(hasScrollableContent);
    }
  }, []);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      const el = scrollRef.current;
      if (!el) return;

      const now = Date.now();
      if (now - lastScrollTime.current < 16) return;
      lastScrollTime.current = now;

      if (canScroll && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        event.stopPropagation();

        const scrollAmount = event.deltaY * 2.5;
        el.scrollBy({
          left: scrollAmount,
          behavior: "smooth",
        });
      }
    },
    [canScroll],
  );

  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    checkScrollability();
    const resizeObserver = new ResizeObserver(checkScrollability);
    resizeObserver.observe(element);

    const timeoutId = setTimeout(() => {
      const listener = (event: WheelEvent) => handleWheel(event);
      element.addEventListener("wheel", listener, {
        passive: false,
        capture: true,
      });
      return () => {
        element.removeEventListener("wheel", listener, true);
      };
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [handleWheel, checkScrollability]);

  React.useEffect(() => {
    checkScrollability();
  }, [friends, checkScrollability]);
  if (isLoading) {
    return (
      <div className="relative overflow-hidden">
        <div className="flex items-center gap-3 min-h-20 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-neutral-50/60 my-2 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-white/10" />
          <div className="flex-1 h-6 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="relative overflow-hidden">
        <div className="flex items-center justify-center min-h-20 p-4 rounded-lg bg-white/5 border border-white/10 text-neutral-50/60 my-2">
          <p className="text-center">You don&apos;t have any friends yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollbarGutter: "stable",
          scrollBehavior: "smooth",
        }}
      >
        <div className="inline-block min-w-full p-4 rounded-lg bg-white/5 border border-white/10 text-neutral-50">
          <div className="flex flex-row items-center whitespace-nowrap">
            {friends.map((entry) => (
              <FriendItem
                key={entry.user.id}
                friend={{
                  username: entry.user.username,
                  avatarUrl: entry.user.avatarUrl,
                }}
                onClick={() => onSelect?.(entry)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FriendRequestsHeaderProps {
  incoming: FriendListEntry[];
  outgoing: FriendListEntry[];
  acceptingIds: Set<number>;
  cancelingIds: Set<number>;
  decliningIds: Set<number>;
  onAccept: (fromUserId: number) => void;
  onDecline: (fromUserId: number) => void;
  onCancel: (toUserId: number) => void;
}

export const FriendRequestsHeader: React.FC<FriendRequestsHeaderProps> = ({
  incoming,
  outgoing,
  acceptingIds,
  cancelingIds,
  decliningIds,
  onAccept,
  onDecline,
  onCancel,
}) => {
  const incomingCount = incoming.length;
  const outgoingCount = outgoing.length;

  return (
    <>
      {incomingCount > 0 || outgoingCount > 0 ? (
        <div className="flex flex-col flex-wrap relative animate-alert-bounce-in">
          <div className="text-neutral-50/80 text-sm font-medium px-4 p-4 flex items-center justify-between cursor-default">
            <span>Friend Requests ({incomingCount})</span>
            {outgoingCount > 0 && (
              <span className="text-xs text-neutral-50/50">
                Outgoing: {outgoingCount}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {incoming.map((entry) => {
              const isAccepting = acceptingIds.has(entry.user.id);
              const isDeclining = decliningIds.has(entry.user.id);
              return (
                <div
                  key={`incoming-${entry.user.id}`}
                  className="flex flex-row flex-wrap items-center justify-between px-4 py-4 bg-white/5 border border-white/10 rounded-lg animate-alert-bounce-in"
                >
                  <div className="flex flex-col flex-wrap">
                    <p className="text-neutral-50">{entry.user.username}</p>
                    <p className="text-neutral-50/60 text-sm">
                      wants to connect
                    </p>
                  </div>
                  <div className="flex flex-row gap-4 items-center flex-wrap">
                    <button
                      type="button"
                      className="px-5 p-2 bg-lime-700 hover:bg-lime-800 text-neutral-50 rounded-md text-sm flex items-center gap-1 accept-friend-btn"
                      onClick={() => onAccept(entry.user.id)}
                      disabled={isAccepting}
                    >
                      {isAccepting ? (
                        <FontAwesomeIcon
                          icon={faSpinner}
                          size="lg"
                          className="text-neutral-50/70 animate-spin"
                        />
                      ) : (
                        <FontAwesomeIcon icon={faCheck} />
                      )}
                      {isAccepting ? "Accepting" : "Accept"}
                    </button>
                    <button
                      type="button"
                      className="px-5 p-2 bg-red-700 hover:bg-red-800 text-neutral-50 rounded-md text-sm flex items-center gap-1 remove-friend-btn"
                      onClick={() => onDecline(entry.user.id)}
                      disabled={isDeclining}
                    >
                      {isDeclining ? (
                        <FontAwesomeIcon
                          icon={faSpinner}
                          size="lg"
                          className="text-neutral-50/70 animate-spin"
                        />
                      ) : (
                        <FontAwesomeIcon icon={faTimes} />
                      )}
                      {isDeclining ? "Removing" : "Decline"}
                    </button>
                  </div>
                </div>
              );
            })}

            {outgoing.map((entry) => {
              const isCanceling = cancelingIds.has(entry.user.id);
              return (
                <div
                  key={`outgoing-${entry.user.id}`}
                  className="flex flex-row flex-wrap items-center justify-between px-4 py-4 bg-white/5 border border-white/10 rounded-lg animate-alert-bounce-in"
                >
                  <div className="flex flex-col flex-wrap">
                    <p className="text-neutral-50">{entry.user.username}</p>
                    <p className="text-neutral-50/60 text-sm">
                      awaiting response
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-5 p-2 bg-amber-600 hover:bg-amber-700 text-neutral-50 rounded-md text-sm flex items-center gap-1 cancel-btn"
                    onClick={() => onCancel(entry.user.id)}
                    disabled={isCanceling}
                  >
                    {isCanceling ? (
                      <FontAwesomeIcon
                        icon={faSpinner}
                        size="lg"
                        className="text-neutral-50/70 animate-spin"
                      />
                    ) : (
                      <FontAwesomeIcon icon={faTimes} />
                    )}
                    {isCanceling ? "Cancelling" : "Cancel"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
};
