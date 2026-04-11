"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { UseSignUpForm } from "@/public/shared/helpers/AuthHelpers";

interface SignUpFormProps {
  onSubmit: (email: string, username: string, password: string) => void;
  onSwitchToSignIn: () => void;
  isLoading?: boolean;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSubmit,
  onSwitchToSignIn,
  isLoading = false,
}) => {
  const {
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
  } = UseSignUpForm(onSubmit);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="flex flex-col gap-4 max-w-md w-full bg-white/5 backdrop-blur-lg border border-white/20 rounded-4xl shadow-lg p-8">
      <div className="flex flex-col text-center gap-2 justify-center">
        <h2 className="font-bold text-neutral-50 cursor-default text-4xl b">
          Create Account
        </h2>
        <p className=" text-neutral-50 cursor-default text-2xl">
          Your world, your messages
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="block text-responsive text-neutral-50 text-2xl"
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
            htmlFor="username"
            className="block text-responsive text-neutral-50 text-2xl"
          >
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            maxLength={KAKIOKI_CONFIG.account.maxUsernameLength}
            className="w-full px-3 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300 text-2xl"
            placeholder="Choose a username"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="block text-responsive text-neutral-50 text-2xl"
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
              className="w-full px-3 pr-10 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300 text-2xl"
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

        <div className="flex flex-col gap-2">
          <label
            htmlFor="confirmPassword"
            className="block text-responsive text-neutral-50 text-2xl"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 pr-10 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring focus:ring-lime-500 text-gray-300 text-2xl"
              placeholder="Confirm your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center px-1 text-lg text-neutral-50 "
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              <FontAwesomeIcon
                icon={showConfirmPassword ? faEyeSlash : faEye}
              />
            </button>
          </div>
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-red-200 mt-1 text-2xl">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full bg-lime-700 hover:bg-lime-800 text-neutral-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive signup-btn text-2xl disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating Account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>
        <div className="flex gap-4 justify-start flex-wrap">
          <p className="text-neutral-50 text-2xl">Already have an account? </p>
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-lime-200 hover:text-lime-100 underline bg-transparent border-none cursor-pointer text-responsive text-lg"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );
};
