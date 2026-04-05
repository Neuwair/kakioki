export const KAKIOKI_CONFIG = {
  imageProcessing: {
    maxFileSize: 10 * 1024 * 1024,
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    thumbnailSize: 150,
    allowedTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
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
  },

  friends: {
    maxFriends: 100,
    requestTimeout: 7 * 24 * 60 * 60 * 1000,
  },

  account: {
    autoDeleteDays: 2,
    maxUsernameLength: 10,
    maxBioLength: 500,
    defaultBio: "Using Kakioki, enjoying my time on Earth.",
    userIdLength: 8,
  },

  ui: {
    themes: ["light", "dark", "auto"] as const,
    defaultTheme: "auto" as const,
    animationDuration: 200,
    toastDuration: 5000,
  },
} as const;

export type KakiokiConfig = typeof KAKIOKI_CONFIG;
