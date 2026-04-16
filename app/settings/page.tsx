"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/ClientAuth";
import UserSettings from "@/public/shared/utils/interface/UserSettings";

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-10 h-10 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen p-5 w-full chat-container backdrop-blur-lg overflow-y-auto chat-background">
      <div className="mx-auto w-full">
        <UserSettings onBack={() => router.push("/chat")} />
      </div>
    </div>
  );
}
