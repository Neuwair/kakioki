export const KAKIOKI_CONFIG = {
  imageProcessing: {
    maxFileSize: 10 * 1024 * 1024,
    minAcceptedBytes: 64,
    maxDimension: 10000,
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    defaultFormat: "webp" as const,
    defaultFit: "inside" as const,
    thumbnailSize: 150,
    allowedTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    mimeToExtension: {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    } as Record<string, string>,
    formatToMime: {
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    } as Record<string, string>,
  },

  videoProcessing: {
    maxFileSize: 50 * 1024 * 1024,
    maxDuration: 60,
    allowedTypes: ["video/mp4", "video/webm", "video/quicktime"],
    allowedExtensions: [".mp4", ".webm", ".mov"],
  },

  fileUpload: {
    maxFileSize: 25 * 1024 * 1024,
    allowedTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ],
  },

  emoji: {
    categories: [
      "people",
      "nature",
      "foods",
      "activity",
      "places",
      "objects",
      "symbols",
      "flags",
    ],
    perLine: 8,
    maxFrequentRows: 2,
    searchPosition: "sticky" as const,
    navPosition: "bottom" as const,
  },

  encryption: {
    enabled: process.env.NODE_ENV === "production",
    keyLength: 32,
    nonceLength: 24,
  },

  messages: {
    maxLength: 2000,
    typingTimeout: 3000,
    loadHistoryCount: 50,
    maxHistoryLoad: 500,
    chatStates: ["sending", "sent", "delivered", "read", "error"] as const,
    deliveryToState: {
      sending: "sending",
      delivered: "delivered",
      read: "read",
      failed: "error",
      default: "sent",
    } as const,
  },

  friends: {
    maxFriends: 100,
    requestTimeout: 7 * 24 * 60 * 60 * 1000,
  },

  account: {
    autoDeleteDays: 2,
    millisecondsPerDay: 24 * 60 * 60 * 1000,
    deletionBatchSize: 100,
    maxUsernameLength: 10,
    minPasswordLength: 8,
    maxBioLength: 500,
    defaultBio: "Using Kakioki, enjoying my time on Earth.",
    userIdLength: 8,
    userIdChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    normalizedEmailLength: 255,
  },

  ui: {
    themes: ["light", "dark", "auto"] as const,
    defaultTheme: "auto" as const,
    animationDuration: 200,
    toastDuration: 5000,
  },

  presence: {
    staleTtlMs: 120_000,
    clockSkewToleranceMs: 5_000,
    idleTimeoutMs: 90_000,
    debounceMs: 300,
    minStateDurationMs: 10_000,
    lastSeenIntervalMs: 5 * 60 * 1000,
  },

  transport: {
    maxAblyPayloadBytes: 63_000,
    realtimeReauthTimeoutMs: 10_000,
  },

  auth: {
    cookieMaxAgeSeconds: 60 * 60 * 24 * 7,
  },

  upload: {
    maxBytes: 4 * 1024 * 1024,
    documentMimeTypes: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
    ] as readonly string[],
  },

  mediaPreview: {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.8,
    skippedCountIncrement: 1,
  },

  mediaRouteProcessing: {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 80,
  },

  imageResize: {
    default: {
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.8,
    },
    fallback: {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
    },
    profile: {
      maxWidth: 400,
      maxHeight: 400,
      quality: 0.9,
    },
  },

  fileSizeFormatting: {
    base: 1024,
    units: ["Bytes", "KB", "MB", "GB"] as const,
  },

  linkify: {
    supportedMessageTypes: ["image", "video", "file"] as const,
    urlPatterns: {
      youtube:
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      general: /(https?:\/\/[^\s]+)/g,
    },
    previewEndpoint: "/api/interface",
    defaultMaxUrlLength: 50,
    textWithLinksMaxUrlLength: 25,
    youtubeThumbnailKeys: {
      default: "default",
      medium: "mqdefault",
      high: "hqdefault",
      maxres: "maxresdefault",
    } as const,
  },

  videoCompression: {
    maxFileSizeMB: 4,
    maxBytes: 4 * 1024 * 1024,
    sizeMarginBytes: 96 * 1024,
    maxAttempts: 5,
    targetBitrateHz: 900_000,
    minBitrateHz: 180_000,
    audioBitrateHz: 56_000,
    fps: 24,
    maxDimension: 1280,
    minDimension: 200,
  },
} as const;

export type UploadMediaType = "image" | "video" | "file";

export const MEDIA_UPLOAD_MAX_BYTES = {
  image: KAKIOKI_CONFIG.imageProcessing.maxFileSize,
  video: KAKIOKI_CONFIG.videoProcessing.maxFileSize,
  file: KAKIOKI_CONFIG.fileUpload.maxFileSize,
} as const;

function formatUploadLimit(bytes: number): string {
  const megabyte = 1024 * 1024;
  const kilobyte = 1024;

  if (bytes % megabyte === 0) {
    return `${bytes / megabyte}MB`;
  }

  if (bytes < megabyte && bytes % kilobyte === 0) {
    return `${bytes / kilobyte}KB`;
  }

  return `${Math.round((bytes / megabyte) * 10) / 10}MB`;
}

export function getMediaUploadMaxBytes(mediaType: UploadMediaType): number {
  return MEDIA_UPLOAD_MAX_BYTES[mediaType];
}

export function getMediaUploadLimitLabel(mediaType: UploadMediaType): string {
  return formatUploadLimit(getMediaUploadMaxBytes(mediaType));
}

export type KakiokiConfig = typeof KAKIOKI_CONFIG;
