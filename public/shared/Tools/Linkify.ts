"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { find } from "linkifyjs";
import Linkify from "linkify-react";
import type {
  MediaPreview,
  LinkPreview,
  ApiMessageResponse,
  DbUser,
} from "@/lib/types/TypesLogic";

type LiteYouTubeElement = HTMLElement & { activate?: () => unknown };

async function sendMessageHandler(
  _params: unknown
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  return { success: false, error: "Not implemented" };
}

function formatApiMessageToClientMessage(
  apiMessage: unknown,
  _userId?: number
): {
  id: string;
  content: string;
  sender: "user" | "receiver";
  timestamp: Date;
  media?: Array<{
    url: string;
    type: "image" | "video";
    encrypted?: boolean;
    format?: string;
    size?: number;
  }>;
  linkPreviews?: LinkPreview[];
  encrypted?: boolean;
  sending?: boolean;
  local_id?: string | number;
} {
  return apiMessage as {
    id: string;
    content: string;
    sender: "user" | "receiver";
    timestamp: Date;
    media?: Array<{
      url: string;
      type: "image" | "video";
      encrypted?: boolean;
      format?: string;
      size?: number;
    }>;
    linkPreviews?: LinkPreview[];
    encrypted?: boolean;
    sending?: boolean;
    local_id?: string | number;
  };
}

function normalizeMessageType(t: unknown): "text" | "image" | "video" | "file" {
  const s = typeof t === "string" ? t : "text";
  if (s === "image" || s === "video" || s === "file")
    return s as "image" | "video" | "file";
  return "text";
}

export const URL_PATTERNS = {
  youtube:
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  general: /(https?:\/\/[^\s]+)/g,
};

export function extractYouTubeId(url: string): string | null {
  const match = url.match(URL_PATTERNS.youtube);
  return match ? match[1] : null;
}

export function detectUrls(text: string): LinkPreview[] {
  const urls: LinkPreview[] = [];

  const generalMatches = text.match(URL_PATTERNS.general);
  if (!generalMatches) return urls;

  generalMatches.forEach((url) => {
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      urls.push({ url, type: "youtube" });
    } else {
      urls.push({ url, type: "website" });
    }
  });

  return urls;
}

export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function getYouTubeThumbnail(
  videoId: string,
  quality: "default" | "medium" | "high" | "maxres" = "high"
): string {
  const key =
    quality === "default"
      ? "default"
      : quality === "medium"
      ? "mqdefault"
      : quality === "high"
      ? "hqdefault"
      : "maxresdefault";
  return `https://img.youtube.com/vi/${videoId}/${key}.jpg`;
}

export function sanitizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}
export async function fetchPreviewForUrl(
  url: string
): Promise<LinkPreview | null> {
  try {
    const response = await fetch("/api/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      return (await response.json()) as LinkPreview;
    }
  } catch (err) {
    console.error(`Failed to fetch preview for ${url}:`, err);
  }
  return null;
}

export async function fetchPreviewsForText(
  text?: string
): Promise<LinkPreview[]> {
  if (!text) return [];
  const urlLinks = find(text, "url");
  const urls = urlLinks.map((l: { href: string }) => l.href);
  if (urls.length === 0) return [];

  const promises = urls.map((u: string) => fetchPreviewForUrl(u));
  const results = await Promise.all(promises);
  return results.filter(
    (r: LinkPreview | null): r is LinkPreview => r !== null
  );
}

const linkifyOptions = {
  target: "_blank",
  rel: "noopener noreferrer",
  className: "text-black hover:text-black/80 underline break-all",
  format: (value: string, type: string) => {
    if (type === "url" && value.length > 50) {
      return value.substring(0, 47) + "...";
    }
    return value;
  },
};

export const parseTextWithLinks = (text: string, maxUrlLength: number = 50) => {
  const customOptions = {
    ...linkifyOptions,
    format: (value: string, type: string) => {
      if (type === "url" && value.length > maxUrlLength) {
        return value.substring(0, maxUrlLength - 3) + "...";
      }
      return value;
    },
  };

  return React.createElement(Linkify, { options: customOptions }, text);
};

