"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/ClientAuth";
const ChatInterface = dynamic(
  () =>
    import("@/public/shared/utils/home/ChatInterface").then(
      (mod) => mod.ChatInterface,
    ),
  { ssr: false },
);

export default function ChatPage() {
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

  return (
    <div className="h-screen overflow-hidden">
      {isAuthenticated && (
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <span className="w-10 h-10 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <ChatInterface />
        </Suspense>
      )}
    </div>
  );
}
