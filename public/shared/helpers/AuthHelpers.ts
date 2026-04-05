"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/ClientAuth";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("kakiokiToken");
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
  const { isAuthenticated, login, signup, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

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

  return {
    currentView,
    setCurrentView,
    error,
    setError,
    isLoading,
    handleSignIn,
    handleSignUp,
    newUserId,
  } as const;
}

export const UseSignInForm = (
  onSubmit: (email: string, password: string) => void,
) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
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
    (e: React.FormEvent) => {
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
