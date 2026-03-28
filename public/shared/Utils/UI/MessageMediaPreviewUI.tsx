"use client";

import React from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  imageUrl,
  onClose,
}) => {
  if (!imageUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative w-[70vw] h-[50vh] max-w-6xl max-h-[50vh] flex flex-col items-center justify-center">
        <div className="w-full flex justify-end mb-5">
          <button
            onClick={onClose}
            className="p-5 bg-black/70 hover:bg-red-500/90 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer btnRemoveMedia"
          >
            <FontAwesomeIcon
              icon={faTimes}
              className="text-amber-50 w-5 h-5 transition-transform duration-200 group-hover:rotate-90"
            />
          </button>
        </div>
        <div className="w-full flex-1 relative">
          <Image
            src={imageUrl}
            alt="Full size"
            fill
            className="object-contain"
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 80vw, 70vw"
            priority
          />
        </div>
      </div>
    </div>
  );
};
