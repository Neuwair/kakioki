"use client";

import React from "react";
import { UserInfoHeader } from "@/public/shared/Utils/UI/UserHeaderUI";
import { FriendSearchHeader } from "@/public/shared/Utils/UI/FriendSearchbarUI";
import { FriendListHeader } from "@/public/shared/Utils/UI/FriendListHeaderUI";
import { FriendRequestsHeader } from "@/public/shared/Utils/UI/FriendListRequestUI";
import { useFriendRelationships } from "@/public/shared/hooks/useFriendRelationships";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

interface ChatHeaderProps {
  onSelectFriend?: (friend: FriendListEntry) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onSelectFriend }) => {
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
    <div className="p-3 bg-white/5 pb-6 overflow-hidden header-background">
      <div className="flex flex-col gap-3">
        <UserInfoHeader />
        <FriendSearchHeader />
        {error && <div className="text-sm text-red-400 px-2">{error}</div>}
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
      </div>
    </div>
  );
};
