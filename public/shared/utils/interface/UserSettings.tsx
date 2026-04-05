"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
  faFaceSmile,
  faSpinner,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/lib/auth/ClientAuth";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { useFriendRelationships } from "@/public/shared/hooks/FriendRelationships";
import { getAuthHeaders } from "@/public/shared/helpers/AuthHelpers";
import { PASSWORD_STORAGE_KEY } from "@/public/shared/helpers/LibsodiumHelpers";
import {
  buildPresencePayload,
  setStoredCurrentUserPresenceStatus,
  type PresenceStatus,
} from "@/public/shared/logic/UserPresenceRealtime";
import { getRealtimeClient } from "@/public/shared/services/AblyRealtime";
import { SafeImage } from "@/public/shared/utils/chat/MessageMedia";
import { EmojiPicker } from "@/public/shared/utils/interface/EmojiPicker";
import { AvatarUploadModal } from "@/public/shared/utils/interface/AvatarSelection";
import {
  useUserPresence,
  useCurrentUserPresence,
} from "@/public/shared/logic/UserPresenceRealtime";

export default function UserSettings({ onBack }: { onBack?: () => void } = {}) {
  const { user, refreshCurrentUser, isLoading } = useAuth();
  const { friends, refresh: refreshRelationships } = useFriendRelationships();
  const presence = useCurrentUserPresence();
  const initialBio = user?.bio || "";
  const initialEmail = user?.email || "";
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [bio, setBio] = useState<string>(initialBio);
  const [originalBio, setOriginalBio] = useState<string>(initialBio);
  const [email, setEmail] = useState<string>(initialEmail);
  const [originalEmail, setOriginalEmail] = useState<string>(initialEmail);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState<PresenceStatus | null>(null);
  const [unblockingIds, setUnblockingIds] = useState<Set<number>>(new Set());
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [emailAlertVisible, setEmailAlertVisible] = useState(false);
  const [bioCursorPosition, setBioCursorPosition] = useState<number | null>(
    null,
  );
  const bioEditRef = useRef<HTMLDivElement>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bioEmojiButtonRef = useRef<HTMLButtonElement>(null);
  const blockedUsers = friends.filter((entry) => entry.blockedBySelf);

  const statusContent = (() => {
    if (!presence.isReady) {
      return (
        <div className="flex items-center gap-2 text-xs cursor-default text-neutral-100/80">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-600 "></span>
          </span>
          Checking status…
        </div>
      );
    }

    const isOnline = presence.status === "online";
    const isAway = presence.status === "away";
    const label = isOnline ? "Online" : isAway ? "Away" : "Offline";
    const labelColor = isOnline
      ? "text-emerald-200"
      : isAway
        ? "text-amber-200"
        : "text-rose-200";
    const dotColor = isOnline
      ? "bg-emerald-400"
      : isAway
        ? "bg-amber-400"
        : "bg-rose-400";
    const haloColor = isOnline
      ? "bg-emerald-400/60"
      : isAway
        ? "bg-amber-400/50"
        : "bg-rose-400/50";
    const dotAnimation = isOnline ? "animate-pulse" : "";

    return (
      <div
        className={`flex items-center gap-2 text-sm cursor-default ${labelColor}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${haloColor} ${isOnline ? "motion-safe:animate-[ping_1.8s_ease-in-out_infinite]" : ""}`}
          ></span>
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor} ${dotAnimation}`}
          ></span>
        </span>
        {label}
      </div>
    );
  })();

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const openAvatarModal = useCallback(() => setIsAvatarModalOpen(true), []);
  const closeAvatarModal = useCallback(() => setIsAvatarModalOpen(false), []);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentBio = user?.bio || KAKIOKI_CONFIG.account.defaultBio;
    setBio(currentBio);
    setOriginalBio(currentBio);
  }, [isLoading, user?.bio]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentEmail = user?.email || "";
    setOriginalEmail(currentEmail);

    if (!isEditingEmail) {
      setEmail(currentEmail);
    }
  }, [isEditingEmail, isLoading, user?.email]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const emojiPicker = document.querySelector(".kakioki-emoji-picker");

      if (emojiPicker && emojiPicker.contains(target)) {
        return;
      }

      setIsEmojiPickerOpen(false);

      if (bioEditRef.current && !bioEditRef.current.contains(target)) {
        setBio(originalBio);
        setIsEditingBio(false);
      }
    };

    if (isEditingBio) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditingBio, originalBio]);

  useEffect(() => {
    if (!isEditingBio || !bioTextareaRef.current) {
      return;
    }

    const cursorPosition = bio.length;

    window.requestAnimationFrame(() => {
      if (!bioTextareaRef.current) {
        return;
      }

      bioTextareaRef.current.focus();
      bioTextareaRef.current.selectionStart = cursorPosition;
      bioTextareaRef.current.selectionEnd = cursorPosition;
      setBioCursorPosition(cursorPosition);
    });
  }, [bio.length, isEditingBio]);

  const saveBio = async () => {
    setIsSavingBio(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id.toString(),
          biography: bio,
        }),
      });

      if (response.ok) {
        setIsEditingBio(false);
        setOriginalBio(bio);
        await refreshCurrentUser();
      } else {
        setError("Failed to save biography");
        setAlertVisible(true);
      }
    } catch (err) {
      setError("Network error");
      setAlertVisible(true);
    } finally {
      setIsSavingBio(false);
    }
  };

  const cancelBioEdit = () => {
    setBio(originalBio);
    setIsEditingBio(false);
  };

  const cancelPasswordChange = () => {
    setPassword("");
    setNewPassword("");
    setError(null);
    setSuccess(false);
    setAlertVisible(false);
  };

  const startEmailEdit = () => {
    if (isEditingEmail) {
      return;
    }

    setEmail("");
    setEmailError(null);
    setEmailSuccess(false);
    setEmailAlertVisible(false);
    setIsEditingEmail(true);
  };

  const cancelEmailChange = () => {
    setEmail("");
    setIsEditingEmail(false);
    setEmailError(null);
    setEmailSuccess(false);
    setEmailAlertVisible(false);
  };

  const hasPasswordFields =
    password.trim().length > 0 && newPassword.trim().length > 0;
  const hasEmailFields = isEditingEmail;

  const handleBioKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveBio();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelBioEdit();
    }
  };

  useEffect(() => {
    if (!alertVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAlertVisible(false);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [alertVisible]);

  useEffect(() => {
    if (alertVisible || (!error && !success)) {
      return;
    }

    const cleanupTimer = window.setTimeout(() => {
      setError(null);
      setSuccess(false);
    }, 280);

    return () => {
      window.clearTimeout(cleanupTimer);
    };
  }, [alertVisible, error, success]);

  useEffect(() => {
    if (!emailAlertVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      setEmailAlertVisible(false);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [emailAlertVisible]);

  useEffect(() => {
    if (emailAlertVisible || (!emailError && !emailSuccess)) {
      return;
    }

    const cleanupTimer = window.setTimeout(() => {
      setEmailError(null);
      setEmailSuccess(false);
    }, 280);

    return () => {
      window.clearTimeout(cleanupTimer);
    };
  }, [emailAlertVisible, emailError, emailSuccess]);

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSavingPassword(true);
    const nextPassword = newPassword;

    if (!user?.id) {
      setError("User not authenticated");
      setSuccess(false);
      setAlertVisible(true);
      setIsSavingPassword(false);
      return;
    }

    const isPasswordChange = newPassword.trim().length > 0;
    if (isPasswordChange && password.trim().length === 0) {
      setError("Please enter your current password to change your password.");
      setSuccess(false);
      setAlertVisible(true);
      setIsSavingPassword(false);
      return;
    }

    if (isPasswordChange && newPassword.trim().length < 8) {
      setError("New password must be at least 8 characters long.");
      setSuccess(false);
      setAlertVisible(true);
      setIsSavingPassword(false);
      return;
    }

    if (isPasswordChange && password === newPassword) {
      setError("New password must be different from your current password.");
      setSuccess(false);
      setAlertVisible(true);
      setIsSavingPassword(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id.toString(),
          currentPassword: password,
          newPassword: newPassword,
          biography: bio,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isPasswordChange) {
          sessionStorage.setItem(PASSWORD_STORAGE_KEY, nextPassword);
        }
        setSuccess(true);
        setError(null);
        setAlertVisible(true);
        setPassword("");
        setNewPassword("");
        setIsEditingBio(false);
      } else {
        setError(data.error || "Failed to update profile");
        setSuccess(false);
        setAlertVisible(true);
      }
    } catch (err) {
      setError("Network error");
      setSuccess(false);
      setAlertVisible(true);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleEmailSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setEmailError(null);
    setEmailSuccess(false);
    setIsSavingEmail(true);

    if (!user?.id) {
      setIsSavingEmail(false);
      return;
    }

    const nextEmail = email.trim().toLowerCase();
    const currentEmail = originalEmail.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+$/.test(nextEmail);

    if (nextEmail === currentEmail) {
      setEmailError("This @email address is the same as the current one.");
      setEmailSuccess(false);
      setEmailAlertVisible(true);
      setIsSavingEmail(false);
      return;
    }

    if (!isValidEmail) {
      setEmailError("This @email address is invalid.");
      setEmailSuccess(false);
      setEmailAlertVisible(true);
      setIsSavingEmail(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id.toString(),
          email: nextEmail,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        setOriginalEmail(nextEmail);
        setEmail("");
        setIsEditingEmail(false);
        setEmailSuccess(true);
        setEmailError(null);
        setEmailAlertVisible(true);
        await refreshCurrentUser();
      } else {
        setEmailError(
          data?.error === "This @email address is the same as the current one."
            ? data.error
            : "This @email address is invalid.",
        );
        setEmailSuccess(false);
        setEmailAlertVisible(true);
      }
    } catch (err) {
      setEmailError("This @email address is invalid.");
      setEmailSuccess(false);
      setEmailAlertVisible(true);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleUnblockUser = async (targetUserId: number) => {
    if (unblockingIds.has(targetUserId)) {
      return;
    }

    setUnblockingIds((prev) => new Set(prev).add(targetUserId));

    try {
      const response = await fetch("/api/chat/unblock", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unblock failed");
      }
      await refreshRelationships();
    } catch (unblockError) {
      console.error("Unblock user error:", unblockError);
    } finally {
      setUnblockingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const handleStatusChange = async (nextStatus: PresenceStatus) => {
    if (
      !user?.id ||
      !user.userId ||
      isUpdatingStatus ||
      presence.status === nextStatus
    ) {
      return;
    }

    setIsUpdatingStatus(nextStatus);

    try {
      const client = await getRealtimeClient();
      const channel = client.channels.get(
        `user:${user.id}:presence`,
      ) as unknown as {
        attach: () => Promise<unknown>;
        presence: {
          enter: (data: unknown) => Promise<unknown>;
          update: (data: unknown) => Promise<unknown>;
        };
      };
      const payload = buildPresencePayload(user.userId, nextStatus);

      await channel.attach();

      try {
        await channel.presence.update(payload);
      } catch {
        await channel.presence.enter(payload);
      }

      setStoredCurrentUserPresenceStatus(nextStatus);
    } catch (statusError) {
      console.error("User status update error:", statusError);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  return (
    <div className="text-neutral-50 flex flex-col flex-wrap gap-4">
      <div className="flex flex-row-reverse">
        {onBack && (
          <div className="flex flex-row-reverse">
            <button
              onClick={onBack}
              className="p-4 rounded-lg hover:bg-neutral-700/50 text-neutral-50 border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer interface-btn"
            >
              ← Back to Chat
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-row gap-4 max-xl:flex-col max-lg:flex-col">
        <div className="justify-center flex min-w-0 flex-1 rounded-lg bg-white/5 border border-white/10 text-neutral-50">
          <div className="flex flex-col w-full p-4 gap-4 rounded-lg">
            <div className="flex flex-row gap-4 p-4 bg-white/5 rounded-tl-lg rounded-tr-lg">
              {" "}
              <div className="flex align-middle justify-center items-center">
                <div
                  className="w-20 h-20 rounded-full bg-white/5 border border-white/20 overflow-hidden flex items-center justify-center cursor-pointer"
                  onClick={openAvatarModal}
                  title="Change avatar"
                >
                  {user?.avatarUrl ? (
                    <div className="relative w-full h-full">
                      <SafeImage
                        src={user.avatarUrl}
                        alt="User Avatar"
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    "Avatar"
                  )}
                </div>
              </div>
              <div className="flex flex-col justify-center flex-1 min-w-0 ">
                <div className="h-full text-sm flex items-center text-neutral-50 cursor-default">
                  {user?.username || "Your Username"}
                </div>
                {statusContent}
                <div className="h-full text-sm flex items-center text-neutral-50/70">
                  {user?.userId ? `ID: ${user.userId}` : "Your ID"}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-2 min-w-0">
              <div className="h-full min-w-0">
                {isEditingBio ? (
                  <div className="flex flex-col gap-2" ref={bioEditRef}>
                    <div className="flex flex-col items-center bg-white/10 rounded-bl-lg rounded-br-lg">
                      <textarea
                        ref={bioTextareaRef}
                        value={bio}
                        onChange={(e) => {
                          setBio(e.target.value);
                          setBioCursorPosition(e.target.selectionStart);
                        }}
                        onSelect={(e) => {
                          setBioCursorPosition(
                            (e.target as HTMLTextAreaElement).selectionStart,
                          );
                        }}
                        onKeyDown={handleBioKeyDown}
                        maxLength={100}
                        className="text-lg p-4 w-full h-24 bg-transparent text-neutral-50 focus:outline-none focus:ring focus:ring-lime-500 focus:rounded-bl-lg focus:rounded-br-lg resize-none"
                        placeholder="Enter your biography"
                      />
                      <div className="hidden md:flex p-2 w-full flex-row">
                        <button
                          ref={bioEmojiButtonRef}
                          type="button"
                          onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                          className="rounded-lg p-2 hover:bg-neutral-700/50 text-neutral-50 flex items-center justify-center text-center transition-colors duration-200 interface-btn emoji-button"
                        >
                          <FontAwesomeIcon icon={faFaceSmile} size="lg" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-row-reverse gap-3">
                      <button
                        type="button"
                        onClick={cancelBioEdit}
                        className="px-4 py-2 rounded-lg no-theme bg-white/5 border border-white/20 hover:bg-red-700 text-neutral-50 cancel-btn cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveBio}
                        disabled={isSavingBio}
                        className="px-4 py-2 rounded-lg no-theme bg-lime-700 hover:bg-lime-800 text-neutral-50 save-btn cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSavingBio ? (
                          <span className="flex items-center gap-2 justify-center">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </span>
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingBio(true)}
                    className="cursor-pointer text-sm text-neutral-50/80 p-4 flex h-full items-center"
                    title="Click to edit biography"
                  >
                    {isLoading ? "" : bio || KAKIOKI_CONFIG.account.defaultBio}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col flex-wrap p-4 rounded-lg bg-white/5 border border-white/10 flex-1 justify-center">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="flex flex-col flex-1 gap-4 mb-4">
              <div className="flex flex-col gap-4">
                <label
                  htmlFor="currentPassword"
                  className="block text-responsive text-neutral-50 text-2xl"
                >
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300"
                  placeholder="Enter current password"
                />
              </div>
              <div className="flex flex-col gap-4">
                <label
                  htmlFor="newPassword"
                  className="block text-responsive text-neutral-50 text-2xl"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-3 py-2 pr-10 border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-neutral-50"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {(error || success || alertVisible) && (
                <div
                  className={`flex flex-row justify-start align-middle text-center cursor-default ${
                    alertVisible
                      ? "animate-alert-bounce-in"
                      : "animate-alert-bounce-out"
                  } ${error ? "text-red-100" : "text-lime-100"}`}
                >
                  {" "}
                  {error || (success ? "Password Changed Successfully!" : "")}
                </div>
              )}
              {hasPasswordFields && (
                <div className="flex flex-row-reverse animate-button-bounce-in gap-2">
                  <button
                    type="button"
                    onClick={cancelPasswordChange}
                    className="px-4 py-2 rounded-lg no-theme bg-white/5 border border-white/20 hover:bg-red-700 text-neutral-50 cancel-btn cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="px-4 py-2 rounded-lg no-theme bg-lime-700 hover:bg-lime-800 text-neutral-50 save-btn cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSavingPassword ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
        <div className="flex flex-col flex-wrap p-4 rounded-lg bg-white/5 border border-white/10 flex-1 justify-center">
          <form
            onSubmit={handleEmailSubmit}
            noValidate
            className="flex flex-col flex-1"
          >
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-4">
                <label
                  htmlFor="currentEmail"
                  className="block text-responsive text-neutral-50 text-2xl"
                >
                  This is your @email
                </label>
                <input
                  type="email"
                  id="currentEmail"
                  name="email"
                  value={isEditingEmail ? email : originalEmail}
                  onClick={startEmailEdit}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={!isEditingEmail}
                  autoComplete="email"
                  className="w-full px-3 py-2 pr-10 border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300"
                  placeholder="Enter your new @email"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {(emailError || emailSuccess || emailAlertVisible) && (
                <div
                  className={`flex flex-row justify-start align-middle text-center cursor-default ${
                    emailAlertVisible
                      ? "animate-alert-bounce-in"
                      : "animate-alert-bounce-out"
                  } ${emailError ? "text-red-100" : "text-lime-100"}`}
                >
                  {" "}
                  {emailError ||
                    (emailSuccess
                      ? "Your @email address has been successfully changed!"
                      : "")}
                </div>
              )}
              {hasEmailFields && (
                <div className="flex flex-row-reverse animate-button-bounce-in gap-2">
                  <button
                    type="button"
                    onClick={cancelEmailChange}
                    className="px-4 py-2 rounded-lg no-theme bg-white/5 border border-white/20 hover:bg-red-700 text-neutral-50 cancel-btn cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEmail}
                    className="px-4 py-2 rounded-lg no-theme bg-lime-700 hover:bg-lime-800 text-neutral-50 save-btn cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSavingEmail ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
        <EmojiPicker
          isOpen={isEmojiPickerOpen}
          triggerRef={bioEmojiButtonRef}
          placement="below"
          desktopOnly
          onEmojiSelect={(emoji) => {
            setBio((prevBio) => {
              const insertAt =
                bioTextareaRef.current?.selectionStart ??
                bioCursorPosition ??
                prevBio.length;
              const newBio =
                prevBio.slice(0, insertAt) +
                emoji.native +
                prevBio.slice(insertAt);
              const nextCursorPos = insertAt + emoji.native.length;

              window.requestAnimationFrame(() => {
                if (bioTextareaRef.current) {
                  bioTextareaRef.current.focus();
                  bioTextareaRef.current.selectionStart = nextCursorPos;
                  bioTextareaRef.current.selectionEnd = nextCursorPos;
                }
              });

              setBioCursorPosition(nextCursorPos);
              return newBio;
            });
          }}
          onClickOutside={() => setIsEmojiPickerOpen(false)}
        />
      </div>
      <div className="flex flex-col flex-wrap p-4 rounded-lg bg-white/5 border border-white/10 flex-1 justify-start min-h-0">
        <div className="flex flex-col gap-4 min-h-0 flex-1 justify-center">
          <label className="block text-responsive text-neutral-50 text-2xl">
            Blocked users
          </label>

          <div className="rounded-lg border-white/10 bg-white/5 overflow-hidden min-h-0">
            {blockedUsers.length === 0 ? (
              <div className="text-center text-neutral-50/70 bg-transparent py-6 text-sm">
                You have not blocked anyone... yet
              </div>
            ) : (
              <div className="flex flex-col max-h-90 overflow-y-auto scrollbar-hide">
                <ul className="divide-y divide-white/10">
                  {blockedUsers.map((entry) => {
                    const isUnblocking = unblockingIds.has(entry.user.id);
                    return (
                      <li
                        key={entry.user.id}
                        className="flex flex-row flex-wrap items-center justify-between px-4 p-4 gap-1 hover:bg-black/20 transition-colors"
                      >
                        <div className="flex flex-row flex-wrap gap-4 justify-center align-middle items-center">
                          <div className="w-15 h-15 rounded-full border border-white/20 flex items-center justify-center overflow-hidden">
                            {entry.user.avatarUrl ? (
                              <div className="relative w-full h-full">
                                <SafeImage
                                  src={entry.user.avatarUrl}
                                  alt={`${entry.user.username}'s avatar`}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <FontAwesomeIcon
                                icon={faUser}
                                size="lg"
                                className="text-neutral-50/70"
                              />
                            )}
                          </div>
                          <div className="flex flex-col justify-center flex-wrap">
                            <h3 className="text-neutral-50">
                              {entry.user.username}
                            </h3>
                            <p className="text-neutral-50/60 text-sm">
                              ID: {entry.user.userId}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-row gap-4 items-center flex-wrap">
                          <button
                            type="button"
                            className="px-5 p-2 border border-white/20 hover:bg-red-800 text-neutral-50 rounded-md flex items-center gap-1 cancel-btn"
                            onClick={() => handleUnblockUser(entry.user.id)}
                            disabled={isUnblocking}
                          >
                            {isUnblocking ? (
                              <FontAwesomeIcon
                                icon={faSpinner}
                                className="animate-spin"
                              />
                            ) : null}
                            {isUnblocking ? "Unblocking" : "Unblock"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col flex-wrap p-4 rounded-lg bg-white/5 border border-white/10 flex-1 justify-start min-h-0">
        <div className="flex flex-col gap-4">
          <label
            htmlFor="setStatus"
            className="block text-responsive text-neutral-50 text-2xl"
          >
            Change your status
          </label>
          <div className="flex flex-row gap-2">
            <button
              type="button"
              onClick={() => handleStatusChange("online")}
              disabled={isUpdatingStatus !== null}
              className="px-4 py-2 rounded-lg no-theme bg-lime-700 hover:bg-lime-800 text-neutral-50 online-btn cursor-pointer disabled:cursor-not-allowed"
            >
              {isUpdatingStatus === "online" ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Online
                </span>
              ) : (
                "Online"
              )}
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("away")}
              disabled={isUpdatingStatus !== null}
              className="px-4 py-2 rounded-lg no-theme bg-amber-600 hover:bg-amber-700 text-neutral-50 away-btn cursor-pointer disabled:cursor-not-allowed"
            >
              {isUpdatingStatus === "away" ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Away
                </span>
              ) : (
                "Away"
              )}
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("offline")}
              disabled={isUpdatingStatus !== null}
              className="px-4 py-2 rounded-lg no-theme bg-red-600 hover:bg-red-800 text-neutral-50 offline-btn cursor-pointer disabled:cursor-not-allowed"
            >
              {isUpdatingStatus === "offline" ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Offline
                </span>
              ) : (
                "Offline"
              )}
            </button>
          </div>
        </div>
      </div>
      <AvatarUploadModal
        isOpen={isAvatarModalOpen}
        onClose={closeAvatarModal}
      />
    </div>
  );
}
