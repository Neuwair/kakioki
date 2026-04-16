"use client";
import React, { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCheckDouble,
  faCircleExclamation,
  faClock,
  faDownload,
  faFile,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { TextWithLinks } from "@/public/shared/services/Linkify";
import { LinkPreview } from "@/public/shared/utils/chat/LinkPreview";
import { InlineVideoPlayer } from "@/public/shared/utils/interface/VideoPlayer";
import type { ChatMessage } from "@/public/shared/chat/UseChat";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onRetry?: (clientMessageId: string) => void;
  onMediaPreview?: (source: string) => void;
}

const resolveMediaGridClass = (count: number): string => {
  if (count === 1) {
    return "media-preview-grid-1";
  }
  if (count === 2) {
    return "media-preview-grid-2";
  }
  if (count === 3) {
    return "media-preview-grid-3";
  }
  if (count >= 4) {
    return "media-preview-grid-4";
  }
  return "media-preview-grid-2";
};

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  onRetry,
  onMediaPreview,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const formattedTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(message.createdAt));
    } catch {
      return message.createdAt;
    }
  }, [message.createdAt]);

  const bubbleAlignment = isOwn ? "justify-end" : "justify-start";
  const bubbleStyle = isOwn
    ? "bg-gradient-to-b from-[rgba(15,15,15,0.95)] via-[rgba(50,50,50,0.9)] to-[rgba(240,240,240,0.5)]"
    : "bg-gradient-to-b from-[rgba(25,25,25,0.95)] via-[rgba(80,80,80,0.9)] to-[rgba(140,140,140,0.8)]";
  const bubbleCorners = isOwn
    ? "rounded-[25px] rounded-br-none"
    : "rounded-[25px] rounded-bl-none";

  const statusIcon = useMemo(() => {
    if (!isOwn) {
      return null;
    }
    if (message.state === "error") {
      return faCircleExclamation;
    }
    if (message.state === "sending") {
      return faClock;
    }
    if (message.state === "read") {
      return faCheckDouble;
    }
    if (message.state === "delivered") {
      return faCheckDouble;
    }
    if (message.state === "sent") {
      return faCheck;
    }
    return faCheck;
  }, [isOwn, message.state]);

  const textContent = message.plaintext ?? "Encrypted message unavailable";
  const mediaItems = message.media ?? [];
  const linkPreviews = message.metadata?.previews ?? [];
  const showRetry = isOwn && message.state === "error" && onRetry;
  const statusColor = "text-neutral-300";
  const statusText =
    message.state === "error"
      ? "Failed to send"
      : message.state === "sending"
        ? "Sending"
        : message.state === "read"
          ? "Read"
          : message.state === "delivered"
            ? "Delivered"
            : "Sent";

  const handleFileDownload = (url: string, filename?: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "download";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return undefined;
    }
    const videos = Array.from(root.querySelectorAll("video"));
    if (videos.length === 0) {
      return undefined;
    }
    const wheelHandler = () => undefined;
    const touchStartHandler = () => undefined;
    const touchMoveHandler = () => undefined;
    videos.forEach((video) => {
      video.addEventListener("wheel", wheelHandler, { passive: true });
      video.addEventListener("touchstart", touchStartHandler, {
        passive: true,
      });
      video.addEventListener("touchmove", touchMoveHandler, { passive: true });
    });
    return () => {
      videos.forEach((video) => {
        video.removeEventListener("wheel", wheelHandler);
        video.removeEventListener("touchstart", touchStartHandler);
        video.removeEventListener("touchmove", touchMoveHandler);
      });
    };
  }, [mediaItems.length, message.clientMessageId]);

  return (
    <div className={`flex ${bubbleAlignment}`}>
      <div ref={containerRef} className="relative max-w-[80%] xl:max-w-[50%]">
        <div
          className={`${bubbleStyle} ${bubbleCorners} px-4 py-3 shadow-[0_5px_5px_rgba(0,0,0,0.35)] space-y-2 relative overflow-hidden`}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1 right-1 top-0.5 h-14 rounded-t-[25px] bg-[linear-gradient(180deg,rgba(255,255,255,0.50)0%,rgba(255,255,255,0.15)42%,rgba(255,255,255,0.10)75%,rgba(255,255,255,0)100%)]" />
          </div>
          {mediaItems.length > 0 ? (
            <div className="relative z-10">
              <div
                className={`media-preview-grid mx-auto ${resolveMediaGridClass(
                  mediaItems.length,
                )}`}
              >
                {mediaItems.map((item, index) => {
                  const key = `${
                    item.digest ?? item.source ?? "media"
                  }-${index}`;
                  if (item.type === "image") {
                    return (
                      <div
                        key={key}
                        className="media-preview-item group cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={() => onMediaPreview?.(item.source)}
                          aria-label={`Open image ${item.name || "preview"}`}
                          className="relative block h-full w-full overflow-hidden transition-transform duration-200 hover:scale-[1.02] text-xs sm:text-sm"
                        >
                          <Image
                            src={item.source}
                            alt={item.name ?? "Encrypted image"}
                            width={item.width ?? 800}
                            height={item.height ?? 600}
                            className="h-full w-full max-h-80 sm:max-h-96 object-cover"
                            sizes="(max-width: 768px) 70vw, 320px"
                            unoptimized
                          />
                        </button>
                      </div>
                    );
                  }
                  if (item.type === "video") {
                    return (
                      <div
                        key={key}
                        className="media-preview-item media-preview-item-video group cursor-pointer"
                      >
                        <div className="relative block h-full w-full overflow-hidden transition-transform duration-200 hover:scale-[1.02]">
                          <InlineVideoPlayer
                            source={item.source}
                            poster={item.thumbnail ?? undefined}
                            className="h-full w-full max-h-120 sm:max-h-136 rounded-lg"
                            forceCompactControls={mediaItems.length > 1}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (item.type === "file") {
                    return (
                      <div
                        key={key}
                        className="media-preview-item-music group cursor-default"
                      >
                        <div className="flex flex-col flex-wrap items-center bg-white/20 rounded-lg transition-colors border border-neutral-600/30">
                          <div className="flex flex- flex-wrap items-center flex-1 min-w-0 p-5 gap-2.5">
                            <div className="shrink-0 flex justify-center items-center">
                              <FontAwesomeIcon
                                icon={faFile}
                                className="text-neutral-400 text-lg sm:text-sm"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-neutral-200 truncate">
                                {item.name || "Document"}
                              </div>
                              {item.size && (
                                <div className="text-xs text-neutral-400">
                                  {(item.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleFileDownload(item.source, item.name)
                            }
                            aria-label={`Download ${item.name || "file"}`}
                            className=" rounded-lg text-neutral-50 flex items-center justify-center p-5 text-xs sm:text-sm"
                            title="Download file"
                          >
                            <FontAwesomeIcon icon={faDownload} className="text-lg sm:text-sm"/>
                          </button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ) : null}
          <TextWithLinks
            text={textContent}
            maxUrlLength={35}
            className={
              message.plaintext
                ? "text-neutral-50 relative z-10 cursor-default whitespace-pre-wrap text-item text-xs sm:text-sm lg:text-lg"
                : "italic text-neutral-50 relative z-10 cursor-default whitespace-pre-wrap text-xs sm:text-sm lg:text-lg"
            }
          />
          {linkPreviews.length > 0 ? (
            <div className="mt-1 space-y-2 relative z-10">
              {linkPreviews.map((preview) => (
                <LinkPreview
                  key={preview.url}
                  preview={preview}
                  className="max-w-xs"
                />
              ))}
            </div>
          ) : null}
          <div
            className={`flex gap-2 items-center justify-between text-xs sm:text-sm lg:text-lg ${statusColor} relative z-10 text-status-item`}
          >
            <span className="cursor-default text-xs sm:text-sm lg:text-lg">
              {formattedTime}
            </span>
            <span
              aria-label={statusText}
              className="flex items-center gap-2"
            >
              {statusIcon ? <FontAwesomeIcon aria-hidden="true" icon={statusIcon} /> : null}
              <span className="sr-only">{statusText}</span>
              {showRetry ? (
                <button
                  type="button"
                  onClick={() => onRetry?.(message.clientMessageId)}
                  aria-label="Retry sending message"
                  className="px-2 py-1 rounded bg-red-500/20 text-red-100 hover:bg-red-500/30 transition text-xs sm:text-sm"
                >
                  <FontAwesomeIcon aria-hidden="true" icon={faRotateRight} className="text-lg sm:text-sm"/>
                </button>
              ) : null}
            </span>
          </div>
          {message.error ? (
            <div
              role="alert"
              aria-live="assertive"
              className="text-xs sm:text-sm lg:text-2xl text-red-400/90 relative z-10"
            >
              {message.error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);
MessageBubble.displayName = "MessageBubble";
