import { NextResponse } from "next/server";
import { UserRepository } from "@/lib";
import { scheduleAccountDeletion } from "@/lib/Service/AccountDeletionScheduler";
import { generateUserId } from "@/lib/Connections/DatabaseConnections";
import {
  ensureJwtSecretForProduction,
  generateToken,
} from "@/lib/Security/TokenLogic";
import { hashPassword } from "@/lib/Security/ArgonConfig";
import { KAKIOKI_CONFIG } from "@/lib/config";
import {
  generateKeyPair,
  encryptPrivateKey,
} from "@/lib/Security/KeyEncryption";
import { getSodium } from "@/lib/Security/Sodium";

export async function POST(request: Request) {
  try {
    const { email, username, password } = await request.json();

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (email.length > 255) {
      return NextResponse.json({ error: "Email is too long" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (username.length > KAKIOKI_CONFIG.account.maxUsernameLength) {
      return NextResponse.json(
        {
          error: `Username must be at most ${KAKIOKI_CONFIG.account.maxUsernameLength} characters`,
        },
        { status: 400 }
      );
    }

    try {
      ensureJwtSecretForProduction();
    } catch (configError) {
      console.error("Registration configuration error:", configError);
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    const userRepository = new UserRepository();

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    let userId = generateUserId();
    if (userId.length !== KAKIOKI_CONFIG.account.userIdLength) {
      let attempts = 0;
      let newId = userId;
      while (
        newId.length !== KAKIOKI_CONFIG.account.userIdLength &&
        attempts < 5
      ) {
        newId = generateUserId();
        attempts += 1;
      }
      if (newId.length !== KAKIOKI_CONFIG.account.userIdLength) {
        return NextResponse.json(
          { error: "Failed to generate valid user ID" },
          { status: 500 }
        );
      }
      userId = newId;
    }
    const passwordHash = await hashPassword(password);
    const sodium = await getSodium();
    const { publicKey, privateKey } = await generateKeyPair();
    const publicKeyBase64 = sodium.to_base64(
      publicKey,
      sodium.base64_variants.URLSAFE_NO_PADDING
    );
    const secretKeyEncrypted = await encryptPrivateKey(privateKey, password);

    const newUser = await userRepository.create({
      user_id: userId,
      email,
      username,
      password_hash: passwordHash,
      public_key: publicKeyBase64,
      secret_key_encrypted: secretKeyEncrypted,
    });

    await scheduleAccountDeletion(newUser);

    let token: string;
    try {
      token = generateToken({
        id: newUser.id,
        userId: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
      });
    } catch (tokenError) {
      console.error("Registration token generation error:", tokenError);
      try {
        await userRepository.deleteById(newUser.id);
      } catch (cleanupError) {
        console.error(
          "Failed to rollback user after token error:",
          cleanupError
        );
      }
      return NextResponse.json(
        {
          error:
            "Registration temporarily unavailable. Please try again later.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully",
        user: {
          id: newUser.id,
          userId: newUser.user_id,
          email: newUser.email,
          username: newUser.username,
          avatarUrl: newUser.avatar_url,
          publicKey: publicKeyBase64,
          secretKeyEncrypted,
        },
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
