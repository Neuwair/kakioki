"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { User } from "@/lib/types/TypesLogic";
import {
  refreshUser,
  loginRequest,
  registerRequest,
  uploadAvatar,
} from "@/lib/Auth/AuthClient";
import {
  ensurePrivateKey,
  clearStoredPrivateKey,
  PASSWORD_STORAGE_KEY,
  cachePublicKey,
} from "@/public/shared/Helpers/KeyHelpers";
import { getRealtimeClient } from "@/public/shared/Realtime/ablyClient";
import { userPresenceChannel } from "@/lib/Realtime/UserPresence";
import {
  userLifecycleChannel,
  type AccountLifecycleEvent,
} from "@/lib/Realtime/UserLifecycleEvents";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (
    email: string,
    username: string,
    password: string
  ) => Promise<{ success: boolean; userId?: number; error?: string }>;
  updateAvatar: (file: File) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_COOKIE_NAME = "kakiokiToken";

type LifecycleChannel = {
  subscribe: (listener: (message: { data: unknown }) => void) => void;
  unsubscribe: (listener: (message: { data: unknown }) => void) => void;
};

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUser = sessionStorage.getItem("kakiokiUser");
        const storedToken = sessionStorage.getItem("kakiokiToken");
        const storedPassword = sessionStorage.getItem(PASSWORD_STORAGE_KEY);

        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          if (parsedUser?.publicKey) {
            await cachePublicKey(parsedUser.publicKey);
          }

          if (parsedUser?.id) {
            try {
              const result = await refreshUser(parsedUser.id, storedToken);
              if (result.success && result.user) {
                setUser(result.user);
                sessionStorage.setItem(
                  "kakiokiUser",
                  JSON.stringify(result.user)
                );
                if (result.user.publicKey) {
                  await cachePublicKey(result.user.publicKey);
                }
                if (storedPassword && result.user.secretKeyEncrypted) {
                  try {
                    await ensurePrivateKey(
                      storedPassword,
                      result.user.secretKeyEncrypted
                    );
                  } catch (refreshKeyError) {
                    console.error(
                      "Failed to unlock private key after refresh:",
                      refreshKeyError
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
              await ensurePrivateKey(
                storedPassword,
                parsedUser.secretKeyEncrypted
              );
            } catch (unlockError) {
              console.error(
                "Failed to unlock private key from session:",
                unlockError
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
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          userLifecycleChannel(user.id)
        ) as LifecycleChannel;
        listener = (message) => {
          const payload = message.data as AccountLifecycleEvent;
          if (payload?.type === "account_deleted") {
            console.log(
              `Account deletion trigger received for user ${user.id}`
            );
            void logout();
          }
        };
        channel.subscribe(listener);
      } catch (error) {
        console.error("Account lifecycle subscription error:", error);
      }
    };

    subscribe();

    return () => {
      isActive = false;
      if (channel && listener) {
        try {
          channel.unsubscribe(listener);
        } catch (unsubscribeError) {
          console.error(
            "Account lifecycle unsubscribe error:",
            unsubscribeError
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

    const maintainPresence = async () => {
      try {
        const client = await getRealtimeClient();
        if (!isActive) {
          return;
        }
        channel = client.channels.get(userPresenceChannel(user.id));
        await channel.attach();
        if (!isActive) {
          return;
        }
        await channel.presence.enter({ userId: user.userId });
        hasEntered = true;
      } catch (error) {
        console.error("User presence enter error:", error);
      }
    };

    maintainPresence();

    return () => {
      isActive = false;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        updateAvatar,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
