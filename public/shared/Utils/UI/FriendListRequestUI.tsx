"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faTimes,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

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
    <div className="relative mb-4">
      <div className="text-amber-50/80 text-sm font-medium mb-2 px-2 flex items-center justify-between cursor-default">
        <span>Friend Requests ({incomingCount})</span>
        {outgoingCount > 0 && (
          <span className="text-xs text-amber-50/50">
            Outgoing: {outgoingCount}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {incomingCount === 0 && outgoingCount === 0 && (
          <div className="text-amber-50/60 text-sm px-2 cursor-default">
            No pending requests.
          </div>
        )}

        {incoming.map((entry) => {
          const isAccepting = acceptingIds.has(entry.user.id);
          const isDeclining = decliningIds.has(entry.user.id);
          return (
            <div
              key={`incoming-${entry.user.id}`}
              className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg"
            >
              <div>
                <p className="text-amber-50 font-medium">
                  {entry.user.username}
                </p>
                <p className="text-amber-50/60 text-xs">wants to connect</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-700 text-amber-50 rounded-md text-sm flex items-center gap-1"
                  onClick={() => onAccept(entry.user.id)}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <FontAwesomeIcon
                      icon={faSpinner}
                      size="lg"
                      className="text-amber-50/70 animate-spin"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faCheck} />
                  )}
                  {isAccepting ? "Accepting" : "Accept"}
                </button>
                <button
                  type="button"
                  className="px-3 py-1 bg-red-500 hover:bg-red-700 text-amber-50 rounded-md text-sm flex items-center gap-1"
                  onClick={() => onDecline(entry.user.id)}
                  disabled={isDeclining}
                >
                  {isDeclining ? (
                    <FontAwesomeIcon
                      icon={faSpinner}
                      size="lg"
                      className="text-amber-50/70 animate-spin"
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
              className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg"
            >
              <div>
                <p className="text-amber-50 font-medium">
                  {entry.user.username}
                </p>
                <p className="text-amber-50/60 text-xs">awaiting response</p>
              </div>
              <button
                type="button"
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-amber-50 rounded-md text-sm flex items-center gap-1 cancel-btn"
                onClick={() => onCancel(entry.user.id)}
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <FontAwesomeIcon
                    icon={faSpinner}
                    size="lg"
                    className="text-amber-50/70 animate-spin"
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
  );
};
