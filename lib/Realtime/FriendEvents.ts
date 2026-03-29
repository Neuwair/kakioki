import type { FriendRequestRecord } from "@/lib/types/TypesLogic";

export interface FriendUserPayload {
  id: number;
  user_id: string;
  username: string;
  avatar_url?: string;
  public_key?: string;
}

export type FriendRealtimeEvent =
  | {
      type: "friend_request_sent";
      request: FriendRequestRecord;
      fromUser: FriendUserPayload;
      toUser: FriendUserPayload;
    }
  | {
      type: "friend_request_cancelled";
      fromUserId: number;
      toUserId: number;
    }
  | {
      type: "friend_request_accepted";
      request: FriendRequestRecord;
      fromUser: FriendUserPayload;
      toUser: FriendUserPayload;
      blockedBySelf: boolean;
      blockedByFriend: boolean;
      blockCreatedAt: string | null;
    }
  | {
      type: "friend_removed";
      initiatorId: number;
      targetId: number;
    };

export function friendChannel(userId: number): string {
  return `user:${userId}:friends`;
}
