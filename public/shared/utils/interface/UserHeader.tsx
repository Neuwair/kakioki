"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faTimes,
  faCheck,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { SafeImage } from "@/public/shared/utils/chat/MessageMedia";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import {
  useFriendRealtime,
  type PresenceStatus,
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

function getPresencePresentation(status: PresenceStatus) {
  const isOnline = status === "online";
  const isAway = status === "away";

  return {
    label: isOnline ? "Online" : isAway ? "Away" : "Offline",
    labelColor: isOnline
      ? "text-emerald-200"
      : isAway
        ? "text-amber-200"
        : "text-rose-200",
    dotColor: isOnline
      ? "bg-emerald-400"
      : isAway
        ? "bg-amber-400"
        : "bg-rose-400",
    haloColor: isOnline
      ? "bg-emerald-400/60"
      : isAway
        ? "bg-amber-400/50"
        : "bg-rose-400/50",
    dotAnimation: isOnline ? "animate-pulse" : "",
    haloAnimation: isOnline
      ? "motion-safe:animate-[ping_1.8s_ease-in-out_infinite]"
      : "",
  };
}

const PresenceDot: React.FC<{ status: PresenceStatus }> = ({ status }) => {
  const presentation = getPresencePresentation(status);

  return (
    <span aria-hidden="true" className="relative flex h-2.5 w-2.5 shrink-0">
      <span
        className={`absolute inline-flex h-full w-full rounded-full ${presentation.haloColor} ${presentation.haloAnimation}`}
      ></span>
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${presentation.dotColor} ${presentation.dotAnimation}`}
      ></span>
    </span>
  );
};

const UserPresenceStatus: React.FC<{
  userId: number | null;
  className?: string;
  textClassName?: string;
}> = ({ userId, className = "", textClassName = "text-sm" }) => {
  const presence = useUserPresence(userId);
  const resolvedStatus = presence.isReady ? presence.status : "offline";
  const presentation = getPresencePresentation(resolvedStatus);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 ${presentation.labelColor} ${textClassName} ${className}`.trim()}
    >
      <PresenceDot status={resolvedStatus} />
      {presentation.label}
    </div>
  );
};

