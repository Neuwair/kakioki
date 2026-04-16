"use client";

import React, { useEffect, useRef, useState } from "react";
import { SignInForm } from "@/public/shared/utils/home/FormSignIn";
import { SignUpForm } from "@/public/shared/utils/home/FormSignUp";
import { AvatarForm } from "@/public/shared/utils/home/FormAvatar";
import { UseHomePageLogic } from "@/public/shared/helpers/AuthHelpers";
import { AlertDialog } from "@/public/shared/utils/home/AlertDialog";

export default function HomePage() {
  const {
    currentView,
    setCurrentView,
    error,
    isLoading,
    handleSignIn,
    handleSignUp,
    handleAvatarComplete,
    newUserId,
  } = UseHomePageLogic();

  const [showAlert, setShowAlert] = useState(true);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.focus();
  }, [currentView]);

  const renderContent = () => {
    switch (currentView) {
      case "signin":
        return (
          <SignInForm
            onSubmit={handleSignIn}
            onSwitchToSignUp={() => setCurrentView("signup")}
            isLoading={isLoading}
          />
        );
      case "signup":
        return (
          <SignUpForm
            onSubmit={handleSignUp}
            onSwitchToSignIn={() => setCurrentView("signin")}
            isLoading={isLoading}
          />
        );
      case "avatar":
        return (
          <AvatarForm
            userId={newUserId}
            onSkip={handleAvatarComplete}
            onUploadSuccess={handleAvatarComplete}
          />
        );
      default:
        return (
          <div className="max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl p-8 cursor-default">
            <div className="flex flex-col  text-center gap-4">
              <div className="flex flex-col gap-2">
                <h1
                  id="home-title"
                  className="font-bold text-neutral-50 text-sm sm:text-2xl lg:text-4xl"
                >
                  Kakioki
                </h1>
                <p className=" text-neutral-50 text-xs sm:text-sm lg:text-2xl">
                  Simple, light, fast, and secure.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setCurrentView("signin")}
                  className="w-full bg-lime-700 hover:bg-lime-800 text-neutral-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer signin-btn text-xs sm:text-sm disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setCurrentView("signup")}
                  className="w-full bg-gray-300 hover:bg-gray-200 text-gray-800 hover:text-gray-900 py-3 px-4 rounded-lg transition-colors duration-233 border-none cursor-pointer signup-btn text-xs sm:text-sm accessibility-setting"
                >
                  Create Account
                </button>
              </div>
              <div className="flex flex-col gap-2 text-neutral-50/70 text-center cursor-default">
                <div className="flex flex-row align-middle justify-center">
                  <div className="text-sm sm:text-lg">
                    Created by Neuwair | Illustrator and Programmer
                  </div>
                </div>
                <div className="text-lg flex flex-row flex-wrap items-center justify-center gap-4">
                  <a
                    href="https://x.com/neuwair"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Twitter, opens in a new tab"
                    className="text-lime-300 hover:underline bouncy-hover text-sm sm:text-lg"
                  >
                    Twitter
                  </a>
                  <a
                    href="https://www.pixiv.net/en/users/102019144"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Pixiv, opens in a new tab"
                    className="text-lime-300 hover:underline bouncy-hover text-sm sm:text-lg"
                  >
                    Pixiv
                  </a>
                  <a
                    href="https://www.youtube.com/@Neuwair"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="YouTube, opens in a new tab"
                    className="text-lime-300 hover:underline bouncy-hover text-sm sm:text-lg"
                  >
                    YouTube
                  </a>
                  <a
                    href="https://github.com/Neuwair"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub, opens in a new tab"
                    className="text-lime-300 hover:underline bouncy-hover text-sm sm:text-lg"
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      className="flex flex-col items-center justify-center p-4 gap-2 overflow-y-auto scrollbar-hide chat-background chat-container focus:outline-none"
    >
      {showAlert && <AlertDialog onClose={() => setShowAlert(false)} />}
      {renderContent()}
      {error && (currentView === "signin" || currentView === "signup") && (
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-md w-full bg-red-500/10 text-red-50 backdrop-blur-lg border border-red-400 rounded-lg p-4 text-center text-sm sm:text-lg"
        >
          {error}
        </div>
      )}
      {currentView !== "home" && currentView !== "avatar" && (
        <button
          onClick={() => setCurrentView("home")}
          className="flex-col rounded-lg max-w-md w-full shadow-xl p-4 backdrop-blur-lg border bg-white/5 border-white/20 text-neutral-50 text-xs sm:text-sm interface-btn accessibility-setting"
        >
          Home
        </button>
      )}
    </main>
  );
}
