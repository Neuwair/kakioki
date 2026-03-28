"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { KAKIOKI_CONFIG } from "@/lib/config";
import { UseSignUpForm } from "@/public/shared/Helpers/AuthHelpers";

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
    <div className="max-w-md w-full  bg-black/20 backdrop-blur-lg border border-white/20 rounded-4xl shadow-lg p-8">
      <div className="text-center mb-6">
        <h2
          className=" font-bold text-amber-50 mb-2 cursor-default"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          Create Account
        </h2>
        <p
          className=" text-amber-50 cursor-default"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          Your world, your messages
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
            htmlFor="username"
            className="block text-responsive text-amber-50 mb-2"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
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
            className="w-full px-3 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            placeholder="Choose a username"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-responsive text-amber-50 mb-2"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
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
              className="w-full px-3 pr-10 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
              placeholder="Create a password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center px-2 text-amber-50"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-responsive text-amber-50 mb-2"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
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
              className="w-full px-3 pr-10 py-2 border border-gray-300 bg-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
              placeholder="Confirm your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center px-2 text-amber-50"
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
            <p
              className="text-red-200 mt-1"
              style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
            >
              Passwords do not match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full bg-blue-600 hover:bg-blue-500 text-amber-50 py-3 px-4 rounded-lg transition-colors duration-200 border-none cursor-pointer text-responsive signup-btn"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          {isLoading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <div className="mt-6 text-center cursor-default">
        <p
          className="text-amber-50"
          style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
        >
          Already have an account?{" "}
          <button
            onClick={onSwitchToSignIn}
            className="text-blue-200 hover:text-blue-100 underline bg-transparent border-none cursor-pointer text-responsive"
            style={{ fontSize: "clamp(2vh, 1vw, 10rem)" }}
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};
