"use client";

import React from "react";
import type { LinkPreview } from "@/lib/types/TypesLogic";
import { LinkPreview as LinkPreviewComponent } from "@/public/shared/Utils/Props/LinkPreviewProps";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSpinner } from "@fortawesome/free-solid-svg-icons";

interface InputLinkPreviewAreaProps {
  linkPreviews: LinkPreview[];
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
        {}
        {isLoading && (
          <div className="flex items-center gap-2 text-amber-50/70 text-sm">
            <FontAwesomeIcon
              icon={faSpinner}
              size="lg"
              className="text-amber-50/70 animate-spin"
            />
          </div>
        )}

        {}
        {error && !isLoading && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {}
        {linkPreviews.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-amber-50/60 font-medium">
              Link Preview{linkPreviews.length > 1 ? "s" : ""}:
            </div>

            {linkPreviews.map((preview) => (
              <div key={preview.url} className="relative group">
                <LinkPreviewComponent
                  preview={preview}
                  className="transition-opacity group-hover:opacity-90"
                />

                {}
                <button
                  onClick={() => onDismissPreview(preview.url)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove preview"
                >
                  <FontAwesomeIcon
                    icon={faTimes}
                    className="text-amber-50 text-xs"
                  />
                </button>
              </div>
            ))}

            <div className="text-xs text-amber-50/50">
              These previews will be included with your message. Click the × to
              remove any you don&apos;t want.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
