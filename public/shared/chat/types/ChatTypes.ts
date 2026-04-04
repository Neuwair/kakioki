import type {
  MediaPreview,
  MessageMetadata,
  MessageStatusMetadata,
} from "@/lib/media/MediaTypes";
import type { UploadedMediaItem } from "@/public/shared/logic/MediaHandler";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";

export interface BlockState {
  blockedBySelf: boolean;
  blockedByFriend: boolean;
  createdAt: string | null;
}

export interface DecryptedMedia {
  source: string;
  type: "image" | "video" | "file";
  format?: string;
  size?: number;
  width?: number;
  height?: number;
  digest?: string;
  thumbnail?: string | null;
  name?: string;
}

export type ChatMessageState =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "error";

export interface ChatMessage {
  id?: number;
  clientMessageId: string;
  senderId: number;
  ciphertext: string;
  nonce: string;
  plaintext: string | null;
  metadata: MessageMetadata;
  media: DecryptedMedia[];
  status: MessageStatusMetadata;
  createdAt: string;
  state: ChatMessageState;
  error?: string;
}

export interface MessageRecordInput {
  id?: number;
  clientMessageId: string;
  fromId: number;
  toId: number;
  ciphertext: string;
  nonce: string;
  metadata?: MessageMetadata | null;
  statusMetadata?: MessageStatusMetadata | null;
  status?: MessageStatusMetadata | null;
  createdAt: string;
}

export interface SendMessageOptions {
  metadata?: MessageMetadata;
  status?: MessageStatusMetadata;
  clientMessageId?: string;
  createdAt?: string;
  mediaPreviews?: MediaPreview[];
  attachments?: UploadedMediaItem[];
}

export interface SendMessageResult {
  success: boolean;
  message?: ChatMessage;
  error?: string;
}

export interface UseChatState {
  friend: FriendListEntry | null;
}

export interface UseChatReturn {
  threadId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isPreparing: boolean;
  isSending: boolean;
  hasMore: boolean;
  isBlocked: boolean;
  blockState: BlockState;
  error: string | null;
  sendMessage: (
    text: string,
    options?: SendMessageOptions
  ) => Promise<SendMessageResult>;
  retryMessage: (clientMessageId: string) => Promise<SendMessageResult>;
  markAsRead: (clientMessageIds: string[]) => Promise<void>;
  blockFriend: () => Promise<boolean>;
  unblockFriend: () => Promise<boolean>;
  removeFriend: () => Promise<boolean>;
  nukeMessages: () => Promise<boolean>;
  loadLatest: () => Promise<void>;
}
