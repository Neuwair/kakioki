import { NextResponse } from "next/server";
import { UserRepository } from "@/lib";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const userRepository = new UserRepository();
    const userIdNumber = parseInt(userId, 10);
    if (isNaN(userIdNumber) || userIdNumber <= 0) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await userRepository.findById(userIdNumber);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        userId: user.user_id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatar_url,
        bio: user.bio || KAKIOKI_CONFIG.account.defaultBio,
        publicKey: user.public_key,
        secretKeyEncrypted: user.secret_key_encrypted,
      },
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching user data" },
      { status: 500 }
    );
  }
}
