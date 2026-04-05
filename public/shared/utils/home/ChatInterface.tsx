"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatUserHeader } from "@/public/shared/utils/interface/UserHeader";
import { ChatHeader } from "@/public/shared/utils/interface/UserSearch";
import { MediaPreviewGrid } from "@/public/shared/utils/chat/MessageMedia";
import { MessageInput } from "@/public/shared/utils/chat/MessageInput";
import { EmojiPicker } from "@/public/shared/utils/interface/EmojiPicker";
import { ImageModal } from "@/public/shared/utils/chat/MessageMedia";
import { MessageBubble } from "@/public/shared/utils/chat/MessageBubble";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import {
  faSpinner,
  faBan,
  faUserSlash,
  faUserMinus,
  faRadiation,
} from "@fortawesome/free-solid-svg-icons";
import type { MediaPreview } from "@/lib/media/MediaTypes";
import type { FriendListEntry } from "@/public/shared/hooks/FriendRelationships";
import { useChat } from "@/public/shared/chat/UseChat";
import { useAuth } from "@/lib/auth/ClientAuth";
import {
  handleMediaSelectInput,
  removeMediaPreview as removeMediaPreviewHelper,
} from "@/public/shared/logic/MediaHandler";
import { useInputLinkPreviews } from "@/public/shared/services/Linkify";

