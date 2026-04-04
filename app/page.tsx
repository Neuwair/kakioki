"use client";

import React, { useState } from "react";
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
    newUserId,
  } = UseHomePageLogic();

  const [showAlert, setShowAlert] = useState(true);

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
            onSkip={() => setCurrentView("signin")}
            onUploadSuccess={() => setCurrentView("signin")}
          />
        );
      default:
        return (
          <div className="max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-4xl shadow-xl p-8 cursor-default">
            <div className="text-center">
              <h1
                className="font-bold text-neutral-50 mb-2 text-4xl"
              >
                Kakioki
              </h1>
              <p
                className=" text-neutral-50 mb-8 text-2xl"
              >
                Simple, light, fast, and secure.
              </p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setCurrentView("signin")}
                  className="w-full bg-lime-700 hover:bg-lime-800 text-neutral-50 py-3 px-4 rounded-lg transition-colors duration-233 border-none cursor-pointer text-responsive signin-btn text-2xl"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setCurrentView("signup")}
                  className="w-full bg-gray-300 hover:bg-gray-200 text-gray-800 hover:text-gray-900 py-3 px-4 rounded-lg transition-colors duration-233 border-none cursor-pointer text-responsive signup-btn text-2xl"
                >
                  Create Account
                </button>
              </div>
              <div className="text-neutral-50/70 text-center cursor-default mt-8">
                <div className="flex flex-row align-middle justify-center">
                  <div className="text-lg">Created by Neuwair | Illustrator and Programmer</div>
                </div>

                <div className="text-lg flex flex-row flex-wrap items-center justify-center gap-4">
                  <a
                    href="https://x.com/neuwair"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:underline bouncy-hover"
                  >
                    Twitter
                  </a>
                  <a
                    href="https://www.pixiv.net/en/users/102019144"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:underline bouncy-hover"
                  >
                    Pixiv
                  </a>
                  <a
                    href="https://www.youtube.com/@Neuwair"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:underline bouncy-hover"
                  >
                    YouTube
                  </a>
                  <a
                    href="https://github.com/Neuwair"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:underline bouncy-hover"
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
    <div className="min-h-screen flex items-center justify-center p-5 w-full h-screen chat-container backdrop-blur-lg overflow-hidden flex-col chat-background">
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 p-3 bg-red-500/80 backdrop-blur-sm text-neutral-50 rounded-lg max-w-md w-full z-50">
          {error}
        </div>
      )}
      {showAlert && <AlertDialog onClose={() => setShowAlert(false)} />}
      {renderContent()}
      {currentView !== "home" && currentView !== "avatar" && (
        <button
          onClick={() => setCurrentView("home")}
          className="absolute top-4 left-4 text-neutral-50 hover:text-blue-200 transition-colors duration-200 bg-transparent border-none cursor-pointer z-40"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          ← Back to Home
        </button>
      )}
    </div>
  );
}
