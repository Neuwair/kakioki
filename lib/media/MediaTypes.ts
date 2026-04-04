export type ApiMessageResponse = {
  id: number | string;
  sender_id: number;
  receiver_id: number;
  content?: string;
  encrypted_content?: string;
  message_type?: string;
  file_url?: string | null;
  file_size?: number | null;
  created_at?: string;
  updated_at?: string;
  group_id?: string | null;
};

export type ApiSendResponse =
  | { message?: string; data?: ApiMessageResponse }
  | { message?: string; data?: ApiMessageResponse[] }
  | null;

export interface DbUser {
  id: number;
  user_id: string;
  email: string;
  username: string;
  password_hash?: string;
  avatar_url?: string;
  bio?: string;
  public_key?: string;
  secret_key_encrypted?: string;
  is_verified?: boolean;
  verification_token?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  userId: string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  publicKey?: string;
  secretKeyEncrypted?: string;
}

export type FriendRequestStatus = "pending" | "accepted";

export interface FriendRequestRecord {
  id: number;
  from_id: number;
  to_id: number;
  status: FriendRequestStatus;
  created_at?: string;
  updated_at?: string;
}

export interface FriendSearchResult extends DbUser {
  friendship_status?: FriendRequestStatus;
  friendship_id?: number;
  requester_id?: number;
  addressee_id?: number;
}

export interface FriendSummaryEntry {
  user: DbUser;
  request: FriendRequestRecord;
  threadPublicId?: string | null;
  threadInternalId?: number | null;
  blockedBySelf?: boolean;
  blockedSelfAt?: string | null;
  blockedByFriend?: boolean;
  blockedFriendAt?: string | null;
}

export interface FriendSummary {
  friends: FriendSummaryEntry[];
  incoming: FriendSummaryEntry[];
  outgoing: FriendSummaryEntry[];
}

export interface MessageThreadRecord {
  internalId: number;
  threadId: string;
  userAId: number;
  userBId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EncryptedMediaDescriptor {
  url: string;
  nonce: string;
  ciphertext: string;
  type: "image" | "video" | "file";
  format?: string;
  size?: number;
  digest?: string;
  width?: number;
  height?: number;
  thumbnail?: string | null;
  name?: string;
}

export interface MessageMetadata {
  text?: string;
  media?: EncryptedMediaDescriptor[];
  links?: string[];
  previews?: LinkPreview[];
  extras?: Record<string, unknown>;
}

export interface MessageStatusMetadata {
  delivery?: "sending" | "sent" | "delivered" | "read" | "failed";
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string;
  retries?: number;
  extras?: Record<string, unknown>;
}

export interface EncryptedMessageRecord {
  id: number;
  threadPublicId: string;
  threadInternalId: number;
  fromId: number;
  toId: number;
  clientMessageId: string;
  ciphertext: string;
  nonce: string;
  metadata: MessageMetadata;
  statusMetadata: MessageStatusMetadata;
  createdAt: string;
}

export interface AuthenticatedUser {
  id: number;
  userId: string;
  email: string;
  username: string;
}

export type LinkPreview = {
  url: string;
  type: "youtube" | "website";
  title?: string;
  description?: string;
  image?: string;
  youtubeId?: string;
  domain?: string;
};

export type MediaPreview = {
  file: File;
  previewUrl: string;
  type: "image" | "video" | "file";
};

export type ProcessedMedia = { file: File; type: "image" | "video" | "file" };

export type MediaType = "image" | "video" | "file";

export interface MediaProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface ProcessedMediaResult {
  buffer: Buffer;
  format: string;
  width?: number;
  height?: number;
}

export interface CreateUserData {
  user_id: string;
  email: string;
  username: string;
  password_hash: string;
  public_key?: string | null;
  secret_key_encrypted?: string | null;
  avatar_url?: string;
  bio?: string;
  verification_token?: string;
}

export interface UpdateUserData {
  email?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  is_verified?: boolean;
  verification_token?: string;
  password_hash?: string;
  public_key?: string | null;
  secret_key_encrypted?: string | null;
}

export type ImageFormat = "jpeg" | "png" | "webp";

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: ImageFormat;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  withoutEnlargement?: boolean;
  rotate?: boolean;
}

export interface ProcessedImage {
  buffer: Buffer;
  format: ImageFormat | string;
  mime?: string;
  width: number;
  height: number;
  size: number;
  exif?: unknown;
  orientation?: number | undefined;
}

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
export const MIN_ACCEPTED_BYTES = 64;
export const MAX_DIMENSION = 10000;

export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 80;
  return Math.max(1, Math.min(100, Math.round(q)));
}

export function formatToMime(format: string | undefined): string {
  switch ((format || "").toLowerCase()) {
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

export function getImageExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return extensions[mimeType.toLowerCase()] || "jpg";
}