export const ChatInterface: React.FC = () => {
  const { user } = useAuth();
  const [selectedFriend, setSelectedFriend] = useState<FriendListEntry | null>(
    null,
  );
  const [messageInput, setMessageInput] = useState<string>("");
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreview[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [badgeVisible, setBadgeVisible] = useState<boolean>(false);
  const [unseenCount, setUnseenCount] = useState<number>(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [chatAlert, setChatAlert] = useState<string | null>(null);
  const [chatAlertAnimation, setChatAlertAnimation] = useState<
    "bounce-in" | "bounce-out" | null
  >(null);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);
  const [isNukingMessages, setIsNukingMessages] = useState(false);
  const [isNukeDialogOpen, setIsNukeDialogOpen] = useState(false);
  const [isUserPreviewVisible, setIsUserPreviewVisible] = useState(false);
  const [showInputBounce, setShowInputBounce] = useState(false);
  const [showLimitMessage, setShowLimitMessage] = useState(false);
  const [isLimitMessageAnimatingOut, setIsLimitMessageAnimatingOut] =
    useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const acknowledgedMessagesRef = useRef<Set<string>>(new Set());
  const previousMessageCountRef = useRef<number>(0);
  const lastBadgeMessageRef = useRef<string | null>(null);

  const {
    messages,
    isLoading,
    isSending,
    isBlocked,
    blockState,
    error: chatError,
    sendMessage,
    retryMessage,
    markAsRead,
    blockFriend,
    unblockFriend,
    removeFriend,
    nukeMessages,
  } = useChat({ friend: selectedFriend });

  const {
    linkPreviews,
    isLoading: isLinkPreviewLoading,
    error: linkPreviewError,
    updateText: updateLinkPreviewText,
    dismissPreview: dismissLinkPreview,
    clearPreviews: clearLinkPreviews,
  } = useInputLinkPreviews();

  const clearUnseenBadge = useCallback(() => {
    lastBadgeMessageRef.current = null;
    setBadgeVisible(false);
    setUnseenCount(0);
  }, []);

  const previousChatErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (chatError) {
      setChatAlert(chatError);
      if (chatError === "Conversation messages cleared") {
        setChatAlertAnimation("bounce-in");
      } else {
        setChatAlertAnimation(null);
      }
    } else if (
      previousChatErrorRef.current === "Conversation messages cleared"
    ) {
      setChatAlertAnimation("bounce-out");
      const timer = window.setTimeout(() => {
        setChatAlert(null);
        setChatAlertAnimation(null);
      }, 360);
      return () => window.clearTimeout(timer);
    } else {
      setChatAlert(null);
      setChatAlertAnimation(null);
    }

    previousChatErrorRef.current = chatError;
  }, [chatError]);

  const handleMessageInputChange = useCallback(
    (next: string) => {
      setMessageInput(next);
      updateLinkPreviewText(next);
    },
    [updateLinkPreviewText],
  );

  const resetComposerState = useCallback(() => {
    setMessageInput("");
    updateLinkPreviewText("");
    clearLinkPreviews();
  }, [clearLinkPreviews, updateLinkPreviewText]);

  const cleanupMediaPreviews = useCallback(() => {
    setMediaPreviews((prev) => {
      prev.forEach((preview) => URL.revokeObjectURL(preview.previewUrl));
      return [];
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupMediaPreviews();
    };
  }, [cleanupMediaPreviews]);

  const handleCloseChat = useCallback(() => {
    setSelectedFriend(null);
    setIsUserPreviewVisible(false);
    resetComposerState();
    cleanupMediaPreviews();
    setIsEmojiPickerOpen(false);
    clearUnseenBadge();
    acknowledgedMessagesRef.current.clear();
  }, [cleanupMediaPreviews, clearUnseenBadge, resetComposerState]);

  const handleSelectFriend = useCallback(
    (entry: FriendListEntry) => {
      setSelectedFriend(entry);
      setIsUserPreviewVisible(false);
      resetComposerState();
      cleanupMediaPreviews();
      clearUnseenBadge();
      acknowledgedMessagesRef.current.clear();
      previousMessageCountRef.current = 0;
      setShowInputBounce(true);
      window.setTimeout(() => setShowInputBounce(false), 420);
    },
    [cleanupMediaPreviews, clearUnseenBadge, resetComposerState],
  );

  const handleMediaSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputElement = event.target;
      const files = Array.from(event.target.files || []);
      if (mediaPreviews.length + files.length > 4) {
        setShowLimitMessage(true);
        setIsLimitMessageAnimatingOut(false);
        setTimeout(() => {
          setIsLimitMessageAnimatingOut(true);
          setTimeout(() => {
            setShowLimitMessage(false);
            setIsLimitMessageAnimatingOut(false);
          }, 360);
        }, 2640);
        if (inputElement) {
          inputElement.value = "";
        }
        return;
      }
      setShowLimitMessage(false);
      try {
        await handleMediaSelectInput(event, mediaPreviews, setMediaPreviews);
      } finally {
        if (inputElement) {
          inputElement.value = "";
        }
      }
    },
    [mediaPreviews],
  );

  const handleRemoveMediaPreview = useCallback(
    (index: number) => {
      removeMediaPreviewHelper(index, mediaPreviews, (next) =>
        setMediaPreviews(next),
      );
    },
    [mediaPreviews],
  );

  const handleSendMessage = useCallback(async () => {
    if (!selectedFriend) {
      return;
    }
    const trimmed = messageInput.trim();
    const hasMedia = mediaPreviews.length > 0;
    const hasPreviews = linkPreviews.length > 0;
    if (!hasMedia && !hasPreviews && !trimmed) {
      return;
    }
    const metadata = hasPreviews
      ? {
          previews: linkPreviews.map((preview) => ({ ...preview })),
          links: linkPreviews.map((preview) => preview.url),
        }
      : undefined;
    const options =
      metadata || hasMedia
        ? {
            ...(metadata ? { metadata } : {}),
            ...(hasMedia ? { mediaPreviews } : {}),
          }
        : undefined;
    setSendError(null);
    resetComposerState();
    if (hasMedia) {
      cleanupMediaPreviews();
    }

    const result = await sendMessage(trimmed, options);
    if (!result.success) {
      setSendError(result.error || "Failed to send message");
    } else {
      setSendError(null);
    }
  }, [
    cleanupMediaPreviews,
    linkPreviews,
    mediaPreviews,
    messageInput,
    resetComposerState,
    selectedFriend,
    sendMessage,
  ]);

  const handleRetryMessage = useCallback(
    async (clientMessageId: string) => {
      const result = await retryMessage(clientMessageId);
      if (!result.success) {
        setSendError(result.error || "Failed to resend message");
      }
    },
    [retryMessage],
  );

  const handleToggleBlock = useCallback(async () => {
    if (!selectedFriend) {
      return;
    }
    setIsUpdatingBlock(true);
    try {
      const success = blockState.blockedBySelf
        ? await unblockFriend()
        : await blockFriend();
      if (!success) {
        setSendError("Unable to update block status");
      } else {
        setSendError(null);
      }
    } finally {
      setIsUpdatingBlock(false);
    }
  }, [blockFriend, blockState.blockedBySelf, selectedFriend, unblockFriend]);

  const handleRemoveFriend = useCallback(async () => {
    if (!selectedFriend) {
      return;
    }
    setIsRemovingFriend(true);
    try {
      const success = await removeFriend();
      if (success) {
        handleCloseChat();
      } else {
        setSendError("Unable to remove friend");
      }
    } finally {
      setIsRemovingFriend(false);
    }
  }, [handleCloseChat, removeFriend, selectedFriend]);

  const handleNukeMessages = useCallback(() => {
    if (!selectedFriend) {
      return;
    }
    setIsNukeDialogOpen(true);
  }, [selectedFriend]);

  const executeNukeMessages = useCallback(async () => {
    if (!selectedFriend || !nukeMessages) {
      return;
    }
    setIsNukeDialogOpen(false);
    setIsNukingMessages(true);
    try {
      const success = await nukeMessages();
      if (!success) {
        setSendError("Unable to clear conversation messages");
      } else {
        setSendError(null);
      }
    } finally {
      setIsNukingMessages(false);
    }
  }, [nukeMessages, selectedFriend]);

  useEffect(() => {
    if (!selectedFriend) {
      previousMessageCountRef.current = 0;
      lastBadgeMessageRef.current = null;
      return;
    }
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    const previousCount = previousMessageCountRef.current;
    const nextCount = messages.length;
    if (nextCount === 0) {
      previousMessageCountRef.current = 0;
      lastBadgeMessageRef.current = null;
      clearUnseenBadge();
      return;
    }
    if (nextCount <= previousCount) {
      previousMessageCountRef.current = nextCount;
      return;
    }
    const latestMessage = messages[messages.length - 1];
    const isInitialLoad = previousCount === 0;
    previousMessageCountRef.current = nextCount;
    const frame = window.requestAnimationFrame(() => {
      if (isInitialLoad) {
        container.scrollTop = container.scrollHeight;
        clearUnseenBadge();
        return;
      }
      const { scrollHeight, scrollTop, clientHeight } = container;
      const distanceFromBottom = Math.abs(
        scrollHeight - scrollTop - clientHeight,
      );
      const isNearBottom = distanceFromBottom < 120;
      if (isNearBottom || latestMessage.senderId === user?.id) {
        container.scrollTo({ top: scrollHeight, behavior: "smooth" });
        clearUnseenBadge();
      } else if (latestMessage.senderId === selectedFriend.user.id) {
        if (lastBadgeMessageRef.current !== latestMessage.clientMessageId) {
          lastBadgeMessageRef.current = latestMessage.clientMessageId;
          setUnseenCount((count) => count + 1);
          setBadgeVisible(true);
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, clearUnseenBadge, selectedFriend, user?.id]);

  useEffect(() => {
    if (!selectedFriend) {
      return;
    }
    const unreadIds = messages
      .filter(
        (message) =>
          message.senderId === selectedFriend.user.id &&
          message.state !== "read",
      )
      .map((message) => message.clientMessageId)
      .filter(
        (clientMessageId) =>
          !acknowledgedMessagesRef.current.has(clientMessageId),
      );
    if (unreadIds.length === 0) {
      return;
    }
    acknowledgedMessagesRef.current = new Set([
      ...acknowledgedMessagesRef.current,
      ...unreadIds,
    ]);
    markAsRead(unreadIds);
  }, [markAsRead, messages, selectedFriend]);

  const blockBanner = useMemo(() => {
    if (!selectedFriend) {
      return null;
    }
    if (blockState.blockedByFriend) {
      return "This user has blocked you";
    }
    if (blockState.blockedBySelf) {
      return "You blocked this conversation";
    }
    return null;
  }, [blockState.blockedByFriend, blockState.blockedBySelf, selectedFriend]);

  const previewImageUrls = useMemo(
    () =>
      messages.flatMap((message) =>
        (message.media ?? [])
          .filter((item) => item.type === "image" && item.source.trim() !== "")
          .map((item) => item.source),
      ),
    [messages],
  );

  const canSend = selectedFriend !== null && !isBlocked;

  return (
    <>
      {selectedImage && selectedImage.trim() !== "" ? (
        <ImageModal
          imageUrl={selectedImage}
          imageUrls={previewImageUrls}
          onChangeImage={setSelectedImage}
          onClose={() => setSelectedImage(null)}
        />
      ) : null}
      <EmojiPicker
        isOpen={isEmojiPickerOpen}
        onEmojiSelect={(emoji) => {
          setMessageInput((prev) => {
            const next = prev + emoji.native;
            updateLinkPreviewText(next);
            return next;
          });
        }}
        onClickOutside={() => setIsEmojiPickerOpen(false)}
      />

      <div className="w-full h-screen chat-container backdrop-blur-lg overflow-hidden flex flex-col chat-background">
        <ChatHeader
          onSelectFriend={handleSelectFriend}
          isCollapsed={!!selectedFriend}
        />

        {(() => {
          const actionButtons = selectedFriend ? (
            <>
              <button
                type="button"
                onClick={handleToggleBlock}
                disabled={isUpdatingBlock}
                title={blockState.blockedBySelf ? "Unblock user" : "Block user"}
                className={`p-2 rounded-lg flex items-center justify-center cursor-pointer block-btn transition-colors ${
                  isUpdatingBlock ? "opacity-60 cursor-not-allowed" : ""
                } ${
                  blockState.blockedBySelf
                    ? "bg-red-500 hover:bg-red-700 text-neutral-50"
                    : "bg-white/5 hover:bg-red-800 text-neutral-50"
                }`}
              >
                {isUpdatingBlock ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : blockState.blockedBySelf ? (
                  <FontAwesomeIcon icon={faUserSlash} size="lg" />
                ) : (
                  <FontAwesomeIcon icon={faBan} size="lg" />
                )}
              </button>

              <button
                type="button"
                onClick={handleRemoveFriend}
                disabled={isRemovingFriend}
                title="Remove friend"
                className={`p-2 rounded-lg flex items-center justify-center cursor-pointer remove-friend-btn transition-colors bg-white/5 text-neutral-50 hover:bg-red-800 ${
                  isRemovingFriend ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isRemovingFriend ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faUserMinus} size="lg" />
                )}
              </button>
              <button
                type="button"
                onClick={handleNukeMessages}
                disabled={isNukingMessages}
                title="Nuke Messages"
                className={`p-2 rounded-lg flex items-center justify-center cursor-pointer nuke-btn transition-colors bg-white/5 text-neutral-50 hover:bg-amber-800 ${
                  isNukingMessages ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isNukingMessages ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faRadiation} size="lg" />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  setIsUserPreviewVisible((previous) => !previous)
                }
                title="Toggle input bounce"
                className="p-2 rounded-lg flex items-center justify-center cursor-pointer view-btn transition-colors bg-white/5 text-neutral-50 hover:bg-lime-800"
              >
                <FontAwesomeIcon icon={faEye} size="lg" />
              </button>
            </>
          ) : null;

          return (
            <ChatUserHeader
              selectedFriend={
                selectedFriend
                  ? {
                      id: selectedFriend.user.id,
                      username: selectedFriend.user.username,
                      avatarUrl: selectedFriend.user.avatarUrl,
                      avatar_url: selectedFriend.user.avatarUrl ?? null,
                      userId: selectedFriend.user.userId,
                      bio: selectedFriend.user.bio ?? null,
                    }
                  : null
              }
              showPreview={isUserPreviewVisible}
              onClose={handleCloseChat}
              actions={actionButtons}
            />
          );
        })()}

        {isNukeDialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
            <div className="flex flex-col flex-wrap bg-white/5 backdrop-blur-lg rounded-lg p-6 w-[90%] max-w-md border border-white/20 shadow-xl">
              <h2 className="text-xl text-center font-bold mb-5 text-neutral-50">
                Confirm nuke messages
              </h2>
              <p className="text-sm text-neutral-50 mb-5 font-light">
                This will permanently delete the entire conversation history for
                both users. This cannot be undone.
              </p>
              <div className="flex flex-row flex-wrap gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => setIsNukeDialogOpen(false)}
                  className="px-4 py-2 rounded-lg no-theme bg-transparent hover:bg-amber-50/10 text-neutral-50 cancel-btn cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeNukeMessages}
                  className="px-4 py-2 rounded-lg no-theme bg-amber-700/50 hover:bg-amber-800 text-neutral-50 nuke-btn cursor-pointer"
                >
                  Nuke
                </button>
              </div>
            </div>

            <div className="flex flex-row flex-wrap gap-2.5 justify-center">
              <button>
                Eye
              </button>
            </div>

          </div>
        ) : null}

        {blockBanner ? (
          <div className="px-4 py-2 bg-red-500/20 text-red-100 text-center text-sm animate-alert-bounce-in">
            {blockBanner}
          </div>
        ) : null}
        {chatAlert ? (
          <div
            className={
              "px-4 py-2 bg-red-500/10 text-red-200 text-center text-sm " +
              (chatAlertAnimation === "bounce-in"
                ? "animate-alert-bounce-in"
                : chatAlertAnimation === "bounce-out"
                  ? "animate-alert-bounce-out"
                  : "")
            }
          >
            {chatAlert}
          </div>
        ) : null}

        <div
          ref={messagesContainerRef}
          className={`chat-messages flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide bg-transparent ${
            !selectedFriend ? "flex items-center justify-center" : ""
          }`}
        >
          {!selectedFriend ? (
            <div className="text-neutral-50/70 text-center cursor-default flex flex-col flex-wrap gap-2">
              <div className="text-lg">Created by Neuwair</div>
              <div className="text-lg">Illustrator and Programmer</div>
              <div className="flex flex-row items-center justify-center gap-4 text-lg">
                <a
                  href="https://x.com/neuwair"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:underline bouncy-hover"
                >
                  Twitter
                </a>
                <a
                  href="https://www.pixiv.net/en/users/102019144"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:underline bouncy-hover"
                >
                  Pixiv
                </a>
                <a
                  href="https://www.youtube.com/@Neuwair"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:underline bouncy-hover"
                >
                  YouTube
                </a>
                <a
                  href="https://github.com/Neuwair"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:underline bouncy-hover"
                >
                  GitHub
                </a>
              </div>
              <div className="">
                <p></p>
                <div className=" wrap-break-word max-w-lg text-lg">
                  {" "}
                  This project is intended solely as a demonstration of my
                  programming skills. To properly test the messaging system, you
                  will need to create a second account in a separate window or
                  have another user create an account so you can add each other
                  and exchange messages.
                </div>
              </div>
            </div>
          ) : isLoading && messages.length === 0 ? (
            <div className=" text-neutral-50/70 text-center">
              <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-neutral-50/70 text-center">
              No messages yet
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.clientMessageId}
                message={message}
                isOwn={message.senderId === user?.id}
                onRetry={handleRetryMessage}
                onMediaPreview={(source) => setSelectedImage(source)}
              />
            ))
          )}
        </div>

        <div
          className={
            "shrink-0 " + (showInputBounce ? "animate-input-push" : "")
          }
        >
          {selectedFriend ? (
            <div className="flex flex-col relative">
              {(showLimitMessage || isLimitMessageAnimatingOut) && (
                <div
                  className={`flex flex-row justify-center align-middle text-center p-4 text-red-100 cursor-default ${isLimitMessageAnimatingOut ? "animate-input-push-down" : "animate-input-push"}`}
                >
                  You can only attach up to 4 media files.
                </div>
              )}
              <MediaPreviewGrid
                mediaPreviews={mediaPreviews}
                onRemovePreview={handleRemoveMediaPreview}
              />
              <MessageInput
                value={messageInput}
                onChange={handleMessageInputChange}
                onSend={handleSendMessage}
                onMediaSelect={handleMediaSelect}
                onEmojiClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                isSending={isSending}
                disabled={!canSend}
                linkPreviews={linkPreviews}
                linkPreviewLoading={isLinkPreviewLoading}
                linkPreviewError={linkPreviewError}
                onDismissPreview={dismissLinkPreview}
              />
              {badgeVisible && unseenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const container = messagesContainerRef.current;
                    if (container) {
                      container.scrollTo({
                        top: container.scrollHeight,
                        behavior: "smooth",
                      });
                    }
                    clearUnseenBadge();
                  }}
                  className="absolute left-1/2 -translate-x-1/2 -top-8 bg-lime-700 text-neutral-50 px-4 py-2 rounded-lg text-sm font-semibold shadow-lg view-btn"
                >
                  {unseenCount} new message{unseenCount > 1 ? "s" : ""}
                </button>
              ) : null}
              {sendError ? (
                <div className="mt-2 text-sm text-red-200/80 text-center">
                  {sendError}
                </div>
              ) : null}
              {!canSend ? (
                <div className="mt-2 text-sm text-red-200/80 bg-neutral-700/50 p-4 text-center animate-alert-bounce-in">
                  {blockState.blockedByFriend
                    ? "You cannot message this user right now"
                    : blockState.blockedBySelf
                      ? "Unblock the user to continue messaging"
                      : "Select a friend to start chatting"}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};
