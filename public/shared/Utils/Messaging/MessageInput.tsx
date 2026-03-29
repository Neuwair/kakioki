"use client";
import React, { useRef } from "react";
import type { LinkPreview } from "@/lib/types/TypesLogic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faPaperclip } from "@fortawesome/free-solid-svg-icons";
import { faFaceSmile } from "@fortawesome/free-regular-svg-icons";
import { InputLinkPreviewArea } from "@/public/shared/Utils/UI/LinkPreviewInputUI";

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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateValue(e.target.value);
  };
  const dismissPreview = onDismissPreview ?? (() => {});

  const handleSendDecision = () => {
    if (typeof onSend === "function") {
      onSend();
    }
  };

  return (
    <div className="flex-shrink-0">
      <InputLinkPreviewArea
        linkPreviews={linkPreviews}
        isLoading={linkPreviewLoading}
        error={linkPreviewError}
        onDismissPreview={dismissPreview}
      />

      <div className="flex items-center gap-2 p-4 bg-white/20 chatInputUI ">
        <div className="hidden md:block">
          <button
            type="button"
            onClick={onEmojiClick}
            disabled={disabled}
            className={
              "p-2 rounded-lg hover:bg-gray-700/50 text-amber-50 items-center justify-center transition-colors duration-200 interface-btn emoji-button" +
              (disabled ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            <FontAwesomeIcon icon={faFaceSmile} size="lg" />
          </button>
        </div>
        <input
          type="text"
          id="message-input"
          name="message"
          placeholder="Type a message..."
          value={currentValue}
          onChange={handleInputChange}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendDecision();
            }
          }}
          autoComplete="off"
          disabled={disabled}
          aria-disabled={disabled}
          className={
            "flex-1 px-3 py-2 border border-white/20 rounded-lg bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-amber-50" +
            (disabled ? " opacity-60 cursor-not-allowed" : "")
          }
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={
            "p-2 rounded-lg hover:bg-gray-700/50 text-amber-50 flex items-center justify-center interface-btn" +
            (disabled ? " opacity-60 cursor-not-allowed" : "")
          }
        >
          <FontAwesomeIcon icon={faPaperclip} size="lg" />
          <input
            ref={fileInputRef}
            type="file"
            id="media-file-input"
            name="mediaFiles"
            className="hidden"
            accept="image/*,video/*"
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
          className={
            "p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-amber-50 flex items-center justify-center cursor-pointer send-message-btn interface-btn" +
            (disabled || isSending ? " opacity-60 cursor-not-allowed" : "")
          }
        >
          <FontAwesomeIcon icon={faPaperPlane} size="lg" />
        </button>
      </div>
    </div>
  );
};
