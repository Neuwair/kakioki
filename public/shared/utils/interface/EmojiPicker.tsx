"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import data from "@emoji-mart/data";
import { Picker } from "emoji-mart";
import { UseEmojiPickerLogic } from "@/public/shared/services/EmojiPicker";

interface EmojiPickerProps {
  isOpen: boolean;
  onEmojiSelect: (emoji: { native: string }) => void;
  onClickOutside: () => void;
  placement?: "above" | "below";
  triggerRef?: React.RefObject<HTMLElement | null>;
  desktopOnly?: boolean;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onEmojiSelect,
  onClickOutside,
  placement = "above",
  triggerRef,
  desktopOnly = false,
}) => {
  const [isDesktop, setIsDesktop] = useState(true);
  const { pickerRef, portalElement, position, theme } = UseEmojiPickerLogic(
    isOpen,
    onClickOutside,
    { placement, triggerRef },
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pickerInstanceRef = useRef<
    (HTMLElement & { destroy?: () => void }) | null
  >(null);

  useEffect(() => {
    if (!desktopOnly || typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateDesktopState = () => {
      setIsDesktop(mediaQuery.matches);
    };

    updateDesktopState();
    mediaQuery.addEventListener("change", updateDesktopState);

    return () => {
      mediaQuery.removeEventListener("change", updateDesktopState);
    };
  }, [desktopOnly]);

  useEffect(() => {
    if (desktopOnly && isOpen && !isDesktop) {
      onClickOutside();
    }
  }, [desktopOnly, isDesktop, isOpen, onClickOutside]);

  const options = useMemo(
    () => ({
      data,
      onEmojiSelect,
      theme,
      previewPosition: "none",
      skinTonePosition: "none",
      searchPosition: "top",
      set: "native",
      perLine: 8,
      emojiSize: 20,
      maxFrequentRows: 1,
    }),
    [onEmojiSelect, theme],
  );

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    pickerInstanceRef.current?.destroy?.();
    const pickerElement = new Picker(options) as unknown as HTMLElement & {
      destroy?: () => void;
    };
    pickerInstanceRef.current = pickerElement;
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(pickerElement);
    return () => {
      pickerInstanceRef.current?.destroy?.();
      pickerInstanceRef.current = null;
      pickerElement.remove();
    };
  }, [isOpen, options]);

  if (!isOpen || !portalElement || (desktopOnly && !isDesktop)) return null;

  const content = (
    <div
      ref={pickerRef}
      role="dialog"
      aria-modal="false"
      aria-label="Emoji picker"
      tabIndex={-1}
      className="kakioki-emoji-picker fixed z-1000 transform-gpu transition-opacity duration-200 ease-in-out"
      style={{
        left: `${position.left}px`,
        top: position.top !== null ? `${position.top}px` : undefined,
        bottom: position.bottom !== null ? `${position.bottom}px` : undefined,
        opacity: position.ready ? 1 : 0,
        pointerEvents: position.ready ? "auto" : "none",
        animation: position.ready ? "fadeIn 0.2s ease-in-out" : undefined,
      }}
    >
      <div className=" shadow-xl rounded-lg overflow-hidden">
        <div
          ref={containerRef}
          className="emoji-picker-container max-h-87.5 w-[320px]"
        ></div>
      </div>
    </div>
  );

  return createPortal(content, portalElement);
};

export default EmojiPicker;
