"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faUser,
  faUserPlus,
  faUserCheck,
  faSpinner,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { SafeImage } from "@/public/shared/Utils/Props/MediaProps";
import type { FriendSearchItem } from "@/public/shared/hooks/useFriendSearch";

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
    <FontAwesomeIcon icon={faUser} size="lg" className="text-amber-50/70" />
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
    return <div className="px-4 py-3 text-sm text-red-400">{error}</div>;
  }

  if (isSearching) {
    return (
      <div className="flex justify-center items-center py-6">
        <FontAwesomeIcon
          icon={faSpinner}
          size="lg"
          className="text-amber-50/70 animate-spin"
        />
      </div>
    );
  }

  if (results.length === 0) {
    if (query.trim().length === 0) {
      return (
        <div className="text-center text-amber-50/70 bg-white/5 py-6 text-sm">
          Start typing to search for users
        </div>
      );
    }
    return (
      <div className="text-center text-amber-50/70 bg-white/5 py-6 text-sm">
        No users found matching “{query.trim()}”
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/10">
      {results.map((user) => {
        const isRequesting = requestingIds.has(user.id);
        const isCanceling = cancelingIds.has(user.id);
        const isAccepting = acceptingIds.has(user.id);

        return (
          <li
            key={user.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-white/10 transition-colors backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center overflow-hidden">
                {renderAvatar(user.avatarUrl, user.username)}
              </div>
              <div>
                <h3 className="text-amber-50 font-medium">{user.username}</h3>
                <p className="text-amber-50/70 text-xs">ID: {user.userId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.status === "friends" && (
                <span className="px-3 py-1 bg-green-600 text-amber-50 rounded-md text-sm flex items-center gap-1 cursor-default">
                  <FontAwesomeIcon icon={faUserCheck} />
                  Friends
                </span>
              )}
              {user.status === "outgoing" && (
                <button
                  type="button"
                  className="px-3 py-1 border border-white/20 hover:bg-red-500 text-amber-50 rounded-md flex items-center gap-2 cancel-btn"
                  onClick={() => onCancel(user.id)}
                  disabled={isCanceling}
                >
                  {isCanceling ? (
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="animate-spin"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faTimes} />
                  )}
                  {isCanceling ? "Cancelling" : "Cancel"}
                </button>
              )}
              {user.status === "incoming" && (
                <button
                  type="button"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-amber-50 rounded-md flex items-center gap-2"
                  onClick={() => onAccept(user.id)}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="animate-spin"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faCheck} />
                  )}
                  Accept
                </button>
              )}
              {user.status === "none" && (
                <button
                  type="button"
                  className="px-3 py-1 border border-white/20 bg-white/5 hover:bg-gray-700/50 text-amber-50 rounded-md flex items-center gap-2 interface-btn"
                  onClick={() => onAdd(user.id)}
                  disabled={isRequesting}
                >
                  {isRequesting ? (
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="animate-spin"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faUserPlus} />
                  )}
                  {isRequesting ? "Sending Request" : "Add"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
