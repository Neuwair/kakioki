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

const isSpotifyPreview = (preview: LinkPreviewType): boolean => {
  const value = `${preview.domain ?? ""} ${preview.url}`.toLowerCase();
  return value.includes("spotify.com") || value.includes("spotify.link");
};

const getSpotifyEmbedUrl = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();

    if (!host.includes("spotify.com")) {
      return null;
    }

    const segments = parsedUrl.pathname
      .split("/")
      .filter(Boolean)
      .filter((segment) => !segment.startsWith("intl-"));

    const resourceIndex = segments.findIndex((segment) =>
      ["track", "album", "playlist", "artist", "episode", "show"].includes(
        segment,
      ),
    );

    if (resourceIndex === -1 || !segments[resourceIndex + 1]) {
      return null;
    }

    const resourceType = segments[resourceIndex];
    const resourceId = segments[resourceIndex + 1];
    return `https://open.spotify.com/embed/${resourceType}/${resourceId}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
};

const getSpotifyEmbedHeight = (url: string): number => {
  const embedUrl = getSpotifyEmbedUrl(url);

  if (!embedUrl) {
    return 152;
  }

  if (
    embedUrl.includes("/album/") ||
    embedUrl.includes("/playlist/") ||
    embedUrl.includes("/artist/") ||
    embedUrl.includes("/show/")
  ) {
    return 352;
  }

  return 152;
};

export const LinkPreview: React.FC<LinkPreviewProps> = ({
  preview,
  className = "",
}) => {
  if (isSpotifyPreview(preview)) {
    return <SpotifyPreview preview={preview} className={className} />;
  }

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
  const openInNewTabLabel = `${previewTitle}, opens in a new tab`;

  if (showEmbed && preview.youtubeId) {
    return (
      <div
        className={`max-w-full rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 ${className}`}
      >
        <div className="relative aspect-video">
          <lite-youtube
            key={preview.youtubeId}
            ref={liteElementRef}
            className="block h-full w-full"
            videoid={preview.youtubeId}
            playlabel={`Play ${previewTitle}`}
            aria-label={previewTitle}
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
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 flex items-center justify-center bg-black/50"
            >
              <span
                aria-hidden="true"
                className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin"
              />
              <span className="sr-only">Loading video</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-neutral-50 truncate">
                {preview.title || "YouTube Video"}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-50 truncate">
                {preview.domain}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenInNewTab}
              aria-label={openInNewTabLabel}
              className="ml-2 p-2 text-neutral-50/60 hover:text-neutral-50 transition-colors text-status-item text-xs sm:text-sm"
              title="Open in new tab"
            >
              <FontAwesomeIcon
                icon={faExternalLinkAlt}
                className="text-lg sm:text-sm"
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Play ${previewTitle}`}
      className={`max-w-full rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all cursor-pointer ${className}`}
      onClick={handlePlayClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePlayClick();
        }
      }}
    >
      <div className="relative aspect-video group">
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
                  className="text-neutral-50 drop-shadow-md text-lg sm:text-sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-medium text-neutral-50 truncate mb-1 text-status-item">
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenInNewTab();
            }}
            aria-label={openInNewTabLabel}
            className="ml-2 p-2 text-neutral-50/60 hover:text-neutral-50 transition-colors text-xs sm:text-sm"
            title="Open in new tab"
          >
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              className="text-lg sm:text-sm"
            />
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
interface SpotifyPreviewProps {
  preview: LinkPreviewType;
  className?: string;
}

