"use client";
import React, { useEffect, useRef, useState } from "react";
import type { LinkPreview } from "@/lib/media/MediaTypes";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faPaperclip,
} from "@fortawesome/free-solid-svg-icons";
import { faFaceSmile } from "@fortawesome/free-regular-svg-icons";
import { InputLinkPreviewArea } from "@/public/shared/utils/chat/LinkPreview";

interface MessageInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSend?: () => void;
  isSending?: boolean;
  disabled?: boolean;

  messageInput?: string;
  setMessageInput?: (value: string) => void;

  onMediaSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEmojiClick: () => void;
  linkPreviews?: LinkPreview[];
  linkPreviewLoading?: boolean;
  linkPreviewError?: string | null;
  onDismissPreview?: (url: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  isSending = false,
  disabled = false,
  messageInput,
  setMessageInput,
  onMediaSelect,
  onEmojiClick,
  linkPreviews = [],
  linkPreviewLoading = false,
  linkPreviewError = null,
  onDismissPreview,
}) => {
  const currentValue = value ?? messageInput ?? "";
  const updateValue = onChange ?? setMessageInput ?? (() => {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [dragCounter, setDragCounter] = useState(0);
  const isDragging = dragCounter > 0;

  const resizeTextArea = (textArea: HTMLTextAreaElement | null) => {
    if (!textArea) return;
    textArea.style.height = "auto";
    const minHeight = 40;
    const maxHeight = 180;
    const newHeight = Math.min(
      Math.max(textArea.scrollHeight + 2, minHeight),
      maxHeight,
    );
    textArea.style.height = `${newHeight}px`;
    textArea.style.overflowY =
      textArea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeTextArea(textAreaRef.current);
  }, [currentValue]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    updateValue(e.target.value);
    resizeTextArea(textAreaRef.current);
  };
  const dismissPreview = onDismissPreview ?? (() => {});

  const handleSendDecision = () => {
    if (typeof onSend === "function") {
      onSend();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => prev + 1);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => prev - 1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(0);
    const files = Array.from(e.dataTransfer.files);
    const allowedTypes = [
      "image/",
      "video/",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "text/",
    ];
    const filteredFiles = files.filter((file) =>
      allowedTypes.some(
        (type) => file.type.startsWith(type) || file.type === type,
      ),
    );
    if (filteredFiles.length > 0) {
      const syntheticEvent = {
        target: { files: filteredFiles },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onMediaSelect(syntheticEvent);
    }
  };

  return (
    <div className="shrink-0">
      <InputLinkPreviewArea
        linkPreviews={linkPreviews}
        isLoading={linkPreviewLoading}
        error={linkPreviewError}
        onDismissPreview={dismissPreview}
      />

      <div
        role="group"
        aria-label="Message composer"
        aria-busy={isSending}
        className={`flex items-center gap-2 p-4 bg-white/5 chatInputUI transition-colors duration-200 ${
          isDragging
            ? "bg-blue-500/20 border-2 border-dashed border-blue-400"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="hidden md:block">
          <button
            type="button"
            onClick={onEmojiClick}
            disabled={disabled}
            aria-label="Open emoji picker"
            className={
              "w-10 h-10 rounded-lg p-2 hover:bg-neutral-700/50 text-neutral-50 flex items-center justify-center text-center transition-colors duration-200 interface-btn emoji-button text-xs sm:text-sm" +
              (disabled ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            <FontAwesomeIcon
              icon={faFaceSmile}
              className="text-lg sm:text-sm"
            />
          </button>
        </div>
        <textarea
          ref={textAreaRef}
          id="message-input"
          name="message"
          placeholder="Type a message..."
          value={currentValue}
          onChange={handleInputChange}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendDecision();
            }
          }}
          autoComplete="off"
          disabled={disabled}
          aria-disabled={disabled}
          aria-label="Message"
          rows={1}
          className={
            "flex-1 h-10 min-h-10 px-3 py-2.25 leading-5 border border-white/20 rounded-lg bg-white/5 focus:outline-none focus:ring focus:ring-lime-500 text-neutral-50 resize-none max-h-44 overflow-y-auto scrollbar-hide" +
            (disabled ? " opacity-60 cursor-not-allowed" : "")
          }
        />

        <div className="flex flex-row gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            aria-label="Attach files"
            className={
              "w-10 h-10 p-2 rounded-lg hover:bg-neutral-700/50 text-neutral-50 flex items-center justify-center interface-btn text-xs sm:text-sm" +
              (disabled ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            <FontAwesomeIcon
              icon={faPaperclip}
              className="text-lg sm:text-sm"
            />
            <input
              ref={fileInputRef}
              type="file"
              id="media-file-input"
              name="mediaFiles"
              className="hidden"
              aria-label="Choose files to attach"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={onMediaSelect}
              autoComplete="off"
              multiple
              max="4"
              disabled={disabled}
            />
          </button>
          <button
            type="button"
            onClick={() => handleSendDecision()}
            disabled={disabled || isSending}
            aria-label={isSending ? "Sending message" : "Send message"}
            className={
              "w-10 h-10 flex items-center justify-center p-2 rounded-lg bg-lime-700 hover:bg-lime-800 text-neutral-50 cursor-pointer send-message-btn send-btn text-xs sm:text-sm" +
              (disabled || isSending ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            <FontAwesomeIcon
              icon={faPaperPlane}
              className="text-lg sm:text-sm"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