export const ChatUserHeader: React.FC<{
  selectedFriend?: SelectedFriendPreview | null;
  showPreview?: boolean;
  onClose?: () => void;
  actions?: React.ReactNode;
}> = ({ selectedFriend, showPreview = false, onClose, actions = null }) => {
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
        <p className="text-xs sm:text-sm lg:text-2xl text-neutral-50/70 font-medium cursor-default">
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

  return (
    <div className="bg-white/5 flex-col flex sticky top-0 z-20 user-header shadow-[0_9px_12px_-4px_rgba(0,0,0,0.20)]">
      <div className="p-3 flex b flex-row flex-wrap items-center gap-2">
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
                  className="text-neutral-50/70 text-lg sm:text-lg lg:text-2xl"
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
          <h3 className="text-sm sm:text-lg text-neutral-50">
            {selectedFriend.username}
          </h3>
          <UserPresenceStatus
            userId={selectedFriend.id}
            className="text-neutral-50/60 text-xs sm:text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation"
            className="w-10 h-10 p-2 rounded-lg bg-white/5 hover:bg-neutral-700/50 text-neutral-50 flex items-center justify-center cursor-pointer transition-all duration-200 interface-btn text-xs sm:text-sm"
          >
            <FontAwesomeIcon aria-hidden="true" icon={faTimes} className="text-lg sm:text-sm" />
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
                className="text-neutral-50/70 text-lg sm:text-lg lg:text-2xl"
              />
            )}
          </div>
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <div className="h-full text-xs sm:text-lg flex items-center text-neutral-50 cursor-default">
              {previewUsername}
            </div>
            <div className="h-full text-xs sm:text-lg flex items-center text-neutral-50/70 cursor-default">
              ID: {previewUserId}
            </div>
          </div>
        </div>
        <div className="flex flex-1 min-w-0">
          <div className="w-full items-center justify-center flex text-xs sm:text-sm lg:text-lg text-neutral-50/70 wrap-break-word whitespace-pre-wrap cursor-default">
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const openAvatarModal = useCallback(() => setIsAvatarModalOpen(true), []);
  const closeAvatarModal = useCallback(() => setIsAvatarModalOpen(false), []);
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, logout]);

  return (
    <>
      <div className="flex flex-row flex-wrap items-center justify-between">
        <div>
          <h2 className="text-lg lg:text-4xl font-bold text-neutral-50 cursor-default">
            KAKiOKi
          </h2>
        </div>
        <div className="flex flex-row flex-wrap rounded-full bg-white/5 border border-white/20 pl-4 gap-2">
          <div className="flex flex-col flex-wrap justify-center items-end text-right rounded-full">
            <h3 className="text-xs lg:text-sm text-neutral-50 cursor-default">
              {user ? user.username : "Your Username"}
            </h3>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Logging out" : "Log out"}
              className="flex text-xs lg:text-sm text-neutral-50/60 hover:text-neutral-50 cursor-pointer items-center no-theme"
            >
              <div className="flex flex-row justify-center items-center align-middle gap-1">
                <FontAwesomeIcon
                  icon={faSignOutAlt}
                  aria-hidden="true"
                  className="text-xs lg:text-sm"
                />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </div>
            </button>
          </div>
          <div className=" flex flex-col flex-wrap justify-center">
            <button
              type="button"
              className="w-10 h-10 sm:w-11 sm:h-11 lg:w-13 lg:h-13 rounded-full bg-white/5 border border-white/20 flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={openAvatarModal}
              title="Change profile picture"
              aria-label="Change profile picture"
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
                  aria-hidden="true"
                  className="text-neutral-50/70 text-lg sm:text-lg lg:text-2xl"
                />
              )}
            </button>
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
  friend: {
    id: number;
    username: string;
    avatar_url?: string | null;
    avatarUrl?: string;
  };
  onClick?: () => void;
}> = ({ friend, onClick }) => {
  const resolvedStatusUserId = friend.id ?? null;
  const avatar = friend.avatar_url ?? friend.avatarUrl ?? undefined;
  return (
    <div
      role="button"
      aria-label={`Open conversation with ${friend.username}`}
      className="flex flex-col justify-center relative shrink-0 w-20 h-30 cursor-pointer group bouncy-hover"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      title={friend.username}
      tabIndex={0}
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-center">
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
                className="text-neutral-50/70 text-lg sm:text-lg lg:text-2xl"
              />
            )}
          </div>
        </div>
        <span className="text-xs sm:text-lg text-neutral-50 truncate w-full text-center flex justify-center">
          {friend.username}
        </span>
        <UserPresenceStatus
          userId={resolvedStatusUserId}
          className="flex justify-center"
          textClassName="text-neutral-50/60 text-xs sm:text-sm"
        />
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
        <div role="status" aria-live="polite" className="flex items-center gap-3 min-h-20 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-neutral-50/60 my-2 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-white/10" />
          <div className="flex-1 h-6 bg-white/10 rounded" />
          <span className="sr-only">Loading friends</span>
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="relative overflow-hidden">
        <div className="flex items-center justify-center min-h-20 p-4 rounded-lg bg-white/5 border border-white/10 text-neutral-50/60 my-2">
          <p className="text-xs sm:text-sm lg:text-2xl text-center">
            You don&apos;t have any friends yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollRef}
        aria-label="Friends list"
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
                  id: entry.user.id,
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
          <div className="text-neutral-50/80 py-4 flex items-center justify-between cursor-default">
            <span className="text-xs sm:text-sm lg:text-2xl text-neutral-50/50">
              Friend Requests ({incomingCount})
            </span>
            {outgoingCount > 0 && (
              <span className="text-xs sm:text-sm lg:text-2xl text-neutral-50/50">
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
                    <p className="text-neutral-50 text-xs sm:text-lg lg:text-2xl">
                      {entry.user.username}
                    </p>
                    <p className="text-neutral-50/60 text-xs sm:text-sm lg:text-lg">
                      wants to connect
                    </p>
                  </div>
                  <div className="flex flex-row gap-4 items-center flex-wrap">
                    <button
                      type="button"
                      className="px-5 p-2 bg-lime-700 hover:bg-lime-800 text-neutral-50 rounded-md text-xs sm:text-sm flex items-center gap-1 accept-friend-btn"
                      onClick={() => onAccept(entry.user.id)}
                      aria-label={`Accept friend request from ${entry.user.username}`}
                      disabled={isAccepting}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        {isAccepting ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin text-xs sm:text-sm lg:text-sm" />
                        ) : (
                          <FontAwesomeIcon
                            icon={faCheck}
                            className="text-lg sm:text-sm"
                          />
                        )}
                        {isAccepting ? "Accepting" : "Accept"}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="px-5 p-2 bg-red-700 hover:bg-red-800 text-neutral-50 rounded-md text-xs sm:text-sm flex items-center gap-1 remove-friend-btn"
                      onClick={() => onDecline(entry.user.id)}
                      aria-label={`Decline friend request from ${entry.user.username}`}
                      disabled={isDeclining}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        {isDeclining ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin text-xs sm:text-sm lg:text-sm" />
                        ) : (
                          <FontAwesomeIcon
                            icon={faTimes}
                            className="text-lg sm:text-sm"
                          />
                        )}
                        {isDeclining ? "Removing" : "Decline"}
                      </div>
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
                    <p className="text-neutral-50 text-sm sm:text-lg">
                      {entry.user.username}
                    </p>
                    <p className="text-neutral-50/60 text-xs sm:text-sm">
                      awaiting response
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-5 p-2 bg-amber-600 hover:bg-amber-700 text-neutral-50 rounded-md text-xs sm:text-sm flex items-center gap-1 cancel-btn"
                    onClick={() => onCancel(entry.user.id)}
                    aria-label={`Cancel outgoing friend request to ${entry.user.username}`}
                    disabled={isCanceling}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      {isCanceling ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FontAwesomeIcon
                          icon={faTimes}
                          className="text-lg sm:text-sm"
                        />
                      )}
                      {isCanceling ? "Cancelling" : "Cancel"}
                    </div>
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
