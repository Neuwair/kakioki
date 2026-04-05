import { NextRequest } from "next/server";
import { UserRepository } from "@/lib";
import {
  ensureJwtSecretForProduction,
  verifyToken,
  getBearerToken,
  AuthenticatedUser,
} from "@/lib/security/TokenLogic";

ensureJwtSecretForProduction();

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

export async function authenticateRequest(
  request: NextRequest,
  userRepository?: UserRepository,
): Promise<AuthResult> {
  try {
    const token = getBearerToken(request as unknown as Request);
    if (!token)
      return { success: false, error: "No valid authorization header" };

    const decoded = verifyToken(token);
    if (!decoded) return { success: false, error: "Invalid or expired token" };

    const repo = userRepository || new UserRepository();
    const user = await repo.findById(decoded.id);

    if (!user) return { success: false, error: "User not found" };

    return {
      success: true,
      user: {
        id: user.id,
        userId: user.user_id,
        email: user.email,
        username: user.username,
      },
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

export async function requireAuth(
  request: NextRequest,
): Promise<{ user: AuthenticatedUser } | Response> {
  const authResult = await authenticateRequest(request);

  if (!authResult.success || !authResult.user) {
    return new Response(
      JSON.stringify({ error: authResult.error || "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return { user: authResult.user };
}
