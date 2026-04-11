"use client";

import type { SyntheticEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/ClientAuth";
import { sessionKey } from "@/public/shared/helpers/TabSessionHelpers";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(sessionKey("token"));
}

export function getAuthHeaders(): { [key: string]: string } {
  const token = getAuthToken();
  const headers: { [key: string]: string } = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

type ViewMode = "home" | "signin" | "signup" | "avatar";

export function UseHomePageLogic() {
  const [currentView, setCurrentView] = useState<ViewMode>("home");
  const [error, setError] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState<number | null>(null);
  const { isAuthenticated, login, signup, clearSession, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && currentView !== "avatar") {
      router.push("/chat");
    }
  }, [isAuthenticated, currentView, router]);

  const handleSignIn = async (email: string, password: string) => {
    setError(null);

    try {
      const result = await login(email, password);

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setError("An unexpected error occurred during sign in.");
    }
  };

  const handleSignUp = async (
    email: string,
    username: string,
    password: string,
  ) => {
    setError(null);

    try {
      const result = await signup(email, username, password);

      if (result.success) {
        setNewUserId(result.userId || null);
        setCurrentView("avatar");
      } else if (result.error) {
        setError(result.error);
      }
    } catch (error) {
      console.error("Sign up error:", error);
      setError("An unexpected error occurred during sign up.");
    }
  };

  const handleAvatarComplete = useCallback(() => {
    clearSession();
    setCurrentView("signin");
  }, [clearSession]);

  return {
    currentView,
    setCurrentView,
    error,
    setError,
    isLoading,
    handleSignIn,
    handleSignUp,
    handleAvatarComplete,
    newUserId,
  } as const;
}

export const UseSignInForm = (
  onSubmit: (email: string, password: string) => void,
) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (email && password) onSubmit(email, password);
    },
    [email, password, onSubmit],
  );

  return {
    email,
    setEmail,
    password,
    setPassword,
    handleSubmit,
  };
};

export const UseSignUpForm = (
  onSubmit: (email: string, username: string, password: string) => void,
) => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (email && username && password && password === confirmPassword) {
        onSubmit(email, username, password);
      }
    },
    [email, username, password, confirmPassword, onSubmit],
  );

  const isFormValid = !!(
    email &&
    username &&
    password &&
    password === confirmPassword
  );

  return {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    handleSubmit,
    isFormValid,
  };
};
