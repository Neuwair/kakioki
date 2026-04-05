"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  userLifecycleChannel,
  type AccountLifecycleEvent,
} from "@/lib/events/RealtimeEvents";
import type { User } from "@/lib/media/MediaTypes";
import {
  cachePublicKey,
  clearStoredPrivateKey,
  ensurePrivateKey,
  PASSWORD_STORAGE_KEY,
} from "@/public/shared/helpers/LibsodiumHelpers";
import {
  buildPresencePayload,
  CURRENT_USER_PRESENCE_STATUS_EVENT,
  CURRENT_USER_PRESENCE_STATUS_STORAGE_KEY,
  getStoredCurrentUserPresenceStatus,
} from "@/public/shared/logic/UserPresenceRealtime";
import { getRealtimeClient } from "@/public/shared/services/AblyRealtime";

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
  logout: () => void;
}

type LifecycleChannel = {
  subscribe: (listener: (message: { data: unknown }) => void) => void;
  unsubscribe: (listener: (message: { data: unknown }) => void) => void;
};

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
  const maxAge = 60 * 60 * 24 * 7;
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
    const storedUser = sessionStorage.getItem("kakiokiUser");
    const storedToken = sessionStorage.getItem("kakiokiToken");
    const storedPassword = sessionStorage.getItem(PASSWORD_STORAGE_KEY);

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
            sessionStorage.setItem("kakiokiUser", JSON.stringify(result.user));
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
  const router = useRouter();

  const logout = useCallback(async () => {
    setUser(null);
    sessionStorage.removeItem("kakiokiUser");
    sessionStorage.removeItem("kakiokiToken");
    sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
    clearStoredPrivateKey();
    clearAuthCookie();
    router.push("/");
  }, [router]);

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
        sessionStorage.setItem("kakiokiUser", JSON.stringify(result.user));
        sessionStorage.setItem("kakiokiToken", result.token);
        sessionStorage.setItem(PASSWORD_STORAGE_KEY, password);
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

    const subscribe = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(
          userLifecycleChannel(user.id),
        ) as LifecycleChannel;
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
    };
  }, [user?.id, logout]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isActive = true;
    let channel: ReturnType<
      Awaited<ReturnType<typeof getRealtimeClient>>["channels"]["get"]
    > | null = null;
    let hasEntered = false;

    const updatePresenceStatus = async () => {
      if (!channel) {
        return;
      }

      const payload = buildPresencePayload(
        user.userId,
        getStoredCurrentUserPresenceStatus(),
      );

      try {
        if (!hasEntered) {
          await channel.presence.enter(payload);
          hasEntered = true;
          return;
        }

        await channel.presence.update(payload);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "");

        if (/not entered|not present/i.test(message)) {
          await channel.presence.enter(payload);
          hasEntered = true;
          return;
        }

        if (!/connection closed|connection failed/i.test(message)) {
          console.error("User presence update error:", error);
        }
      }
    };

    const maintainPresence = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(`user:${user.id}:presence`);
        await channel.attach();
        if (!isActive) {
          return;
        }
        await updatePresenceStatus();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error ?? "");
        if (!/connection closed|connection failed/i.test(msg)) {
          console.error("User presence enter error:", error);
        }
      }
    };

    const handleStoredStatusChange = () => {
      if (!isActive) {
        return;
      }

      void updatePresenceStatus();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== CURRENT_USER_PRESENCE_STATUS_STORAGE_KEY) {
        return;
      }

      handleStoredStatusChange();
    };

    window.addEventListener(
      CURRENT_USER_PRESENCE_STATUS_EVENT,
      handleStoredStatusChange,
    );
    window.addEventListener("storage", handleStorage);

    void maintainPresence();

    return () => {
      isActive = false;
      window.removeEventListener(
        CURRENT_USER_PRESENCE_STATUS_EVENT,
        handleStoredStatusChange,
      );
      window.removeEventListener("storage", handleStorage);
      if (channel) {
        const cleanupPresence = async () => {
          if (hasEntered) {
            try {
              await channel?.presence.leave();
            } catch (leaveError) {
              console.error("User presence leave error:", leaveError);
            }
          }
          try {
            await channel?.detach();
          } catch (detachError) {
            console.error("User presence detach error:", detachError);
          }
        };
        void cleanupPresence();
      }
    };
  }, [user?.id, user?.userId]);

  const refreshCurrentUser = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const token = sessionStorage.getItem("kakiokiToken");
    if (!token) {
      return;
    }

    try {
      const result = await refreshUser(user.id, token);
      if (result.success && result.user) {
        setUser(result.user);
        sessionStorage.setItem("kakiokiUser", JSON.stringify(result.user));
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

      const updatedUser = { ...user, avatarUrl: result.avatarUrl };
      setUser(updatedUser);
      sessionStorage.setItem("kakiokiUser", JSON.stringify(updatedUser));
      console.log("User avatar updated successfully");

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
