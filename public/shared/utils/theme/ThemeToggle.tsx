"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

const STORAGE_KEY = "kakioki-theme";

type ThemePreference = "dark" | "light" | null;

const getStoredTheme = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" ? "dark" : stored === "light" ? "light" : null;
  } catch {
    return null;
  }
};

const applyTheme = (theme: ThemePreference, pathname: string) => {
  if (pathname === "/") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
};

export const ThemeInitializer: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    const storedTheme = getStoredTheme();
    applyTheme(storedTheme, pathname ?? "/");
  }, [pathname]);

  return null;
};

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
      className="w-10 h-10 p-2 rounded-lg hover:bg-neutral-700/50 text-neutral-50 border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer interface-btn"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <FontAwesomeIcon aria-hidden="true" icon={isDark ? faMoon : faSun} />
    </button>
  );
};

export default ThemeToggle;