interface TextWithLinksProps {
  text: string;
  className?: string;
  maxUrlLength?: number;
}

export const TextWithLinks: React.FC<TextWithLinksProps> = ({
  text,
  className = "",
  maxUrlLength = 50,
}) => {
  const customOptions = {
    ...linkifyOptions,
    format: (value: string, type: string) => {
      if (type === "url" && value.length > maxUrlLength) {
        return value.substring(0, maxUrlLength - 3) + "...";
      }
      return value;
    },
  };

  return React.createElement(
    "span",
    { className },
    React.createElement(Linkify, { options: customOptions }, text)
  );
};

export const extractUrlsFromText = (text: string): string[] => {
  return find(text, "url").map((link: { href: string }) => link.href);
};

export const hasUrlsInText = (text: string): boolean => {
  return find(text, "url").length > 0;
};

export function UseWebsiteLinkPreviewLogic(preview: { url: string }) {
  const handleClick = () => {
    window.open(preview.url, "_blank", "noopener,noreferrer");
  };

  return { handleClick } as const;
}

export const UseYouTubePreviewLogic = (preview: LinkPreview) => {
  const [showEmbed, setShowEmbed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const liteElementRef = useRef<LiteYouTubeElement | null>(null);

  const handlePlayClick = useCallback(() => {
    setIsLoading(true);
    setShowEmbed(true);
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    window.open(preview.url, "_blank", "noopener,noreferrer");
  }, [preview.url]);

  const handleEmbedError = useCallback(() => {
    setIsLoading(false);
    setShowEmbed(false);
  }, []);

  useEffect(() => {
    setShowEmbed(false);
    setIsLoading(false);
  }, [preview.youtubeId]);

  useEffect(() => {
    if (!showEmbed) {
      return;
    }
    if (!preview.youtubeId) {
      setIsLoading(false);
      return;
    }
    const element = liteElementRef.current;
    if (!element) {
      setIsLoading(false);
      return;
    }
    const activate = () => {
      try {
        element.activate?.();
      } finally {
        setIsLoading(false);
      }
    };
    const rafId = window.requestAnimationFrame(activate);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [showEmbed, preview.youtubeId]);

  return {
    showEmbed,
    isLoading,
    handlePlayClick,
    handleOpenInNewTab,
    handleEmbedError,
    liteElementRef,
  };
};

interface SendWithLinkPreviewsParams {
  messageInput: string;
  mediaPreviews: MediaPreview[];
  selectedFriend:
    | (DbUser & {
        friendship_status?: "pending" | "accepted" | "blocked";
        friendship_id?: number;
        requester_id?: number;
        addressee_id?: number;
      })
    | null;
  user: { id: number } | null;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  setMediaPreviews: React.Dispatch<React.SetStateAction<MediaPreview[]>>;
  addMessageInOrder: (m: {
    id: string;
    content: string;
    sender: "user" | "receiver";
    timestamp: Date;
    media?: Array<{
      url: string;
      type: "image" | "video";
      encrypted?: boolean;
      format?: string;
      size?: number;
    }>;
    linkPreviews?: LinkPreview[];
    encrypted?: boolean;
    sending?: boolean;
    local_id?: string | number;
  }) => void;
  replaceMessageByLocalId: (
    localId: string,
    m: {
      id: string;
      content: string;
      sender: "user" | "receiver";
      timestamp: Date;
      media?: Array<{
        url: string;
        type: "image" | "video";
        encrypted?: boolean;
        format?: string;
        size?: number;
      }>;
      linkPreviews?: LinkPreview[];
      encrypted?: boolean;
      sending?: boolean;
      local_id?: string | number;
    }
  ) => void;
}

export async function SendWithLinkPreviews({
  messageInput,
  mediaPreviews,
  selectedFriend,
  user,
  setMessageInput,
  setMediaPreviews,
  addMessageInOrder,
  replaceMessageByLocalId,
}: SendWithLinkPreviewsParams): Promise<void> {
  try {
    const localId = `local-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const resp = await sendMessageHandler({
      messageInput,
      mediaPreviews,
      selectedFriend,
      user,
      setMessageInput,
      setMediaPreviews,
    });
    if (resp && resp.data) {
      const data = resp.data;
      const toMessageWithUser = (
        x: ApiMessageResponse
      ): {
        id: number;
        sender_id: number;
        receiver_id: number;
        content: string;
        encrypted_content?: string;
        message_type: "text" | "image" | "video" | "file";
        file_url?: string;
        file_size?: number;
        created_at: string;
        updated_at: string;
      } => {
        const idVal = x.id as string | number | undefined;
        return {
          id:
            typeof idVal === "string" ? parseInt(idVal, 10) : (idVal as number),
          sender_id: x.sender_id ?? -1,
          receiver_id: x.receiver_id ?? -1,
          content: x.content ?? x.encrypted_content ?? "",
          encrypted_content: x.encrypted_content as string | undefined,
          message_type: normalizeMessageType(x.message_type),
          file_url: x.file_url ?? undefined,
          file_size: x.file_size ?? undefined,
          created_at: x.created_at ?? new Date().toISOString(),
          updated_at: x.updated_at ?? new Date().toISOString(),
        };
      };

      if (Array.isArray(data)) {
        for (const m of data) {
          try {
            const apiMsg = toMessageWithUser(m);
            const formatted = formatApiMessageToClientMessage(
              apiMsg,
              user?.id ?? -1
            );
            addMessageInOrder(formatted);
            if (typeof localId !== "undefined") {
              replaceMessageByLocalId(localId, formatted);
            }
          } catch {}
        }
      } else if (data && typeof data === "object") {
        try {
          const apiMsg = toMessageWithUser(data as ApiMessageResponse);
          const formatted = formatApiMessageToClientMessage(
            apiMsg,
            user?.id ?? -1
          );
          addMessageInOrder(formatted);
          if (typeof localId !== "undefined") {
            replaceMessageByLocalId(localId, formatted);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error("Error in SendWithLinkPreviews:", err);
  }
}

interface UseInputLinkPreviewsReturn {
  linkPreviews: LinkPreview[];
  isLoading: boolean;
  error: string | null;
  updateText: (text: string) => void;
  dismissPreview: (url: string) => void;
  clearPreviews: () => void;
  hasActivePreviews: boolean;
}

export const useInputLinkPreviews = (
  debounceMs: number = 800
): UseInputLinkPreviewsReturn => {
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [dismissedUrls, setDismissedUrls] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreviewsForTextCb = useCallback(
    async (text: string) => {
      const urlLinks = find(text, "url");
      const urls = urlLinks.map((link: { href: string }) => link.href);
      const newUrls = urls.filter((url: string) => !dismissedUrls.has(url));

      if (newUrls.length === 0) {
        setLinkPreviews([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      try {
        const previewPromises = newUrls.map(async (url) => {
          try {
            const response = await fetch("/api/link-preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            });
            if (response.ok) {
              return await response.json();
            }
          } catch (err) {
            console.error(`Failed to fetch preview for ${url}:`, err);
          }
          return null;
        });

        const results = await Promise.all(previewPromises);
        const validPreviews = results.filter(
          (preview: LinkPreview | null): preview is LinkPreview =>
            preview !== null
        );

        setLinkPreviews(validPreviews);
      } catch (err) {
        console.error("Error fetching link previews:", err);
        setError("Failed to load link previews");
        setLinkPreviews([]);
      } finally {
        setIsLoading(false);
      }
    },
    [dismissedUrls]
  );

  const updateText = useCallback(
    (text: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      if (!text.trim()) {
        setLinkPreviews([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchPreviewsForTextCb(text);
      }, debounceMs);
    },
    [fetchPreviewsForTextCb, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const dismissPreview = useCallback((url: string) => {
    setDismissedUrls((prev) => new Set([...prev, url]));
    setLinkPreviews((prev) => prev.filter((preview) => preview.url !== url));
  }, []);

  const clearPreviews = useCallback(() => {
    setLinkPreviews([]);
    setDismissedUrls(new Set());
    setError(null);
    setIsLoading(false);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  const hasActivePreviews = linkPreviews.length > 0 || isLoading;

  return {
    linkPreviews,
    isLoading,
    error,
    updateText,
    dismissPreview,
    clearPreviews,
    hasActivePreviews,
  };
};
