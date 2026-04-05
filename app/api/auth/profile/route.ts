import { NextResponse } from "next/server";
import { FriendRepository, UserRepository } from "@/lib";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import { hashPassword, verifyPassword } from "@/lib/security/ArgonConfig";
import {
  decryptPrivateKey,
  encryptPrivateKey,
} from "@/lib/security/LibsodiumEncryption";
import { publishFriendProfileUpdated } from "@/lib/server/AblyServer";

export async function PUT(request: Request) {
  try {
    const { userId, username, biography, currentPassword, newPassword, email } =
      await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "No user ID provided" },
        { status: 400 },
      );
    }

    const userRepository = new UserRepository();
    const friendRepository = new FriendRepository();
    const userIdNumber = parseInt(userId, 10);

    if (isNaN(userIdNumber)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await userRepository.findById(userIdNumber);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profileUpdateData: {
      username?: string;
      bio?: string;
      email?: string;
    } = {};
    let nextPasswordHash: string | null = null;
    let nextSecretKeyEncrypted: string | undefined;

    if (typeof email === "string") {
      const normalizedEmail = email.trim().toLowerCase();
      const isValidEmail = /^[^\s@]+@[^\s@]+$/.test(normalizedEmail);

      if (normalizedEmail === user.email.toLowerCase()) {
        return NextResponse.json(
          { error: "This @email address is the same as the current one." },
          { status: 400 },
        );
      }

      if (!isValidEmail || normalizedEmail.length > 255) {
        return NextResponse.json(
          { error: "This @email address is invalid." },
          { status: 400 },
        );
      }

      const existingUser = await userRepository.findByEmail(normalizedEmail);
      if (existingUser && existingUser.id !== userIdNumber) {
        return NextResponse.json(
          { error: "This @email address is invalid." },
          { status: 400 },
        );
      }

      profileUpdateData.email = normalizedEmail;
    }

    if (username) {
      if (username.length > KAKIOKI_CONFIG.account.maxUsernameLength) {
        return NextResponse.json(
          {
            error: `Username must be at most ${KAKIOKI_CONFIG.account.maxUsernameLength} characters`,
          },
          { status: 400 },
        );
      }
      profileUpdateData.username = username;
    }

    if (typeof biography === "string") {
      if (biography.length > KAKIOKI_CONFIG.account.maxBioLength) {
        return NextResponse.json(
          {
            error: `Biography must be at most ${KAKIOKI_CONFIG.account.maxBioLength} characters`,
          },
          { status: 400 },
        );
      }
      profileUpdateData.bio =
        biography.trim() || KAKIOKI_CONFIG.account.defaultBio;
    }

    if (currentPassword && newPassword) {
      if (!user.password_hash) {
        return NextResponse.json({ error: "No password set" }, { status: 400 });
      }
      const isValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 },
        );
      }
      nextPasswordHash = await hashPassword(newPassword);

      if (user.secret_key_encrypted) {
        try {
          const privateKey = await decryptPrivateKey(
            user.secret_key_encrypted,
            currentPassword,
          );
          nextSecretKeyEncrypted = await encryptPrivateKey(
            privateKey,
            newPassword,
          );
        } catch (error) {
          console.error("Failed to re-encrypt private key:", error);
          return NextResponse.json(
            { error: "Failed to update encryption keys" },
            { status: 500 },
          );
        }
      }
    }

    if (Object.keys(profileUpdateData).length === 0 && !nextPasswordHash) {
      return NextResponse.json({ error: "No data to update" }, { status: 400 });
    }

    let updatedUser = user;

    if (Object.keys(profileUpdateData).length > 0) {
      const profileUpdatedUser = await userRepository.update(
        userIdNumber,
        profileUpdateData,
      );
      if (!profileUpdatedUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      updatedUser = profileUpdatedUser;
    }

    if (nextPasswordHash) {
      const credentialsUpdatedUser = await userRepository.updateCredentials(
        userIdNumber,
        nextPasswordHash,
        nextSecretKeyEncrypted,
      );
      if (!credentialsUpdatedUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      updatedUser = credentialsUpdatedUser;
    }

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (Object.prototype.hasOwnProperty.call(profileUpdateData, "bio")) {
      try {
        const friendSummary =
          await friendRepository.getFriendSummary(userIdNumber);
        const recipientUserIds = friendSummary.friends.map(
          (entry) => entry.user.id,
        );

        await publishFriendProfileUpdated(recipientUserIds, {
          id: updatedUser.id,
          user_id: updatedUser.user_id,
          username: updatedUser.username,
          avatar_url: updatedUser.avatar_url,
          bio: updatedUser.bio || KAKIOKI_CONFIG.account.defaultBio,
          public_key: updatedUser.public_key,
        });
      } catch (publishError) {
        console.error("Failed to publish friend profile update:", publishError);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        userId: updatedUser.user_id,
        email: updatedUser.email,
        username: updatedUser.username,
        avatarUrl: updatedUser.avatar_url,
        bio: updatedUser.bio,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Error updating profile" },
      { status: 500 },
    );
  }
}
