"use client";
import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import type { MediaPreview } from "@/lib/types/TypesLogic";

interface MediaPreviewGridProps {
  mediaPreviews: MediaPreview[];
  onRemovePreview: (index: number) => void;
}

export const MediaPreviewGrid: React.FC<MediaPreviewGridProps> = ({
  mediaPreviews,
  onRemovePreview,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

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
  }, [mediaPreviews.length]);

  if (mediaPreviews.length === 0) return null;

  return (
    <div ref={containerRef} className="">
      <div className="relative bg-white/5 rounded-lg p-4 border-amber-50">
        <div
          className={`media-preview-grid mx-auto ${
            mediaPreviews.length === 1
              ? "media-preview-grid-1"
              : mediaPreviews.length === 2
                ? "media-preview-grid-2"
                : mediaPreviews.length === 3
                  ? "media-preview-grid-3"
                  : "media-preview-grid-4"
          }`}
        >
          {mediaPreviews.map((preview, index) => (
            <div
              key={index}
              className="media-preview-item group cursor-pointer"
            >
              {preview.type === "image" ? (
                <>
                  <Image
                    src={preview.previewUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  />
                  <button
                    onClick={() => onRemovePreview(index)}
                    className="absolute top-1 left-1 z-20 p-1 bg-black/70 hover:bg-red-500/90 rounded-lg transition-all duration-200 hover:scale-100 cursor-pointer opacity-80 group-hover:opacity-100 btnRemoveMedia"
                  >
                    <FontAwesomeIcon
                      icon={faTimes}
                      className="text-amber-50 w-3 h-3"
                    />
                  </button>
                </>
              ) : (
                <>
                  <video
                    src={preview.previewUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    loop
                    autoPlay
                  />
                  <button
                    onClick={() => onRemovePreview(index)}
                    className="absolute top-1 left-1 z-20 p-1 bg-black/70 hover:bg-red-500/90 rounded-full transition-all duration-200 hover:scale-100 cursor-pointer opacity-80 group-hover:opacity-100 btnRemoveMedia"
                  >
                    <FontAwesomeIcon
                      icon={faTimes}
                      className="text-amber-50 w-3 h-3"
                    />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
