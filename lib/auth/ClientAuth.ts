"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  userLifecycleChannel,
  APP_PRESENCE_CHANNEL,
  type AccountLifecycleEvent,
} from "@/lib/events/RealtimeEvents";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import type { User } from "@/lib/media/MediaTypes";
import {
  cachePublicKey,
  clearStoredPrivateKey,
  ensurePrivateKey,
} from "@/public/shared/helpers/LibsodiumHelpers";
import {
  buildPresencePayload,
  CURRENT_USER_PRESENCE_STATUS_EVENT,
  getCurrentUserPresenceStatusStorageKey,
  getStoredCurrentUserPresenceStatus,
  type PresenceStatus,
} from "@/public/shared/logic/UserPresenceRealtime";
import {
  closeRealtimeClient,
  getRealtimeClient,
  isRealtimeClientClosing,
  reauthorizeRealtimeClient,
} from "@/public/shared/services/AblyRealtime";
import { getTabSessionId, sessionKey } from "@/public/shared/helpers/TabSessionHelpers";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (
    email: string,
    username: string,
    password: string,
  ) => Promise<{ success: boolean; userId?: number; error?: string }>;
  updateAvatar: (file: File) => Promise<{ success: boolean; error?: string }>;
  refreshCurrentUser: () => Promise<void>;
  clearSession: () => void;
  logout: () => void;
}

type ChannelStateChange = { reason?: { code?: number } | null };

type LifecycleChannel = {
  subscribe: (listener: (message: { data: unknown }) => void) => void;
  unsubscribe: (listener: (message: { data: unknown }) => void) => void;
  on: (event: string, listener: (change: ChannelStateChange) => void) => void;
  off: (listener: (change: ChannelStateChange) => void) => void;
};

type AuthBroadcastMessage =
  | { type: "token_updated"; tabSessionId: string; token: string }
  | { type: "logout"; tabSessionId: string };

type RunAuthCheckParams = {
  controller: AbortController;
  logout: () => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_COOKIE_NAME = "kakiokiToken";

function setAuthCookie(token: string) {
  if (typeof document === "undefined") {
    return;
  }
  const maxAge = KAKIOKI_CONFIG.auth.cookieMaxAgeSeconds;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : "";
  document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

function clearAuthCookie() {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export async function refreshUser(
  userId: number,
  token: string,
  signal?: AbortSignal,
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch("/api/auth/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "unauthorized" };
      }
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: data?.error || "Failed to refresh user",
      };
    }

    const data = await response.json();
    if (data?.success && data?.user) {
      return { success: true, user: data.user };
    }

    return { success: false, error: "Invalid response from server" };
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      return { success: false, error: "Network error" };
    }
    const errMsg = err instanceof Error ? err.message : String(err ?? "");
    if (!/NetworkError|Failed to fetch|Load failed/i.test(errMsg)) {
      console.error("refreshUser error:", err);
    }
    return { success: false, error: "Network error" };
  }
}

async function loginRequest(
  email: string,
  password: string,
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.error || "Login failed" };
    }

    return { success: true, user: data.user, token: data.token };
  } catch (err) {
    console.error("loginRequest error:", err);
    return { success: false, error: "Network error" };
  }
}

async function registerRequest(
  email: string,
  username: string,
  password: string,
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.error || "Registration failed" };
    }

    return { success: true, user: data.user, token: data.token };
  } catch (err) {
    console.error("registerRequest error:", err);
    return { success: false, error: "Network error" };
  }
}

export async function uploadAvatar(
  file: File,
  userId: number,
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId.toString());

    const response = await fetch("/api/auth/avatar", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.error || "Avatar upload failed" };
    }

    return { success: true, avatarUrl: data.avatarUrl };
  } catch (err) {
    console.error("uploadAvatar error:", err);
    return { success: false, error: "Network error" };
  }
}

