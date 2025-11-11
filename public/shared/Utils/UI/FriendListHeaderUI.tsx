"use client";

import React from "react";
import { FriendItem } from "@/public/shared/Utils/UI/FriendListUsersUI";
import type { FriendListEntry } from "@/public/shared/hooks/useFriendRelationships";

interface FriendListHeaderProps {
  friends: FriendListEntry[];
  isLoading: boolean;
  onSelect?: (friend: FriendListEntry) => void;
}

export const FriendListHeader: React.FC<FriendListHeaderProps> = ({
  friends,
  isLoading,
  onSelect,
}) => {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = React.useState(false);
  const lastScrollTime = React.useRef(0);

  const checkScrollability = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      const hasScrollableContent = el.scrollWidth > el.clientWidth;
      setCanScroll(hasScrollableContent);
    }
  }, []);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      const el = scrollRef.current;
      if (!el) return;

      const now = Date.now();
      if (now - lastScrollTime.current < 16) return;
      lastScrollTime.current = now;

      if (canScroll && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        event.stopPropagation();

        const scrollAmount = event.deltaY * 2.5;
        el.scrollBy({
          left: scrollAmount,
          behavior: "smooth",
        });
      }
    },
    [canScroll]
  );

  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    checkScrollability();
    const resizeObserver = new ResizeObserver(checkScrollability);
    resizeObserver.observe(element);

    const timeoutId = setTimeout(() => {
      const listener = (event: WheelEvent) => handleWheel(event);
      element.addEventListener("wheel", listener, {
        passive: false,
        capture: true,
      });
      return () => {
        element.removeEventListener("wheel", listener, true);
      };
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [handleWheel, checkScrollability]);

  React.useEffect(() => {
    checkScrollability();
  }, [friends, checkScrollability]);
  if (isLoading) {
    return (
      <div className="relative overflow-hidden">
        <div className="flex items-center gap-3 min-h-[80px] p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-amber-50/60 my-2 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-white/10" />
          <div className="flex-1 h-6 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="relative overflow-hidden">
        <div className="flex items-center justify-center min-h-[80px] p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-amber-50/60 my-2">
          <p className="text-center">You don&apos;t have any friends yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollbarGutter: "stable",
          scrollBehavior: "smooth",
        }}
      >
        <div className="inline-block min-w-full p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-amber-50 my-2">
          <div className="flex flex-row items-center whitespace-nowrap gap-3">
            {friends.map((entry) => (
              <FriendItem
                key={entry.user.id}
                friend={{
                  username: entry.user.username,
                  avatarUrl: entry.user.avatarUrl,
                }}
                onClick={() => onSelect?.(entry)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
