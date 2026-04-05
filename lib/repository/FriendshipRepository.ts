import { sql, DatabaseError } from "@/lib/database/InitializeDB";
import type {
  DbUser,
  FriendSearchResult,
  FriendRequestRecord,
  FriendSummary,
  FriendRequestStatus,
} from "@/lib/media/MediaTypes";

const MIN_SIMILARITY = 0.2;

function isUndefinedTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  if (code === "42P01") {
    return true;
  }
  const original = (error as { originalError?: unknown }).originalError;
  if (original && typeof original === "object") {
    return ((original as { code?: string }).code ?? undefined) === "42P01";
  }
  return false;
}

function wrapDatabaseError(message: string, error: unknown): DatabaseError {
  if (isUndefinedTableError(error)) {
    return new DatabaseError(
      "Friend features require database migrations. Run `npm run db:migrate`.",
      error as Error,
    );
  }
  return new DatabaseError(message, error as Error);
}

function sanitizeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export class FriendRepository {
  async searchUsersFuzzy(
    query: string,
    currentUserId: number,
    limit: number = 20,
  ): Promise<FriendSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }

    try {
      const likePattern = `%${sanitizeLike(trimmed)}%`;
      const similarityThreshold = trimmed.length >= 3 ? MIN_SIMILARITY : 1;

      const result = await sql`
        SELECT
          u.id,
          u.user_id,
          u.email,
          u.username,
          u.password_hash,
          u.avatar_url,
          u.public_key,
          u.secret_key_encrypted,
          u.is_verified,
          u.verification_token,
          u.created_at,
          u.updated_at,
          fr.id AS friendship_id,
          fr.status AS friendship_status,
          fr.from_id AS requester_id,
          fr.to_id AS addressee_id,
          similarity(u.username, ${trimmed}) AS username_similarity
        FROM users u
        LEFT JOIN friend_requests fr ON (
          (fr.from_id = ${currentUserId} AND fr.to_id = u.id)
          OR (fr.to_id = ${currentUserId} AND fr.from_id = u.id)
        )
        WHERE u.id != ${currentUserId}
          AND (
            u.username ILIKE ${likePattern}
            OR similarity(u.username, ${trimmed}) >= ${similarityThreshold}
          )
        ORDER BY username_similarity DESC, u.username ASC
        LIMIT ${limit}
      `;

      return result.map((row) => {
        const record = row as Record<string, unknown>;
        const { username_similarity, ...rest } = record;
        void username_similarity;
        return rest as unknown as FriendSearchResult;
      });
    } catch (error) {
      throw wrapDatabaseError("Failed to perform fuzzy search", error);
    }
  }

  async sendFriendRequest(
    fromUserId: number,
    toUserId: number,
  ): Promise<FriendRequestRecord> {
    if (fromUserId === toUserId) {
      throw new DatabaseError("Cannot send friend request to yourself");
    }

    try {
      const existing = await sql`
        SELECT * FROM friend_requests
        WHERE (from_id = ${fromUserId} AND to_id = ${toUserId})
           OR (from_id = ${toUserId} AND to_id = ${fromUserId})
        LIMIT 1
      `;

      if (existing.length > 0) {
        const record = existing[0] as FriendRequestRecord;
        if (record.status === "accepted") {
          return record;
        }
        if (record.from_id === fromUserId) {
          throw new DatabaseError("Friend request already pending");
        }
        throw new DatabaseError("Incoming friend request exists");
      }

      const inserted = await sql`
        INSERT INTO friend_requests (from_id, to_id, status)
        VALUES (${fromUserId}, ${toUserId}, 'pending')
        RETURNING *
      `;

      return inserted[0] as FriendRequestRecord;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw wrapDatabaseError("Failed to send friend request", error);
    }
  }

  async cancelFriendRequest(
    fromUserId: number,
    toUserId: number,
  ): Promise<FriendRequestRecord | null> {
    try {
      const deleted = await sql`
        DELETE FROM friend_requests
        WHERE from_id = ${fromUserId}
          AND to_id = ${toUserId}
          AND status = 'pending'
        RETURNING *
      `;

      if (deleted.length === 0) {
        return null;
      }

      return deleted[0] as FriendRequestRecord;
    } catch (error) {
      throw wrapDatabaseError("Failed to cancel friend request", error);
    }
  }

  async declineFriendRequest(
    fromUserId: number,
    toUserId: number,
  ): Promise<FriendRequestRecord | null> {
    try {
      const deleted = await sql`
        DELETE FROM friend_requests
        WHERE from_id = ${fromUserId}
          AND to_id = ${toUserId}
          AND status = 'pending'
        RETURNING *
      `;

      if (deleted.length === 0) {
        return null;
      }

      return deleted[0] as FriendRequestRecord;
    } catch (error) {
      throw wrapDatabaseError("Failed to decline friend request", error);
    }
  }

  async acceptFriendRequest(
    fromUserId: number,
    toUserId: number,
  ): Promise<FriendRequestRecord | null> {
    try {
      const updated = await sql`
        UPDATE friend_requests
        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
        WHERE from_id = ${fromUserId}
          AND to_id = ${toUserId}
          AND status = 'pending'
        RETURNING *
      `;

      if (updated.length === 0) {
        return null;
      }

      return updated[0] as FriendRequestRecord;
    } catch (error) {
      throw wrapDatabaseError("Failed to accept friend request", error);
    }
  }

  async getFriendSummary(userId: number): Promise<FriendSummary> {
    try {
      const friends = await sql`
        SELECT
          fr.id AS request_id,
          fr.from_id,
          fr.to_id,
          fr.status,
          fr.created_at AS request_created_at,
          fr.updated_at AS request_updated_at,
          u.id AS user_id,
          u.user_id AS user_public_id,
          u.email AS user_email,
          u.username AS user_username,
          u.password_hash AS user_password_hash,
          u.avatar_url AS user_avatar_url,
          u.bio AS user_bio,
          u.public_key AS user_public_key,
          u.secret_key_encrypted AS user_secret_key_encrypted,
          u.is_verified AS user_is_verified,
          u.verification_token AS user_verification_token,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,
          mt.thread_id AS thread_public_id,
          mt.id AS thread_internal_id,
          ub_self.blocker_id AS self_blocker_id,
          ub_self.created_at AS self_blocked_at,
          ub_friend.blocker_id AS friend_blocker_id,
          ub_friend.created_at AS friend_blocked_at
        FROM friend_requests fr
        JOIN users u ON u.id = CASE WHEN fr.from_id = ${userId} THEN fr.to_id ELSE fr.from_id END
        LEFT JOIN message_threads mt ON (
          mt.user_a_id = LEAST(fr.from_id, fr.to_id)
          AND mt.user_b_id = GREATEST(fr.from_id, fr.to_id)
        )
        LEFT JOIN user_blocks ub_self ON ub_self.blocker_id = ${userId}
          AND ub_self.blocked_id = CASE WHEN fr.from_id = ${userId} THEN fr.to_id ELSE fr.from_id END
        LEFT JOIN user_blocks ub_friend ON ub_friend.blocker_id = CASE WHEN fr.from_id = ${userId} THEN fr.to_id ELSE fr.from_id END
          AND ub_friend.blocked_id = ${userId}
        WHERE fr.status = 'accepted'
          AND (fr.from_id = ${userId} OR fr.to_id = ${userId})
        ORDER BY fr.updated_at DESC
      `;

      const incoming = await sql`
        SELECT
          fr.id AS request_id,
          fr.from_id,
          fr.to_id,
          fr.status,
          fr.created_at AS request_created_at,
          fr.updated_at AS request_updated_at,
          u.id AS user_id,
          u.user_id AS user_public_id,
          u.email AS user_email,
          u.username AS user_username,
          u.password_hash AS user_password_hash,
          u.avatar_url AS user_avatar_url,
          u.bio AS user_bio,
          u.public_key AS user_public_key,
          u.secret_key_encrypted AS user_secret_key_encrypted,
          u.is_verified AS user_is_verified,
          u.verification_token AS user_verification_token,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,
          NULL::uuid AS thread_public_id,
          NULL::integer AS thread_internal_id,
          ub_self.blocker_id AS self_blocker_id,
          ub_self.created_at AS self_blocked_at,
          ub_friend.blocker_id AS friend_blocker_id,
          ub_friend.created_at AS friend_blocked_at
        FROM friend_requests fr
        JOIN users u ON u.id = fr.from_id
        LEFT JOIN user_blocks ub_self ON ub_self.blocker_id = ${userId} AND ub_self.blocked_id = fr.from_id
        LEFT JOIN user_blocks ub_friend ON ub_friend.blocker_id = fr.from_id AND ub_friend.blocked_id = ${userId}
        WHERE fr.status = 'pending'
          AND fr.to_id = ${userId}
        ORDER BY fr.created_at DESC
      `;

      const outgoing = await sql`
        SELECT
          fr.id AS request_id,
          fr.from_id,
          fr.to_id,
          fr.status,
          fr.created_at AS request_created_at,
          fr.updated_at AS request_updated_at,
          u.id AS user_id,
          u.user_id AS user_public_id,
          u.email AS user_email,
          u.username AS user_username,
          u.password_hash AS user_password_hash,
          u.avatar_url AS user_avatar_url,
          u.bio AS user_bio,
          u.public_key AS user_public_key,
          u.secret_key_encrypted AS user_secret_key_encrypted,
          u.is_verified AS user_is_verified,
          u.verification_token AS user_verification_token,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,
          NULL::uuid AS thread_public_id,
          NULL::integer AS thread_internal_id,
          ub_self.blocker_id AS self_blocker_id,
          ub_self.created_at AS self_blocked_at,
          ub_friend.blocker_id AS friend_blocker_id,
          ub_friend.created_at AS friend_blocked_at
        FROM friend_requests fr
        JOIN users u ON u.id = fr.to_id
        LEFT JOIN user_blocks ub_self ON ub_self.blocker_id = ${userId} AND ub_self.blocked_id = fr.to_id
        LEFT JOIN user_blocks ub_friend ON ub_friend.blocker_id = fr.to_id AND ub_friend.blocked_id = ${userId}
        WHERE fr.status = 'pending'
          AND fr.from_id = ${userId}
        ORDER BY fr.created_at DESC
      `;

      const mapRowToUser = (row: Record<string, unknown>): DbUser => ({
        id: row.user_id as number,
        user_id: row.user_public_id as string,
        email: row.user_email as string,
        username: row.user_username as string,
        password_hash: row.user_password_hash as string | undefined,
        avatar_url: row.user_avatar_url as string | undefined,
        bio: row.user_bio as string | undefined,
        public_key: row.user_public_key as string | undefined,
        secret_key_encrypted: row.user_secret_key_encrypted as
          | string
          | undefined,
        is_verified: row.user_is_verified as boolean | undefined,
        verification_token: row.user_verification_token as string | undefined,
        created_at: row.user_created_at as string | undefined,
        updated_at: row.user_updated_at as string | undefined,
      });

      const mapRowToRequest = (
        row: Record<string, unknown>,
      ): FriendRequestRecord => ({
        id: row.request_id as number,
        from_id: row.from_id as number,
        to_id: row.to_id as number,
        status: row.status as FriendRequestStatus,
        created_at: row.request_created_at as string | undefined,
        updated_at: row.request_updated_at as string | undefined,
      });

      const mapToSummary = (row: Record<string, unknown>) => {
        const entry = {
          user: mapRowToUser(row),
          request: mapRowToRequest(row),
          threadPublicId: row.thread_public_id as string | null | undefined,
          threadInternalId: row.thread_internal_id as number | null | undefined,
          blockedBySelf: Boolean(row.self_blocker_id),
          blockedSelfAt:
            (row.self_blocked_at as string | null | undefined) ?? null,
          blockedByFriend: Boolean(row.friend_blocker_id),
          blockedFriendAt:
            (row.friend_blocked_at as string | null | undefined) ?? null,
        } as const;
        return entry;
      };

      return {
        friends: friends.map((row) =>
          mapToSummary(row as Record<string, unknown>),
        ),
        incoming: incoming.map((row) =>
          mapToSummary(row as Record<string, unknown>),
        ),
        outgoing: outgoing.map((row) =>
          mapToSummary(row as Record<string, unknown>),
        ),
      };
    } catch (error) {
      throw wrapDatabaseError("Failed to load friend summary", error);
    }
  }

  async removeFriendship(userId: number, friendId: number): Promise<boolean> {
    try {
      const result = await sql`
        DELETE FROM friend_requests
        WHERE status = 'accepted'
          AND (
            (from_id = ${userId} AND to_id = ${friendId})
            OR (from_id = ${friendId} AND to_id = ${userId})
          )
        RETURNING id
      `;
      return result.length > 0;
    } catch (error) {
      throw wrapDatabaseError("Failed to remove friendship", error);
    }
  }

  async hasAcceptedFriendship(
    userId: number,
    friendId: number,
  ): Promise<boolean> {
    try {
      const result = await sql`
        SELECT 1
        FROM friend_requests
        WHERE status = 'accepted'
          AND (
            (from_id = ${userId} AND to_id = ${friendId})
            OR (from_id = ${friendId} AND to_id = ${userId})
          )
        LIMIT 1
      `;
      return result.length > 0;
    } catch (error) {
      throw wrapDatabaseError("Failed to verify friendship", error);
    }
  }
}
