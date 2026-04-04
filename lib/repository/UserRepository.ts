import { sql, DatabaseError } from "@/lib/database/InitializeDB";
import { KAKIOKI_CONFIG } from "@/lib/config/KakiokiConfig";
import type {
  DbUser,
  CreateUserData,
  UpdateUserData,
} from "@/lib/media/MediaTypes";

export class UserRepository {
  async create(userData: CreateUserData): Promise<DbUser> {
    try {
      const defaultBio =
        userData.bio || KAKIOKI_CONFIG.account.defaultBio;
      const result = await sql`
        INSERT INTO users (user_id, email, username, password_hash, public_key, secret_key_encrypted, avatar_url, bio, verification_token)
        VALUES (
          ${userData.user_id},
          ${userData.email},
          ${userData.username},
          ${userData.password_hash},
          ${userData.public_key ?? null},
          ${userData.secret_key_encrypted ?? null},
          ${userData.avatar_url ?? null},
          ${defaultBio},
          ${userData.verification_token ?? null}
        )
        RETURNING *
      `;
      return result[0] as DbUser;
    } catch (error) {
      throw new DatabaseError("Failed to create DbUser", error as Error);
    }
  }

  async findById(id: number): Promise<DbUser | null> {
    try {
      const result = await sql`
        SELECT * FROM users WHERE id = ${id} LIMIT 1
      `;
      return (result[0] as DbUser) || null;
    } catch (error) {
      throw new DatabaseError("Failed to find DbUser by ID", error as Error);
    }
  }

  async findByUserId(userId: string): Promise<DbUser | null> {
    try {
      const result = await sql`
        SELECT * FROM users WHERE user_id = ${userId} LIMIT 1
      `;
      return (result[0] as DbUser) || null;
    } catch (error) {
      throw new DatabaseError(
        "Failed to find DbUser by DbUser ID",
        error as Error
      );
    }
  }

  async findByEmail(email: string): Promise<DbUser | null> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await sql`
        SELECT * FROM users WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
      `;
      return (result[0] as DbUser) || null;
    } catch (error) {
      throw new DatabaseError("Failed to find DbUser by email", error as Error);
    }
  }

  async deleteById(id: number): Promise<boolean> {
    try {
      const result = await sql`
        DELETE FROM users WHERE id = ${id} RETURNING id
      `;
      return result.length > 0;
    } catch (error) {
      throw new DatabaseError("Failed to delete DbUser", error as Error);
    }
  }

  async updateCredentials(
    id: number,
    passwordHash: string,
    secretKeyEncrypted?: string | null,
  ): Promise<DbUser | null> {
    try {
      if (secretKeyEncrypted === undefined) {
        const result = await sql`
          UPDATE users
          SET password_hash = ${passwordHash}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      const result = await sql`
        UPDATE users
        SET password_hash = ${passwordHash}, secret_key_encrypted = ${secretKeyEncrypted}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
      return (result[0] as DbUser) || null;
    } catch (error) {
      throw new DatabaseError("Failed to update DbUser credentials", error as Error);
    }
  }

  async update(id: number, updateData: UpdateUserData): Promise<DbUser | null> {
    try {
      const filteredData = Object.fromEntries(
        Object.entries(updateData).filter(([, value]) => value !== undefined)
      );

      if (Object.keys(filteredData).length === 0) {
        return this.findById(id);
      }

      if (
        "avatar_url" in filteredData &&
        typeof filteredData.avatar_url === "string"
      ) {
        console.log("Avatar URL length:", filteredData.avatar_url.length);
        if (filteredData.avatar_url.length > 100) {
          console.log(
            "Avatar URL preview:",
            filteredData.avatar_url.substring(0, 50) + "..."
          );
        }
      }

      if (
        "avatar_url" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users 
          SET avatar_url = ${filteredData.avatar_url}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "email" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users
          SET email = ${filteredData.email}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "username" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users 
          SET username = ${filteredData.username}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "is_verified" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users 
          SET is_verified = ${filteredData.is_verified}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "verification_token" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users 
          SET verification_token = ${filteredData.verification_token}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "password_hash" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users 
          SET password_hash = ${filteredData.password_hash}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "bio" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users 
          SET bio = ${filteredData.bio}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "public_key" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users
          SET public_key = ${filteredData.public_key}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      if (
        "secret_key_encrypted" in filteredData &&
        Object.keys(filteredData).length === 1
      ) {
        const result = await sql`
          UPDATE users
          SET secret_key_encrypted = ${filteredData.secret_key_encrypted}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return (result[0] as DbUser) || null;
      }

      const allowedFields = [
        "email",
        "username",
        "avatar_url",
        "bio",
        "is_verified",
        "verification_token",
        "password_hash",
        "public_key",
        "secret_key_encrypted",
      ];

      const entries = Object.entries(filteredData).filter(([k]) =>
        allowedFields.includes(k)
      );

      if (entries.length === 0) {
        return this.findById(id);
      }

      const setFragments = entries.map(
        ([key, value]) => sql`${sql.unsafe(key)} = ${value}`
      );
      let setClause = setFragments[0];
      for (let i = 1; i < setFragments.length; i++) {
        setClause = sql`${setClause}, ${setFragments[i]}`;
      }

      const result = await sql`
        UPDATE users
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      return (result[0] as DbUser) || null;
    } catch (error) {
      console.error("Error updating DbUser:", error);
      throw new DatabaseError("Failed to update DbUser", error as Error);
    }
  }

  async searchUsers(
    query: string,
    excludeUserId?: number,
    limit: number = 50
  ): Promise<DbUser[]> {
    try {
      const result = excludeUserId
        ? await sql`
            SELECT * FROM users
            WHERE to_tsvector('simple', coalesce(username, '') || ' ' || coalesce(email, '')) @@ plainto_tsquery('simple', ${query})
              AND id != ${excludeUserId}
            ORDER BY username
            LIMIT ${limit}
          `
        : await sql`
            SELECT * FROM users
            WHERE to_tsvector('simple', coalesce(username, '') || ' ' || coalesce(email, '')) @@ plainto_tsquery('simple', ${query})
            ORDER BY username
            LIMIT ${limit}
          `;

      return result as DbUser[];
    } catch (error) {
      throw new DatabaseError("Failed to search users", error as Error);
    }
  }
}
