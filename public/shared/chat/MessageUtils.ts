import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import type { MessageMetadata } from "@/lib/media/MediaTypes";
import type {
  ChatMessage,
  ChatMessageState,
} from "@/public/shared/chat/types/ChatTypes";

export function cloneMetadata(metadata?: MessageMetadata): MessageMetadata {
  if (!metadata) {
    return {};
  }
  const cloned: MessageMetadata = { ...metadata };
  if (metadata.media) {
    cloned.media = metadata.media.map((item) => ({ ...item }));
  }
  if (metadata.links) {
    cloned.links = [...metadata.links];
  }
  if (metadata.previews) {
    cloned.previews = metadata.previews.map((entry) => ({ ...entry }));
  }
  if (metadata.extras) {
    cloned.extras = { ...metadata.extras };
  }
  return cloned;
}

export function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    const aTime = new Date(a.createdAt).valueOf();
    const bTime = new Date(b.createdAt).valueOf();
    return aTime - bTime;
  });
}

export function mergeMessage(
  list: ChatMessage[],
  next: ChatMessage,
): ChatMessage[] {
  const index = list.findIndex(
    (item) => item.clientMessageId === next.clientMessageId,
  );
  if (index === -1) {
    return sortMessages([...list, next]);
  }
  const updated = [...list];
  updated[index] = {
    ...updated[index],
    ...next,
    metadata: { ...updated[index].metadata, ...next.metadata },
    status: { ...updated[index].status, ...next.status },
    media: next.media ?? updated[index].media,
  };
  return sortMessages(updated);
}

export function applyStatusToMessage(message: ChatMessage): ChatMessageState {
  const delivery = message.status.delivery;
  const deliveryToState = KAKIOKI_CONFIG.messages.deliveryToState;
  if (delivery === "read") {
    return deliveryToState.read;
  }
  if (delivery === "delivered") {
    return deliveryToState.delivered;
  }
  if (delivery === "sending") {
    return deliveryToState.sending;
  }
  if (delivery === "failed") {
    return deliveryToState.failed;
  }
  return deliveryToState.default;
}