async function runAuthCheck({
  controller,
  logout,
  setIsLoading,
  setUser,
}: RunAuthCheckParams) {
  try {
    const storedUser = sessionStorage.getItem(sessionKey("user"));
    const storedToken = sessionStorage.getItem(sessionKey("token"));
    const storedPassword = sessionStorage.getItem(sessionKey("password"));

    if (storedUser && storedToken) {
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      if (parsedUser?.publicKey) {
        await cachePublicKey(parsedUser.publicKey);
      }

      if (parsedUser?.id) {
        try {
          const result = await refreshUser(
            parsedUser.id,
            storedToken,
            controller.signal,
          );
          if (controller.signal.aborted) {
            return;
          }
          if (result.success && result.user) {
            setUser(result.user);
            sessionStorage.setItem(sessionKey("user"), JSON.stringify(result.user));
            if (result.user.publicKey) {
              await cachePublicKey(result.user.publicKey);
            }
            if (storedPassword && result.user.secretKeyEncrypted) {
              try {
                await ensurePrivateKey(
                  storedPassword,
                  result.user.secretKeyEncrypted,
                );
              } catch (refreshKeyError) {
                console.error(
                  "Failed to unlock private key after refresh:",
                  refreshKeyError,
                );
              }
            }
          } else if (result.error === "unauthorized") {
            logout();
            setIsLoading(false);
            return;
          }
        } catch (refreshError) {
          console.error("Error refreshing user data:", refreshError);
        }
      }

      if (storedPassword && parsedUser?.secretKeyEncrypted) {
        try {
          await ensurePrivateKey(storedPassword, parsedUser.secretKeyEncrypted);
        } catch (unlockError) {
          console.error(
            "Failed to unlock private key from session:",
            unlockError,
          );
        }
      }

      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  } catch (error) {
    console.error("Authentication check failed:", error);
    setIsLoading(false);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(false);
  const isLoggingOutRef = useRef(false);
  const hasLoggedOutRef = useRef(false);
  const presenceCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const clearSession = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(sessionKey("user"));
    sessionStorage.removeItem(sessionKey("token"));
    sessionStorage.removeItem(sessionKey("password"));
    clearStoredPrivateKey();
    clearAuthCookie();
  }, []);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    hasLoggedOutRef.current = true;

    broadcastChannelRef.current?.close();
    broadcastChannelRef.current = null;

    try {
      const presenceLeave = presenceCleanupRef.current;
      presenceCleanupRef.current = null;
      if (presenceLeave) {
        await presenceLeave();
      }
      closeRealtimeClient();
    } catch {}

    if (typeof window !== "undefined") {
      const bc = new BroadcastChannel("kakioki:auth");
      bc.postMessage({
        type: "logout",
        tabSessionId: getTabSessionId(),
      } satisfies AuthBroadcastMessage);
      bc.close();
    }

    clearSession();

    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [clearSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bc = new BroadcastChannel("kakioki:auth");
    broadcastChannelRef.current = bc;
    const handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      if (hasLoggedOutRef.current) return;
      if (event.data.tabSessionId !== getTabSessionId()) return;
      switch (event.data.type) {
        case "token_updated":
          break;
        case "logout":
          break;
      }
    };
    bc.addEventListener("message", handleMessage);
    return () => {
      bc.removeEventListener("message", handleMessage);
      bc.close();
      if (broadcastChannelRef.current === bc) {
        broadcastChannelRef.current = null;
      }
    };
  }, [logout]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void runAuthCheck({
      controller,
      logout,
      setIsLoading,
      setUser,
    });
    return () => {
      controller.abort();
    };
  }, [logout]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await loginRequest(email, password);
      if (!result.success) {
        return { success: false, error: result.error || "Login failed" };
      }

      if (result.user && result.token) {
        setUser(result.user);
        sessionStorage.setItem(sessionKey("user"), JSON.stringify(result.user));
        sessionStorage.setItem(sessionKey("token"), result.token);
        sessionStorage.setItem(sessionKey("password"), password);
        setAuthCookie(result.token);
        if (result.user.publicKey) {
          await cachePublicKey(result.user.publicKey);
        }
        if (result.user.secretKeyEncrypted) {
          try {
            await ensurePrivateKey(password, result.user.secretKeyEncrypted);
          } catch (keyError) {
            console.error("Failed to unlock private key:", keyError);
          }
        }
        const loginBc = new BroadcastChannel("kakioki:auth");
        loginBc.postMessage({
          type: "token_updated",
          tabSessionId: getTabSessionId(),
          token: result.token,
        } satisfies AuthBroadcastMessage);
        loginBc.close();
      }

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, username: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await registerRequest(email, username, password);
      if (!result.success) {
        return { success: false, error: result.error || "Registration failed" };
      }

      if (result.user && result.token) {
        sessionStorage.setItem(sessionKey("user"), JSON.stringify(result.user));
        sessionStorage.setItem(sessionKey("token"), result.token);
        sessionStorage.setItem(sessionKey("password"), password);
        setAuthCookie(result.token);
        setUser(result.user);
        if (result.user.publicKey) {
          await cachePublicKey(result.user.publicKey);
        }
        if (result.user.secretKeyEncrypted) {
          try {
            await ensurePrivateKey(password, result.user.secretKeyEncrypted);
          } catch (keyError) {
            console.error(
              "Failed to unlock private key after signup:",
              keyError,
            );
          }
        }
        const signupBc = new BroadcastChannel("kakioki:auth");
        signupBc.postMessage({
          type: "token_updated",
          tabSessionId: getTabSessionId(),
          token: result.token,
        } satisfies AuthBroadcastMessage);
        signupBc.close();
      }

      return { success: true, userId: result.user?.id };
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    let isActive = true;
    let channel: LifecycleChannel | null = null;
    let listener: ((message: { data: unknown }) => void) | null = null;
    let channelStateListener: ((change: ChannelStateChange) => void) | null =
      null;

    const subscribe = async (isRetry = false) => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        const lifecycleChannelName = userLifecycleChannel(user.id);
        channel = client.channels.get(
          lifecycleChannelName,
        ) as unknown as LifecycleChannel;

        channelStateListener = async (change: ChannelStateChange) => {
          if (change.reason?.code === 40160 && !isRetry && isActive) {
            if (channel && channelStateListener) {
              channel.off(channelStateListener);
            }
            channelStateListener = null;
            await reauthorizeRealtimeClient();
            if (isActive) void subscribe(true);
          }
        };
        channel.on(
          "failed",
          channelStateListener as (change: ChannelStateChange) => void,
        );

        listener = (message) => {
          const payload = message.data as AccountLifecycleEvent;
          if (payload?.type === "account_deleted") {
            console.log(
              `Account deletion trigger received for user ${user.id}`,
            );
            void logout();
          }
        };
        channel.subscribe(listener);
      } catch (error) {
        console.error("Account lifecycle subscription error:", error);
      }
    };

    void subscribe();

    return () => {
      isActive = false;
      if (channel && listener) {
        try {
          channel.unsubscribe(listener);
        } catch (unsubscribeError) {
          console.error(
            "Account lifecycle unsubscribe error:",
            unsubscribeError,
          );
        }
      }
      if (channel && channelStateListener) {
        try {
          channel.off(channelStateListener);
        } catch {}
      }
    };
  }, [user?.id, logout]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const LAST_SEEN_INTERVAL_MS = KAKIOKI_CONFIG.presence.lastSeenIntervalMs;
    let isActive = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastPersistedAt = 0;

    const persistLastSeen = () => {
      if (!isActive) {
        return;
      }
      if (Date.now() - lastPersistedAt < LAST_SEEN_INTERVAL_MS) {
        return;
      }
      const token = sessionStorage.getItem(sessionKey("token"));
      if (!token) {
        return;
      }
      lastPersistedAt = Date.now();
      void fetch("/api/auth/presence", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((error) => {
        if (hasLoggedOutRef.current) return;
        console.error("Failed to persist last_seen_at:", error);
      });
    };

    const subscribeDisconnect = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        const onStateChange = (stateChange: { current: string }) => {
          if (
            stateChange.current === "disconnected" ||
            stateChange.current === "closed"
          ) {
            persistLastSeen();
          }
        };
        client.connection.on(onStateChange);
        intervalId = setInterval(persistLastSeen, LAST_SEEN_INTERVAL_MS);
        return () => {
          client.connection.off(onStateChange);
        };
      } catch {
        return undefined;
      }
    };

    const cleanupRef: { current: (() => void) | undefined } = {
      current: undefined,
    };

    subscribeDisconnect().then((cleanup) => {
      if (isActive) {
        cleanupRef.current = cleanup;
      }
    });

    return () => {
      isActive = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const IDLE_TIMEOUT_MS = KAKIOKI_CONFIG.presence.idleTimeoutMs;
    const DEBOUNCE_MS = KAKIOKI_CONFIG.presence.debounceMs;
    const MIN_STATE_DURATION_MS = KAKIOKI_CONFIG.presence.minStateDurationMs;

    let isActive = true;
    let channel: ReturnType<
      Awaited<ReturnType<typeof getRealtimeClient>>["channels"]["get"]
    > | null = null;
    let hasEntered = false;
    let isAutoIdled = false;
    let lastTransitionAt = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const lastSentStatusRef = { current: null as PresenceStatus | null };

    const sendPresenceStatus = async (status: PresenceStatus) => {
      if (!isActive || !channel) {
        return;
      }

      if (lastSentStatusRef.current === status) {
        return;
      }

      const payload = buildPresencePayload(status);

      try {
        if (!hasEntered) {
          await channel.presence.enter(payload);
          hasEntered = true;
          lastSentStatusRef.current = status;
          lastTransitionAt = Date.now();
          return;
        }

        await channel.presence.update(payload);
        lastSentStatusRef.current = status;
        lastTransitionAt = Date.now();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "");

        if (/not entered|not present/i.test(message)) {
          await channel.presence.enter(payload);
          hasEntered = true;
          lastSentStatusRef.current = status;
          lastTransitionAt = Date.now();
          return;
        }

        if (!/connection closed|connection failed/i.test(message)) {
          console.error("User presence update error:", error);
        }
      }
    };

    const updatePresenceStatus = (effectiveStatus?: PresenceStatus) => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      const status = effectiveStatus ?? getStoredCurrentUserPresenceStatus();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void sendPresenceStatus(status);
      }, DEBOUNCE_MS);
    };

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleIdleCheck = () => {
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        if (!isActive) {
          return;
        }
        if (Date.now() - lastTransitionAt < MIN_STATE_DURATION_MS) {
          scheduleIdleCheck();
          return;
        }
        const manualStatus = getStoredCurrentUserPresenceStatus();
        if (manualStatus === "online") {
          isAutoIdled = true;
          updatePresenceStatus("away");
        }
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      if (!isActive) {
        return;
      }
      if (
        isAutoIdled &&
        Date.now() - lastTransitionAt >= MIN_STATE_DURATION_MS
      ) {
        isAutoIdled = false;
        updatePresenceStatus();
      }
      scheduleIdleCheck();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onActivity();
      }
    };

    const handleStoredStatusChange = () => {
      if (!isActive) {
        return;
      }
      isAutoIdled = false;
      updatePresenceStatus();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== getCurrentUserPresenceStatusStorageKey()) {
        return;
      }
      handleStoredStatusChange();
    };

    const maintainPresence = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(APP_PRESENCE_CHANNEL);
        await channel.attach();
        if (!isActive) {
          return;
        }
        presenceCleanupRef.current = async () => {
          if (!hasEntered || isRealtimeClientClosing()) return;
          try {
            await channel?.presence.leave();
            hasEntered = false;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err ?? "");
            if (
              !/connection closed|connection failed|client is closing/i.test(
                msg,
              )
            ) {
              console.error("Presence leave error:", err);
            }
          }
        };
        void sendPresenceStatus(getStoredCurrentUserPresenceStatus());
        if (isActive) {
          scheduleIdleCheck();
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error ?? "");
        if (
          !/connection closed|connection failed|client is closing/i.test(msg)
        ) {
          console.error("User presence enter error:", error);
        }
      }
    };

    window.addEventListener(
      CURRENT_USER_PRESENCE_STATUS_EVENT,
      handleStoredStatusChange,
    );
    window.addEventListener("storage", handleStorage);
    document.addEventListener("mousemove", onActivity, { passive: true });
    document.addEventListener("keydown", onActivity, { passive: true });
    document.addEventListener("click", onActivity, { passive: true });
    document.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    void maintainPresence();

    return () => {
      isActive = false;
      presenceCleanupRef.current = null;
      clearIdleTimer();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      window.removeEventListener(
        CURRENT_USER_PRESENCE_STATUS_EVENT,
        handleStoredStatusChange,
      );
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("mousemove", onActivity);
      document.removeEventListener("keydown", onActivity);
      document.removeEventListener("click", onActivity);
      document.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (channel && hasEntered && !isRealtimeClientClosing()) {
        void (async () => {
          try {
            await channel?.presence.leave();
          } catch (leaveError) {
            const msg =
              leaveError instanceof Error
                ? leaveError.message
                : String(leaveError ?? "");
            if (
              !/connection closed|connection failed|client is closing/i.test(
                msg,
              )
            ) {
              console.error("User presence leave error:", leaveError);
            }
          }
        })();
      }
    };
  }, [user?.id]);

  const refreshCurrentUser = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const token = sessionStorage.getItem(sessionKey("token"));
    if (!token) {
      return;
    }

    try {
      const result = await refreshUser(user.id, token);
      if (result.success && result.user && isMountedRef.current) {
        setUser(result.user);
        sessionStorage.setItem(sessionKey("user"), JSON.stringify(result.user));
        if (result.user.publicKey) {
          await cachePublicKey(result.user.publicKey);
        }
      }
    } catch (error) {
      console.error("Failed to refresh current user:", error);
    }
  }, [user?.id]);

  const updateAvatar = async (file: File) => {
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const result = await uploadAvatar(file, user.id);
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Avatar update failed",
        };
      }

      if (isMountedRef.current) {
        const updatedUser = { ...user, avatarUrl: result.avatarUrl };
        setUser(updatedUser);
        sessionStorage.setItem(sessionKey("user"), JSON.stringify(updatedUser));
      }

      return { success: true };
    } catch (error) {
      console.error("Avatar update error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        updateAvatar,
        refreshCurrentUser,
        clearSession,
        logout,
      },
    },
    children,
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
