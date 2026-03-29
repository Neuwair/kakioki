import { Rest } from "ably";
import { Buffer } from "node:buffer";
import {
  FriendRealtimeEvent,
  friendChannel,
} from "@/lib/Realtime/FriendEvents";
import {
  ChatMessageEvent,
  ChatStatusEvent,
  ChatControlEvent,
  ChatNotificationEvent,
  chatMessageChannel,
  chatStatusChannel,
  chatControlChannel,
  userChatNotificationChannel,
} from "@/lib/Realtime/ChatEvents";

const MAX_ABLY_PAYLOAD_BYTES = 63_000;

function approximatePayloadSize(data: unknown): number {
  try {
    const json = JSON.stringify(data);
    return Buffer.byteLength(json, "utf8");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function trimChatMessageEvent(event: ChatMessageEvent): ChatMessageEvent {
  const baseEvent: ChatMessageEvent = {
    ...event,
    hasFullMetadata: event.hasFullMetadata ?? true,
  };
  if (approximatePayloadSize(baseEvent) <= MAX_ABLY_PAYLOAD_BYTES) {
    return baseEvent;
  }

  const trimmedMetadata = { ...(event.metadata ?? {}) };
  if (trimmedMetadata.media && trimmedMetadata.media.length > 0) {
    trimmedMetadata.media = [];
  }

  const trimmedEvent: ChatMessageEvent = {
    ...event,
    metadata: trimmedMetadata,
    hasFullMetadata: false,
  };

  if (approximatePayloadSize(trimmedEvent) <= MAX_ABLY_PAYLOAD_BYTES) {
    return trimmedEvent;
  }

  const minimalEvent: ChatMessageEvent = {
    ...event,
    metadata: {},
    hasFullMetadata: false,
  };

  return minimalEvent;
}

export class MissingAblyKeyError extends Error {
  constructor() {
    super("Ably API key is not configured");
    this.name = "MissingAblyKeyError";
  }
}

let restClient: Rest | null = null;

function getApiKey(): string {
  const key = process.env.ABLY_API_KEY ?? process.env.ABLY_SECRET_KEY;
  if (!key) {
    throw new MissingAblyKeyError();
  }
  return key;
}

export function getAblyRest(): Rest {
  if (!restClient) {
    restClient = new Rest({ key: getApiKey() });
  }
  return restClient;
}

export async function publishFriendEvent(
  event: FriendRealtimeEvent,
): Promise<void> {
  const recipients = new Set<number>();
  if (event.type === "friend_request_cancelled") {
    recipients.add(event.fromUserId);
    recipients.add(event.toUserId);
  } else if (event.type === "friend_removed") {
    recipients.add(event.initiatorId);
    recipients.add(event.targetId);
  } else {
    recipients.add(event.request.from_id);
    recipients.add(event.request.to_id);
  }

  const rest = getAblyRest();
  const publishTasks = Array.from(recipients).map((userId) =>
    rest.channels.get(friendChannel(userId)).publish(event.type, event),
  );

  await Promise.all(publishTasks);
}

export async function publishChatNotification(
  recipientUserId: number,
  event: ChatNotificationEvent,
): Promise<void> {
  const rest = getAblyRest();
  await rest.channels
    .get(userChatNotificationChannel(recipientUserId))
    .publish(event.type, event);
}

export async function publishChatMessage(
  event: ChatMessageEvent,
): Promise<void> {
  const rest = getAblyRest();
  const payload = trimChatMessageEvent(event);
  await rest.channels
    .get(chatMessageChannel(payload.threadId))
    .publish(payload.type, payload);
}

export async function publishChatStatus(event: ChatStatusEvent): Promise<void> {
  const rest = getAblyRest();
  await rest.channels
    .get(chatStatusChannel(event.threadId))
    .publish(event.type, event);
}

export async function publishChatControl(
  event: ChatControlEvent,
): Promise<void> {
  const rest = getAblyRest();
  await rest.channels
    .get(chatControlChannel(event.threadId))
    .publish(event.type, event);
}
