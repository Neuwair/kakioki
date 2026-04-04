"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UseSignInForm } from "@/public/shared/helpers/AuthHelpers";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

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

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-4 max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-4xl shadow-lg p-8">
      
      <div className="flex flex-col gap-4">

        <div className="flex flex-col text-center gap-2 justify-center">
          <h2 className=" font-bold text-neutral-50 cursor-default text-4xl">
            Sign In
          </h2>
          <p className=" text-neutral-50 text-2xl">Welcome back to Kakioki</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="block text-responsive text-neutral-50 mb-2 text-2xl"
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
              className="w-full px-3 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300 text-2xl"
              placeholder="Enter your email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="block text-responsive text-neutral-50 mb-2 text-2xl"
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                maxLength={255}
                className="w-full px-2 pr-10 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300 text-2xl"
                placeholder="Create a password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-lg text-neutral-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-lime-700 hover:bg-lime-800 text-neutral-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive signin-btn text-2xl disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing In...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
          <div className="flex gap-4 justify-start flex-wrap">
            <p className="text-neutral-50 text-2xl">
              {" "}
              Don&apos;t have an account?{" "}
            </p>
            <button
              onClick={onSwitchToSignUp}
              className="text-lime-200 hover:text-lime-100 underline bg-transparent border-none cursor-default text-responsive text-lg"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
