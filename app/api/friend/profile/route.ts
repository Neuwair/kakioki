import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/ServerAuth";
import { FriendRepository, UserRepository } from "@/lib";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";

const friendRepository = new FriendRepository();
const userRepository = new UserRepository();

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const friendIdParam = request.nextUrl.searchParams.get("friendId");
  if (!friendIdParam) {
    return NextResponse.json(
      { error: "friendId is required" },
      { status: 400 }
    );
  }

  const friendId = Number.parseInt(friendIdParam, 10);
  if (!Number.isFinite(friendId) || friendId <= 0) {
    return NextResponse.json({ error: "Invalid friendId" }, { status: 400 });
  }

  if (friendId === user.id) {
    return NextResponse.json({ error: "Cannot fetch self" }, { status: 400 });
  }

  try {
    const hasFriendship = await friendRepository.hasAcceptedFriendship(
      user.id,
      friendId
    );
    if (!hasFriendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 403 }
      );
    }

    const friendUser = await userRepository.findById(friendId);
    if (!friendUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      friend: {
        id: friendUser.id,
        userId: friendUser.user_id,
        username: friendUser.username,
        avatarUrl: friendUser.avatar_url,
        bio: friendUser.bio || KAKIOKI_CONFIG.account.defaultBio,
        publicKey: friendUser.public_key,
      },
    });
  } catch (error) {
    console.error("Friend profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load friend profile" },
      { status: 500 }
    );
  }
}
