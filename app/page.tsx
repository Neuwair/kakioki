"use client";

import React from "react";
import { SignInForm } from "@/public/shared/Utils/Interface/SignInForm";
import { SignUpForm } from "@/public/shared/Utils/Interface/SignUpForm";
import { AvatarForm } from "@/public/shared/Utils/Interface/avatarForm";
import { UseHomePageLogic } from "@/public/shared/Helpers/HomePageHelpers";

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
          <div className="max-w-md w-full bg-black/20 backdrop-blur-lg border border-white/20 rounded-4xl shadow-xl p-8 cursor-default">
            <div className="text-center">
              <h1
                className="font-bold text-amber-50 mb-2"
                style={{ fontSize: "clamp(3vh, 1vw, 10rem)" }}
              >
                Kakioki
              </h1>
              <p
                className=" text-amber-50 mb-8"
                style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
              >
                Simple, light, fast, and secure.
              </p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setCurrentView("signin")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-amber-50 py-3 px-4 rounded-lg transition-colors duration-233 border-none cursor-pointer text-responsive signin-btn"
                  style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setCurrentView("signup")}
                  className="w-full bg-gray-300 hover:bg-gray-200 text-gray-800 hover:text-gray-900 py-3 px-4 rounded-lg transition-colors duration-233 border-none cursor-pointer text-responsive signup-btn"
                  style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
                >
                  Create Account
                </button>
              </div>
              <div className="text-amber-50/70 text-center cursor-default mt-8">
                <div className="flex flex-row align-middle justify-center">
                  <div>Created by Neuwair | Illustrator and Programmer</div>
                </div>

                <div className=" flex flex-row flex-wrap items-center justify-center gap-4">
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
    <div className="min-h-screen flex items-center justify-center p-5 backdrop-blur-lg">
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 p-3 bg-red-500/80 backdrop-blur-sm text-amber-50 rounded-lg max-w-md w-full z-50">
          {error}
        </div>
      )}
      {renderContent()}
      {currentView !== "home" && currentView !== "avatar" && (
        <button
          onClick={() => setCurrentView("home")}
          className="absolute top-4 left-4 text-amber-50 hover:text-blue-200 transition-colors duration-200 bg-transparent border-none cursor-pointer z-40"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          ← Back to Home
        </button>
      )}
    </div>
  );
}
