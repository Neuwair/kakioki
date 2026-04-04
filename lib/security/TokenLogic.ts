import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { AuthenticatedUser } from "@/lib/media/MediaTypes";

const JWT_SECRET = process.env.JWT_SECRET;
const STACK_SECRET_SERVER_KEY = process.env.STACK_SECRET_SERVER_KEY;

function normalizePem(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\\n/g, "\n");
}

const JWT_PRIVATE_KEY = normalizePem(process.env.JWT_PRIVATE_KEY || undefined);
const JWT_PUBLIC_KEY = normalizePem(process.env.JWT_PUBLIC_KEY || undefined);

const JWT_ALGORITHM = JWT_PRIVATE_KEY && JWT_PUBLIC_KEY ? "RS256" : "HS256";

function getJwtSecretOrEmpty(): string {
  if (JWT_ALGORITHM === "RS256") return JWT_PRIVATE_KEY || "";
  const resolved = resolveHmacSecret();
  return resolved || "";
}

function getJwtSecretOrThrow(minLength = 32): string {
  if (JWT_ALGORITHM === "RS256") {
    if (!JWT_PRIVATE_KEY) throw new Error("JWT_PRIVATE_KEY must be set");
    return JWT_PRIVATE_KEY;
  }
  const resolved = resolveHmacSecret();
  if (!resolved) throw new Error("JWT secret source must be set");
  if (resolved.length < minLength)
    throw new Error(
      `JWT secret could not be resolved to at least ${minLength} characters`,
    );
  return resolved;
}

function ensureJwtSecretForProduction(): void {
  if (process.env.NODE_ENV === "production") {
    if (JWT_ALGORITHM === "RS256") {
      if (!JWT_PRIVATE_KEY || !JWT_PUBLIC_KEY)
        throw new Error(
          "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production",
        );
    } else {
      const resolved = resolveHmacSecret();
      if (!resolved)
        throw new Error("JWT secret source must be configured in production");
      if (resolved.length < 32)
        throw new Error(
          "JWT secret source must resolve to at least 32 characters in production",
        );
    }
  }
}

export function generateToken(
  user: AuthenticatedUser,
  claims?: Record<string, unknown>,
): string {
  const allowedClaims = new Set(["username", "email"]);
  const payload: Record<string, unknown> = { id: user.id, userId: user.userId };
  if (claims) {
    for (const [k, v] of Object.entries(claims)) {
      if (allowedClaims.has(k)) payload[k] = v;
    }
  }
  if (JWT_ALGORITHM === "RS256") {
    if (!JWT_PRIVATE_KEY) throw new Error("JWT_PRIVATE_KEY must be set");
    return jwt.sign(payload, JWT_PRIVATE_KEY, {
      expiresIn: "7d",
      algorithm: JWT_ALGORITHM as unknown as jwt.Algorithm,
    });
  }
  const secret = getJwtSecretOrThrow();
  return jwt.sign(payload, secret, {
    expiresIn: "7d",
    algorithm: JWT_ALGORITHM as unknown as jwt.Algorithm,
  });
}

function normalizeSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length >= 32) return trimmed;
  return createHash("sha256").update(trimmed).digest("hex");
}

function resolveHmacSecret(): string | null {
  if (typeof JWT_SECRET === "string" && JWT_SECRET.trim().length > 0)
    return normalizeSecret(JWT_SECRET);
  if (
    typeof STACK_SECRET_SERVER_KEY === "string" &&
    STACK_SECRET_SERVER_KEY.trim().length > 0
  )
    return normalizeSecret(STACK_SECRET_SERVER_KEY);
  return null;
}

type JwtPayloadLike = Record<string, unknown>;

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    if (JWT_ALGORITHM === "RS256") {
      if (!JWT_PUBLIC_KEY) return null;
      const decodedRaw = jwt.verify(token, JWT_PUBLIC_KEY, {
        algorithms: [JWT_ALGORITHM],
      }) as unknown;
      if (!decodedRaw || typeof decodedRaw !== "object") return null;
      const decoded = decodedRaw as JwtPayloadLike;
      if (
        (typeof decoded.id === "number" || typeof decoded.id === "string") &&
        typeof decoded.userId === "string"
      ) {
        return {
          id: Number(decoded.id),
          userId: decoded.userId,
          email: (decoded.email as string) || "",
          username: (decoded.username as string) || "",
        };
      }
      return null;
    }
    const secret = getJwtSecretOrThrow();
    const decodedRaw = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    }) as unknown;
    if (!decodedRaw || typeof decodedRaw !== "object") return null;
    const decoded = decodedRaw as JwtPayloadLike;
    if (
      (typeof decoded.id === "number" || typeof decoded.id === "string") &&
      typeof decoded.userId === "string"
    ) {
      return {
        id: Number(decoded.id),
        userId: decoded.userId as string,
        email: (decoded.email as string) || "",
        username: (decoded.username as string) || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getBearerToken(request: {
  headers: { get: (k: string) => string | null };
}): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

export {
  JWT_ALGORITHM,
  ensureJwtSecretForProduction,
  getJwtSecretOrEmpty,
  getJwtSecretOrThrow,
  resolveHmacSecret,
};

export type { AuthenticatedUser };
