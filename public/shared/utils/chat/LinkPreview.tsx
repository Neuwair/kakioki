"use client";

import React from "react";
import Image from "next/image";
import type { LinkPreview as LinkPreviewType } from "@/lib/media/MediaTypes";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faExternalLinkAlt,
  faGlobe,
  faTimes,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { UseWebsiteLinkPreviewLogic } from "@/public/shared/services/Linkify";
import { UseYouTubePreviewLogic } from "@/public/shared/services/Linkify";
import { SafeImage } from "@/public/shared/utils/chat/MessageMedia";
import "lite-youtube-embed";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "lite-youtube": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        videoid: string;
        playlabel?: string;
        params?: string;
        nocookie?: boolean;
      };
    }
  }
}

interface LinkPreviewProps {
  preview: LinkPreviewType;
  className?: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({
  preview,
  className = "",
}) => {
  if (preview.type === "youtube") {
    return <YouTubePreview preview={preview} className={className} />;
  }

  return <WebsiteLinkPreview preview={preview} className={className} />;
};

interface YouTubePreviewProps {
  preview: LinkPreviewType;
  className?: string;
}

export const YouTubePreview: React.FC<YouTubePreviewProps> = ({
  preview,
  className = "",
}) => {
  const {
    showEmbed,
    isLoading,
    handlePlayClick,
    handleOpenInNewTab,
    liteElementRef,
  } = UseYouTubePreviewLogic(preview);

  const previewTitle = preview.title || "YouTube Video";

  if (showEmbed && preview.youtubeId) {
    return (
      <div
        className={`max-w-lg rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 ${className}`}
      >
        <div className="relative aspect-video">
          <lite-youtube
            key={preview.youtubeId}
            ref={liteElementRef}
            className="block h-full w-full"
            videoid={preview.youtubeId}
            data-title={previewTitle}
            params="modestbranding=1&rel=0"
            nocookie
            style={
              preview.image
                ? { backgroundImage: `url(${preview.image})` }
                : undefined
            }
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <FontAwesomeIcon
                icon={faSpinner}
                size="lg"
                className="text-neutral-50/70 animate-spin"
              />
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-neutral-50 truncate">
                {preview.title || "YouTube Video"}
              </h4>
              <p className="text-xs text-neutral-50 truncate">
                {preview.domain}
              </p>
            </div>
            <button
              onClick={handleOpenInNewTab}
              className="ml-2 p-2 text-neutral-50/60 hover:text-neutral-50 transition-colors text-status-item"
              title="Open in new tab"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`max-w-lg rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all cursor-pointer ${className}`}
    >
      <div className="relative aspect-video group" onClick={handlePlayClick}>
        {preview.image && (
          <>
            <SafeImage
              src={preview.image}
              alt={preview.title || "YouTube Video"}
              fill
              sizes="640px"
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
              <div className="bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-4 shadow-lg transition-all border border-white/20 hover:border-white/30 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faPlay}
                  className="text-neutral-50 text-xl drop-shadow-md"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-neutral-50 truncate mb-1 text-status-item">
              {preview.title || "YouTube Video"}
            </h4>
            {preview.description && (
              <p className="text-xs text-neutral-50/70 line-clamp-2 mb-1 text-status-item">
                {preview.description}
              </p>
            )}
            <p className="text-xs text-neutral-50 truncate text-status-item">
              {preview.domain}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenInNewTab();
            }}
            className="ml-2 p-2 text-neutral-50/60 hover:text-neutral-50 transition-colors"
            title="Open in new tab"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface WebsiteLinkPreviewProps {
  preview: LinkPreviewType;
  className?: string;
}

export const WebsiteLinkPreview: React.FC<WebsiteLinkPreviewProps> = ({
  preview,
  className = "",
}) => {
  const { handleClick } = UseWebsiteLinkPreviewLogic(preview);

  return (
    <div
      className={`max-w-lg rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all cursor-pointer ${className}`}
      onClick={handleClick}
    >
      {preview.image && (
        <div className="relative h-40 overflow-hidden">
          <Image
            src={preview.image}
            alt={preview.title || "Website preview"}
            width={600}
            height={160}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
            unoptimized
          />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FontAwesomeIcon
                icon={faGlobe}
                className="text-neutral-50/60 text-xs shrink-0"
              />
              <span className="text-xs text-neutral-50/60 truncate">
                {preview.domain}
              </span>
            </div>

            <h4 className="text-sm font-medium text-neutral-50 truncate mb-1">
              {preview.title || preview.url}
            </h4>

            {preview.description && (
              <p className="text-xs text-neutral-50/70 line-clamp-2 mb-2">
                {preview.description}
              </p>
            )}

            <p className="text-xs text-neutral-50/50 truncate">{preview.url}</p>
          </div>

          <div className="ml-2 shrink-0">
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              className="text-neutral-50/60 hover:text-neutral-50 transition-colors text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface InputLinkPreviewAreaProps {
  linkPreviews: LinkPreviewType[];
  isLoading: boolean;
  error: string | null;
  onDismissPreview: (url: string) => void;
  className?: string;
}

export const InputLinkPreviewArea: React.FC<InputLinkPreviewAreaProps> = ({
  linkPreviews,
  isLoading,
  error,
  onDismissPreview,
  className = "",
}) => {
  if (!isLoading && linkPreviews.length === 0 && !error) {
    return null;
  }

  return (
    <div className={`border-t border-white/10 bg-black/10 ${className}`}>
      <div className="p-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-neutral-50/70 text-sm">
            <FontAwesomeIcon
              icon={faSpinner}
              size="lg"
              className="text-neutral-50/70 animate-spin"
            />
          </div>
        )}

        {error && !isLoading && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {linkPreviews.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-neutral-50/60 font-medium">
              Link Preview{linkPreviews.length > 1 ? "s" : ""}:
            </div>

            {linkPreviews.map((preview) => (
              <div key={preview.url} className="relative group">
                <LinkPreview
                  preview={preview}
                  className="transition-opacity group-hover:opacity-90"
                />

                <button
                  onClick={() => onDismissPreview(preview.url)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 text-status-item rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove preview"
                >
                  <FontAwesomeIcon
                    icon={faTimes}
                    className="text-neutral-50 text-xs"
                  />
                </button>
              </div>
            ))}

            <div className="text-xs text-neutral-50/50">
              These previews will be included with your message. Click the
              &times; to remove any you don&apos;t want.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
