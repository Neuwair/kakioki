import { getAblyRest } from "@/lib/server/AblyServer";

export const APP_PRESENCE_CHANNEL = "app:presence";

import type {
  FriendRequestRecord,
  MessageMetadata,
  MessageStatusMetadata,
} from "@/lib/media/MediaTypes";

export type ChatMessageEvent = {
  type: "chat_message";
  threadId: string;
  clientMessageId: string;
  fromId: number;
  toId: number;
  ciphertext: string;
  nonce: string;
  metadata: MessageMetadata;
  status: MessageStatusMetadata;
  createdAt: string;
  hasFullMetadata?: boolean;
};

export type ChatStatusEvent = {
  type: "chat_status";
  threadId: string;
  clientMessageId: string;
  actorId: number;
  status: MessageStatusMetadata;
  createdAt: string;
};

export type ChatControlEvent =
  | {
      type: "chat_block";
      threadId: string;
      blockerId: number;
      blockedId: number;
      createdAt: string;
    }
  | {
      type: "chat_unblock";
      threadId: string;
      blockerId: number;
      blockedId: number;
      createdAt: string;
    }
  | {
      type: "chat_removed";
      threadId: string;
      initiatorId: number;
      targetId: number;
      createdAt: string;
    }
  | {
      type: "chat_cleared";
      threadId: string;
      initiatorId: number;
      targetId: number;
      createdAt: string;
    };

export type ChatRealtimeEvent =
  | ChatMessageEvent
  | ChatStatusEvent
  | ChatControlEvent;

export type ChatNotificationEvent = {
  type: "chat_thread_created";
  threadId: string;
  fromId: number;
  createdAt: string;
};

export function userChatNotificationChannel(userId: number) {
  return `user:chat:${userId}`;
}

export function chatMessageChannel(threadId: string) {
  return `chat:thread:${threadId}`;
}

export function chatStatusChannel(threadId: string) {
  return `chat:status:${threadId}`;
}

export function chatControlChannel(threadId: string) {
  return `chat:control:${threadId}`;
}

export interface FriendUserPayload {
  id: number;
  user_id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
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
    }
  | {
      type: "friend_profile_updated";
      user: FriendUserPayload;
    };

export function friendChannel(userId: number): string {
  return `user:${userId}:friends`;
}

const LIFECYCLE_CHANNEL_PREFIX = "user:lifecycle:";

export type AccountLifecycleEvent = {
  type: "account_deleted";
  userId: number;
  deletedAt: string;
};

export function userLifecycleChannel(userId: number): string {
  return `${LIFECYCLE_CHANNEL_PREFIX}${userId}`;
}

export async function publishAccountDeletionEvent(
  userId: number,
): Promise<void> {
  const rest = getAblyRest();
  const channel = rest.channels.get(userLifecycleChannel(userId));
  await channel.publish("account_deleted", {
    type: "account_deleted",
    userId,
    deletedAt: new Date().toISOString(),
  } satisfies AccountLifecycleEvent);
}
