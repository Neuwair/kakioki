"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faTimes,
  faUser,
  faUserPlus,
  faUserCheck,
  faCheck,
  faUserGear,
} from "@fortawesome/free-solid-svg-icons";
import { SafeImage } from "@/public/shared/utils/chat/MessageMedia";
import type { FriendSearchItem } from "@/public/shared/hooks/UserSearch";
import { useFriendSearch } from "@/public/shared/hooks/UserSearch";
import { UserInfoHeader } from "@/public/shared/utils/interface/UserHeader";
import {
  FriendListHeader,
  FriendRequestsHeader,
} from "@/public/shared/utils/interface/UserHeader";
import { useFriendRelationships } from "@/public/shared/hooks/FriendRelationships";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";
import ThemeToggle from "@/public/shared/utils/theme/ThemeToggle";

interface FriendSearchDropdownProps {
  query: string;
  results: FriendSearchItem[];
  isSearching: boolean;
  error: string | null;
  requestingIds: Set<number>;
  cancelingIds: Set<number>;
  acceptingIds: Set<number>;
  onAdd: (userId: number) => void;
  onCancel: (userId: number) => void;
  onAccept: (userId: number) => void;
}

function renderAvatar(avatarUrl?: string, username?: string) {
  if (avatarUrl) {
    return (
      <div className="relative w-full h-full">
        <SafeImage
          src={avatarUrl}
          alt={`${username ?? "User"}'s avatar`}
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <FontAwesomeIcon
      icon={faUser}
      className="text-neutral-50/70 text-lg sm:text-sm"
    />
  );
}

export const FriendSearchDropdown: React.FC<FriendSearchDropdownProps> = ({
  query,
  results,
  isSearching,
  error,
  requestingIds,
  cancelingIds,
  acceptingIds,
  onAdd,
  onCancel,
  onAccept,
}) => {
  if (error) {
    return <div role="alert" aria-live="assertive" className="px-4 py-3 text-sm text-red-400">{error}</div>;
  }

  if (isSearching) {
    return (
      <div role="status" aria-live="polite" className="flex justify-center items-center py-6">
        <span aria-hidden="true" className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
        <span className="sr-only">Searching for users</span>
      </div>
    );
  }

  if (results.length === 0) {
    if (query.trim().length === 0) {
      return (
        <div className="text-center text-neutral-50/70 bg-transparent py-6 text-xs sm:text-sm lg:text-2xl dropdown-ui">
          Start typing to search for users
        </div>
      );
    }
    return (
      <div className="text-center text-neutral-50/70 bg-transparent py-6 text-xs sm:text-sm lg:text-2xl dropdown-ui">
        No users found matching “{query.trim()}”
      </div>
    );
  }

  return (
    <ul aria-label="Friend search results" className="divide-y divide-white/10">
      {results.map((user) => {
        const isRequesting = requestingIds.has(user.id);
        const isCanceling = cancelingIds.has(user.id);
        const isAccepting = acceptingIds.has(user.id);

        return (
          <li
            key={user.id}
            className="flex flex-row flex-wrap items-center justify-between px-4 p-4 gap-1 hover:bg-black/20 transition-colors"
          >
            <div className="flex flex-row flex-wrap gap-4 justify-center align-middle items-center">
              <div className="w-15 h-15 rounded-full border border-white/20 flex items-center justify-center overflow-hidden">
                {renderAvatar(user.avatarUrl, user.username)}
              </div>
              <div className="flex flex-col justify-center flex-wrap">
                <h3 className="text-neutral-50 text-xs sm:text-lg lg:text-2xl">
                  {user.username}
                </h3>
                <p className="text-neutral-50/60 text-xs sm:text-sm lg:text-lg">
                  ID: {user.userId}
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-4 items-center flex-wrap">
              {user.status === "friends" && (
                <span className="px-5 p-2 bg-lime-700 text-neutral-50 rounded-md text-xs sm:text-sm lg:text-2xl flex items-center gap-1 cursor-default">
                  <FontAwesomeIcon
                    icon={faUserCheck}
                    className="text-lg sm:text-sm"
                  />
                  Friends
                </span>
              )}
              {user.status === "outgoing" && (
                <button
                  type="button"
                  className="px-5 p-2 border border-white/20 hover:bg-red-800 text-neutral-50 rounded-md flex items-center gap-1 cancel-btn text-xs sm:text-sm"
                  onClick={() => onCancel(user.id)}
                  aria-label={`Cancel friend request to ${user.username}`}
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
              )}
              {user.status === "incoming" && (
                <button
                  type="button"
                  className="px-5 p-2 bg-lime-700 hover:bg-lime-800 text-neutral-50 rounded-md flex items-center gap-1 accept-friend-btn text-xs sm:text-sm"
                  onClick={() => onAccept(user.id)}
                  aria-label={`Accept friend request from ${user.username}`}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-lg sm:text-sm"
                    />
                  )}
                  Accept
                </button>
              )}
              {user.status === "none" && (
                <button
                  type="button"
                  className="px-5 p-2 border border-white/20 bg-white/5 hover:bg-neutral-700/50 text-neutral-50 rounded-lg flex items-center gap-1 interface-btn text-xs sm:text-sm"
                  onClick={() => onAdd(user.id)}
                  aria-label={`Send friend request to ${user.username}`}
                  disabled={isRequesting}
                >
                  <div className="flex items-center gap-2 justify-center">
                    {isRequesting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FontAwesomeIcon
                        icon={faUserPlus}
                        className="text-lg sm:text-sm"
                      />
                    )}
                    {isRequesting ? "Sending request" : "Add"}
                  </div>
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export const FriendSearchHeader: React.FC<{}> = () => {
  const router = useRouter();
  const {
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
  } = useFriendSearch();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const listener = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
    };
  }, [isOpen]);

  const showDropdown =
    isOpen && (query.trim().length > 0 || isSearching || !!error);

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSearchButtonClick = () => {
    if (query.trim()) {
      setIsOpen((prev) => !prev);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSearchClear = () => {
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative transition-all duration-300" ref={containerRef}>
      <div className="flex flex-row flex-wrap gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            id="friend-search-header-input"
            name="friendSearchHeader"
            aria-label="Search for friends"
            aria-controls="friend-search-dropdown"
            placeholder="Search a friend"
            autoComplete="off"
            maxLength={10}
            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-neutral-50 placeholder-amber-50/50 searchbar-item text-xs sm:text-sm lg:text-2xl"
            value={query}
            onChange={(e) => {
              const newQuery = e.target.value;
              setQuery(newQuery);
              if (!newQuery.trim()) {
                setIsOpen(false);
              } else if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onFocus={handleInputFocus}
          />
          {query && (
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-50/50 hover:text-neutral-50 w-8 h-8 flex items-center justify-center rounded-lg"
              onClick={handleSearchClear}
              aria-label="Clear search"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faTimes} className="text-lg sm:text-sm" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="w-10 h-10 p-2 rounded-lg hover:bg-neutral-700/50 text-neutral-50 border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer interface-btn"
          onClick={handleSearchButtonClick}
          aria-label={showDropdown ? "Close friend search results" : "Open friend search results"}
          aria-expanded={showDropdown}
          aria-controls="friend-search-dropdown"
        >
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            aria-hidden="true"
            className="text-lg sm:text-sm"
          />
        </button>
        <button
          type="button"
          className="w-10 h-10 p-2 rounded-lg hover:bg-neutral-700/50 text-neutral-50 border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer interface-btn"
          onClick={() => router.push("/settings")}
          aria-label="Open settings"
        >
          <FontAwesomeIcon aria-hidden="true" icon={faUserGear} className="text-lg sm:text-sm" />
        </button>
        <ThemeToggle />
      </div>

      {showDropdown && (
        <div id="friend-search-dropdown" role="region" aria-label="Friend search results" className="absolute z-50 mt-3 w-full backdrop-blur-sm bg-white/20 border border-white/20 rounded-lg shadow-lg max-h-50 overflow-y-auto scrollbar-hide dropdown-ui animate-dropdown-appear">
          <FriendSearchDropdown
            query={query}
            results={results}
            isSearching={isSearching}
            error={error}
            requestingIds={requestingIds}
            cancelingIds={cancelingIds}
            acceptingIds={acceptingIds}
            onAdd={sendFriendRequest}
            onCancel={cancelFriendRequest}
            onAccept={acceptFriendRequest}
          />
        </div>
      )}
    </div>
  );
};

interface ChatHeaderProps {
  onSelectFriend?: (friend: FriendListEntry) => void;
  isCollapsed?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onSelectFriend,
  isCollapsed = false,
}) => {
  const {
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
  } = useFriendRelationships();

  return (
    <div
      className={`bg-white/5 header-background transition-all duration-300 ${isCollapsed ? "p-3" : "p-3 pb-6"}`}
    >
      <div className="flex flex-col gap-4">
        <UserInfoHeader />
        {!isCollapsed && (
          <>
            <FriendSearchHeader />
            {error && <div role="alert" aria-live="assertive" className="text-sm text-red-400 px-2">{error}</div>}
            <FriendListHeader
              friends={friends}
              isLoading={isLoading}
              onSelect={onSelectFriend}
            />
            <FriendRequestsHeader
              incoming={incoming}
              outgoing={outgoing}
              acceptingIds={acceptingIds}
              cancelingIds={cancelingIds}
              decliningIds={decliningIds}
              onAccept={acceptRequest}
              onDecline={declineIncoming}
              onCancel={cancelOutgoing}
            />
          </>
        )}
      </div>
    </div>
  );
};
