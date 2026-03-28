"use client";

import React from "react";
import type { LinkPreview } from "@/lib/types/TypesLogic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faExternalLinkAlt,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { UseYouTubePreviewLogic } from "@/public/shared/Tools/Linkify";
import { SafeImage } from "@/public/shared/Utils/Props/MediaProps";
import "lite-youtube-embed";

interface YouTubePreviewProps {
  preview: LinkPreview;
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
                className="text-amber-50/70 animate-spin"
              />
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-amber-50 truncate">
                {preview.title || "YouTube Video"}
              </h4>
              <p className="text-xs text-amber-50 truncate">{preview.domain}</p>
            </div>
            <button
              onClick={handleOpenInNewTab}
              className="ml-2 p-2 text-amber-50/60 hover:text-amber-50 transition-colors"
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
                  className="text-amber-50 text-xl drop-shadow-md"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-amber-50 truncate mb-1">
              {preview.title || "YouTube Video"}
            </h4>
            {preview.description && (
              <p className="text-xs text-amber-50/70 line-clamp-2 mb-1">
                {preview.description}
              </p>
            )}
            <p className="text-xs text-amber-50 truncate">{preview.domain}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenInNewTab();
            }}
            className="ml-2 p-2 text-amber-50/60 hover:text-amber-50 transition-colors"
            title="Open in new tab"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
};
