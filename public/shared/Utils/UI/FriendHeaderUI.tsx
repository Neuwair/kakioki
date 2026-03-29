"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faTimes } from "@fortawesome/free-solid-svg-icons";
import { SafeImage } from "@/public/shared/Utils/Props/MediaProps";
import { useUserPresence } from "@/public/shared/Realtime/useUserPresence";

export const ChatUserHeader: React.FC<{
  selectedFriend?: {
    id: number;
    username: string;
    avatar_url?: string | null;
    avatarUrl?: string | null;
    userId?: string;
  } | null;
  onClose?: () => void;
  actions?: React.ReactNode;
}> = ({ selectedFriend, onClose, actions = null }) => {
  const presence = useUserPresence(selectedFriend?.id ?? null);

  if (!selectedFriend) {
    return (
      <div className=" bg-white/5 backdrop-blur-lg sticky top-0 z-20 min-h-[80px] flex items-center justify-center user-header">
        <p className="text-lg text-amber-50/70 font-medium cursor-default">
          Select a friend to start a message
        </p>
      </div>
    );
  }

  const statusContent = (() => {
    if (!presence.isReady) {
      return (
        <div className="mt-1 flex items-center gap-2 text-xs text-amber-100/80">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-600 motion-safe:animate-[ping_1.8s_ease-in-out_infinite]"></span>
          </span>
          Checking status…
        </div>
      );
    }

    const isOnline = presence.status === "online";
    const label = isOnline ? "Online" : "Offline";
    const labelColor = isOnline ? "text-emerald-200" : "text-rose-200";
    const dotColor = isOnline ? "bg-emerald-400" : "bg-rose-400";
    const haloColor = isOnline ? "bg-emerald-400/60" : "bg-rose-400/50";

    return (
      <div className={`mt-1 flex items-center gap-2 text-xs ${labelColor}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${haloColor} motion-safe:animate-[ping_1.8s_ease-in-out_infinite]`}
          ></span>
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`}
          ></span>
        </span>
        {label}
      </div>
    );
  })();

  return (
    <div className="bg-white/5 sticky top-0 z-20 user-header shadow-[0_9px_12px_-4px_rgba(0,0,0,0.20)]">
      <div className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/20 overflow-hidden flex items-center justify-center">
          {(() => {
            const avatar =
              selectedFriend.avatar_url ??
              selectedFriend.avatarUrl ??
              undefined;
            if (!avatar) {
              return (
                <FontAwesomeIcon
                  icon={faUser}
                  size="lg"
                  className="text-amber-50/70"
                />
              );
            }
            return (
              <div className="relative w-full h-full">
                <SafeImage
                  src={avatar}
                  alt={`${selectedFriend.username}'s avatar`}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            );
          })()}
        </div>
        <div className="flex-1 cursor-default">
          <h3 className="text-lg font-semibold text-amber-50">
            {selectedFriend.username}
          </h3>
          {statusContent}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-gray-700/50 text-amber-50 flex items-center justify-center cursor-pointer transition-all duration-200 interface-btn"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>
      </div>
    </div>
  );
};
