"use client";

import React from "react";
import { UseSignInForm } from "@/public/shared/Helpers/AuthHelpers";

interface SignInFormProps {
  onSubmit: (email: string, password: string) => void;
  onSwitchToSignUp: () => void;
  onSwitchToSignIn?: () => void;
  isLoading?: boolean;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onSubmit,
  onSwitchToSignUp,
  isLoading = false,
}) => {
  const { email, setEmail, password, setPassword, handleSubmit } =
    UseSignInForm(onSubmit);

  return (
    <div className="max-w-md w-full  bg-black/20 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg p-8 cursor-default">
      <div className="text-center mb-6">
        <h2
          className=" font-bold text-amber-50 mb-2 cursor-default"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          Sign In
        </h2>
        <p
          className=" text-amber-50"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          Welcome back to Kakioki
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-responsive text-amber-50 mb-2"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            maxLength={255}
            className="w-full px-3 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-responsive  text-amber-50 mb-2"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full bg-blue-600 hover:bg-blue-500 text-amber-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive signin-btn"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p
          className="text-amber-50"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          Don&apos;t have an account?{" "}
          <button
            onClick={onSwitchToSignUp}
            className="text-blue-200 hover:text-blue-100 underline bg-transparent border-none cursor-default text-responsive"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
          >
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
};
