import { randomBytes } from "crypto";
import { UserRepository } from "@/lib/repository/UserRepository";
import { generateUserId } from "@/lib/database/InitializeDB";
import { hashPassword } from "@/lib/security/ArgonConfig";
import {
  generateKeyPair,
  encryptPrivateKey,
  getSodium,
} from "@/lib/security/LibsodiumEncryption";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import type { DbUser } from "@/lib/media/MediaTypes";

const DEFAULT_USER_PROFILES = [
  { username: "Sys_One", email: "SysOne@default-users.kakioki.invalid" },
  { username: "Sys_Two", email: "SysTwo@default-users.kakioki.invalid" },
  { username: "Sys_Three", email: "SysThree@default-users.kakioki.invalid" },
  { username: "Sys_Four", email: "SysFour@default-users.kakioki.invalid" },
  { username: "Sys_Five", email: "SysFive@default-users.kakioki.invalid" },
] as const;

const userRepository = new UserRepository();

async function ensureDefaultUser(
  profile: (typeof DEFAULT_USER_PROFILES)[number],
  existingDefaultUser?: DbUser,
) {
  const existing =
    existingDefaultUser ?? (await userRepository.findByEmail(profile.email));
  if (existing) {
    if (!existing.is_default) {
      throw new Error(
        `Reserved default user email is already in use: ${profile.email}`,
      );
    }
    if (existing.username !== profile.username) {
      const updated = await userRepository.update(existing.id, {
        username: profile.username,
      });
      if (!updated) {
        throw new Error(`Unable to update default user ${profile.username}`);
      }
      return updated;
    }
    return existing;
  }

  const temporaryPassword = randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(temporaryPassword);
  const sodium = await getSodium();
  const { publicKey, privateKey } = await generateKeyPair();
  const publicKeyBase64 = sodium.to_base64(
    publicKey,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const secretKeyEncrypted = await encryptPrivateKey(
    privateKey,
    temporaryPassword,
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await userRepository.create({
        user_id: generateUserId(),
        email: profile.email,
        username: profile.username,
        password_hash: passwordHash,
        public_key: publicKeyBase64,
        secret_key_encrypted: secretKeyEncrypted,
        bio: `This is not a real user, default System Kakioki User: ${profile.username}.`,
        is_default: true,
      });
    } catch (error) {
      const created = await userRepository.findByEmail(profile.email);
      if (created?.is_default) {
        return created;
      }
      if (created || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error(`Unable to provision default user ${profile.username}`);
}

export async function seedDefaultUsers(): Promise<DbUser[]> {
  const existingDefaultUsers = await userRepository.findDefaultUsers();
  const assignedUsers = new Map<string, DbUser>();
  const usersByName = new Map<string, DbUser[]>();

  for (const user of existingDefaultUsers) {
    const username = user.username.toLowerCase();
    const matchingProfile = DEFAULT_USER_PROFILES.find(
      (profile) => profile.username.toLowerCase() === username,
    );
    if (!matchingProfile) {
      continue;
    }
    const matches = usersByName.get(username) ?? [];
    matches.push(user);
    usersByName.set(username, matches);
  }

  for (const profile of DEFAULT_USER_PROFILES) {
    const username = profile.username.toLowerCase();
    const matchingUsers = usersByName.get(username) ?? [];
    matchingUsers.sort((a, b) => {
      const dateDifference =
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime();
      return dateDifference || b.id - a.id;
    });
    const [keep] = matchingUsers;
    if (keep) {
      assignedUsers.set(profile.username, keep);
    }
  }

  const keepIds = new Set(
    Array.from(assignedUsers.values(), (user) => user.id),
  );
  let deletedCount = 0;
  for (const user of existingDefaultUsers) {
    if (!keepIds.has(user.id)) {
      const deleted = await userRepository.deleteDefaultUserById(user.id);
      if (deleted) {
        deletedCount += 1;
      }
    }
  }

  const users: DbUser[] = [];
  for (const profile of DEFAULT_USER_PROFILES) {
    const user = await ensureDefaultUser(
      profile,
      assignedUsers.get(profile.username),
    );
    if (user.user_id.length !== KAKIOKI_CONFIG.account.userIdLength) {
      throw new Error(
        `Default user ${profile.username} has an invalid user ID`,
      );
    }
    users.push(user);
  }
  console.log(`Removed ${deletedCount} duplicate or legacy default users`);
  return users;
}