const SpotifyPreview: React.FC<SpotifyPreviewProps> = ({
  preview,
  className = "",
}) => {
  const { handleClick } = UseWebsiteLinkPreviewLogic(preview);
  const embedUrl = getSpotifyEmbedUrl(preview.url);
  const previewTitle = preview.title || "Spotify";

  if (!embedUrl) {
    return <WebsiteLinkPreview preview={preview} className={className} />;
  }

  return (
    <div className={`max-w-full overflow-hidden rounded-lg ${className}`}>
      <div className="p-2">
        <iframe
          src={embedUrl}
          width="100%"
          height={getSpotifyEmbedHeight(preview.url)}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block w-full rounded-md border-0"
          title={preview.title || "Spotify preview"}
        />
      </div>
      <div className="flex items-center justify-between px-3 pb-3">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-xs sm:text-sm font-medium text-neutral-50">
            {preview.title || "Spotify"}
          </h4>
          <p className="truncate text-xs sm:text-sm text-neutral-50/60">
            {preview.domain || "spotify.com"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          aria-label={`Open ${previewTitle} in Spotify`}
          className="ml-2 p-2 text-neutral-50/60 transition-colors hover:text-neutral-50 text-xs sm:text-sm"
          title="Open in Spotify"
        >
          <FontAwesomeIcon
            icon={faExternalLinkAlt}
            className="text-lg sm:text-sm"
          />
        </button>
      </div>
    </div>
  );
};

export const WebsiteLinkPreview: React.FC<WebsiteLinkPreviewProps> = ({
  preview,
  className = "",
}) => {
  const { handleClick } = UseWebsiteLinkPreviewLogic(preview);
  const previewTitle = preview.title || preview.url;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open link preview for ${previewTitle}`}
      className={`max-w-full rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all cursor-pointer ${className}`}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
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
                className="text-neutral-50/60 text-lg sm:text-sm shrink-0"
              />
              <span className="text-xs sm:text-sm text-neutral-50/60 truncate">
                {preview.domain}
              </span>
            </div>
            <h4 className="text-sm font-medium text-neutral-50 truncate mb-1">
              {previewTitle}
            </h4>
            {preview.description && (
              <p className="text-xs sm:text-sm text-neutral-50/70 line-clamp-2 mb-2">
                {preview.description}
              </p>
            )}
            <p className="text-xs sm:text-sm text-neutral-50/50 truncate">
              {preview.url}
            </p>
          </div>
          <div className="ml-2 shrink-0">
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              className="text-neutral-50/60 hover:text-neutral-50 transition-colors text-lg sm:text-sm"
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
interface InputLinkPreviewCardProps {
  preview: LinkPreviewType;
  onDismissPreview: (url: string) => void;
}

const InputLinkPreviewCard: React.FC<InputLinkPreviewCardProps> = ({
  preview,
  onDismissPreview,
}) => {
  if (isSpotifyPreview(preview)) {
    return (
      <div className="flex flex-row justify-start overflow-hidden p-4 gap-4 bg-white/5">
        <div className="relative flex rounded-lg bg-white/5 w-full">
          <SpotifyPreview className="w-full" preview={preview} />
        </div>
        <div className="flex items-start lg:items-center">
          <button
            type="button"
            onClick={() => onDismissPreview(preview.url)}
            aria-label={`Remove preview for ${preview.title || preview.url}`}
            className="flex justify-center items-center rounded-lg hover:bg-neutral-700/50 text-neutral-50 p-4 cancel-btn text-xs sm:text-sm"
            title="Remove preview"
          >
            <FontAwesomeIcon icon={faTimes} className="text-lg sm:text-sm" />
          </button>
        </div>
      </div>
    );
  }

  const { handleClick } = UseWebsiteLinkPreviewLogic(preview);
  const previewTitle = preview.title || preview.url;
  const previewDomain = preview.domain || "Link preview";

  return (
    <div className="flex flex-row flex-wrap justify-start overflow-hidden p-4 gap-4 bg-white/5">
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Open preview for ${previewTitle}`}
        className="flex flex-row text-left justify-center items-center align-middle rounded-lg gap-4 text-xs sm:text-sm"
        title="Open preview"
      >
        <div className="relative flex w-35 h-35 rounded-lg bg-white/50">
          {preview.image ? (
            <SafeImage
              src={preview.image}
              alt={previewTitle}
              fill
              className="object-cover rounded-lg"
              fallbackIcon={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5 text-neutral-50/50">
              <FontAwesomeIcon
                icon={preview.type === "youtube" ? faPlay : faGlobe}
                className="text-lg sm:text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col flex-1 gap-2 p-4 rounded-lg bg-white/5 h-full justify-center align-middle">
          <h4 className="line-clamp-2 text-xs sm:text-sm font-semibold leading-tight text-neutral-50">
            {previewTitle}
          </h4>
          <p className="line-clamp-2 text-xs sm:text-sm font-semibold leading-none text-neutral-50/50">
            {previewDomain}
          </p>
        </div>
      </button>

      <div className="flex items-start w-full sm:w-auto justify-end sm:ml-auto">
        <button
          type="button"
          onClick={() => onDismissPreview(preview.url)}
          aria-label={`Remove preview for ${previewTitle}`}
          className="w-10 h-10 flex justify-center items-center rounded-lg hover:bg-neutral-700/50 text-neutral-50 p-4 cancel-btn text-xs sm:text-sm"
          title="Remove preview"
        >
          <FontAwesomeIcon icon={faTimes} className="text-lg sm:text-sm" />
        </button>
      </div>
    </div>
  );
};

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

  const activePreview = linkPreviews[0];

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-col gap-3">
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-50/70"
          >
            <span
              aria-hidden="true"
              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
            />
            <span>Loading link preview...</span>
          </div>
        )}

        {error && !isLoading && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {activePreview ? (
          <InputLinkPreviewCard
            preview={activePreview}
            onDismissPreview={onDismissPreview}
          />
        ) : null}
      </div>
    </div>
  );
};
