"use client";

import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faTimes } from "@fortawesome/free-solid-svg-icons";
import ThemeToggle from "@/public/shared/Utils/Theme/ThemeToggle";
import { useFriendSearch } from "@/public/shared/hooks/useFriendSearch";
import { FriendSearchDropdown } from "@/public/shared/Utils/UI/FriendSearchDropdownUI";

export const FriendSearchHeader: React.FC = () => {
  const {
    query,
    setQuery,
    results,
    isSearching,
    error,
    requestingIds,
    cancelingIds,
    acceptingIds,
    sendFriendRequest,
    cancelFriendRequest,
    acceptFriendRequest,
  } = useFriendSearch();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const listener = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
    };
  }, [isOpen]);

  const showDropdown =
    isOpen && (query.trim().length > 0 || isSearching || !!error);

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSearchButtonClick = () => {
    if (query.trim()) {
      setIsOpen((prev) => !prev);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSearchClear = () => {
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative transition-all duration-300" ref={containerRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            id="friend-search-header-input"
            name="friendSearchHeader"
            placeholder="Search a friend"
            autoComplete="off"
            maxLength={10}
            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-amber-50 placeholder-amber-50/50 searchbar-item"
            value={query}
            onChange={(e) => {
              const newQuery = e.target.value;
              setQuery(newQuery);
              if (!newQuery.trim()) {
                setIsOpen(false);
              } else if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onFocus={handleInputFocus}
          />
          {query && (
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-amber-50/50 hover:text-amber-50"
              onClick={handleSearchClear}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-gray-700/50 text-amber-50 border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer interface-btn"
          onClick={handleSearchButtonClick}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} size="lg" />
        </button>
        <ThemeToggle />
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-5 w-full bg-neutral-800/60 border border-white/20 rounded-lg shadow-lg max-h-50 overflow-y-auto scrollbar-hide user-header animate-dropdown-appear">
          <FriendSearchDropdown
            query={query}
            results={results}
            isSearching={isSearching}
            error={error}
            requestingIds={requestingIds}
            cancelingIds={cancelingIds}
            acceptingIds={acceptingIds}
            onAdd={sendFriendRequest}
            onCancel={cancelFriendRequest}
            onAccept={acceptFriendRequest}
          />
        </div>
      )}
    </div>
  );
};
