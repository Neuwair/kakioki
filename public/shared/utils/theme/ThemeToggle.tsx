"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

const STORAGE_KEY = "kakioki-theme";

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDark]);

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {}
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDark]);

  return (
    <button
      type="button"
      className="p-2 rounded-lg hover:bg-neutral-700/50 text-neutral-50 border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer interface-btn"
      onClick={toggle}
      aria-pressed={isDark}
    >
      <FontAwesomeIcon icon={isDark ? faMoon : faSun} size="lg" />
    </button>
  );
};

export default ThemeToggle;
