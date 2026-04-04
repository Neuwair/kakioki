"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faUser } from "@fortawesome/free-solid-svg-icons";
import type { MediaPreview } from "@/lib/media/MediaTypes";
import type { ImageProps } from "next/image";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackIcon?: boolean;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  fallbackIcon = true,
  alt,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError && fallbackIcon) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <FontAwesomeIcon
          icon={faUser}
          size="lg"
          className="text-neutral-50/70"
        />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded">
        <span className="text-xs text-gray-500">Image unavailable</span>
      </div>
    );
  }

  if (typeof props.src === "string" && props.src.startsWith("data:")) {
    return (
      <Image
        {...props}
        alt={alt}
        unoptimized
        onError={() => setHasError(true)}
      />
    );
  }

  return <Image {...props} alt={alt} onError={() => setHasError(true)} />;
};

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
                      className="text-neutral-50 w-3 h-3"
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
                      className="text-neutral-50 w-3 h-3"
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

interface ImageModalProps {
  imageUrl: string;
  imageUrls?: string[];
  onChangeImage?: (imageUrl: string) => void;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  imageUrl,
  imageUrls,
  onChangeImage,
  onClose,
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);
  const orderedImageUrls = React.useMemo(() => {
    const normalized = (imageUrls ?? []).filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim() !== "",
    );

    if (normalized.length > 0) {
      return normalized;
    }

    return imageUrl ? [imageUrl] : [];
  }, [imageUrl, imageUrls]);

  const currentIndex = React.useMemo(
    () => orderedImageUrls.indexOf(imageUrl),
    [imageUrl, orderedImageUrls],
  );

  const navigateImage = React.useCallback(
    (direction: -1 | 1) => {
      if (!onChangeImage || orderedImageUrls.length <= 1) {
        return;
      }

      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (safeIndex + direction + orderedImageUrls.length) %
        orderedImageUrls.length;

      onChangeImage(orderedImageUrls[nextIndex]);
    },
    [currentIndex, onChangeImage, orderedImageUrls],
  );

  const handleTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
    },
    [],
  );

  const handleTouchEnd = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      const touch = event.changedTouches[0];

      touchStartXRef.current = null;
      touchStartYRef.current = null;

      if (startX === null || startY === null || !touch) {
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      navigateImage(deltaX < 0 ? 1 : -1);
    },
    [navigateImage],
  );

  React.useEffect(() => {
    if (!imageUrl) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = (): HTMLElement[] => {
      if (!modalRef.current) {
        return [];
      }
      return Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors),
      );
    };

    const focusFirst = () => {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    };

    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateImage(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateImage(1);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        return;
      }

      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [imageUrl, navigateImage, onClose]);

  if (!imageUrl) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-lg"
    >
      <div
        ref={modalRef}
        className="relative w-[70vw] h-[50vh] max-w-6xl max-h-[50vh] flex flex-col items-center justify-center"
      >
        <div className="w-full flex justify-end mb-5">
          <button
            role="button"
            aria-label="Close image preview"
            onClick={onClose}
            className="p-5 bg-black/70  hover:bg-red-500/90 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer btnRemoveMedia"
          >
            <FontAwesomeIcon
              icon={faTimes}
              className="text-neutral-50 w-5 h-5 transition-transform duration-200 group-hover:rotate-90"
            />
          </button>
        </div>
        <div
          className="w-full flex-1 relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={imageUrl}
            alt="Full size"
            fill
            className="object-contain "
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 80vw, 70vw"
            priority
          />
        </div>
      </div>
    </div>
  );
};
