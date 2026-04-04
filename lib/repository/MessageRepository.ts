import { randomUUID } from "crypto";
import { sql, DatabaseError } from "@/lib/database/InitializeDB";
import type {
  EncryptedMessageRecord,
  MessageMetadata,
  MessageStatusMetadata,
  MessageThreadRecord,
} from "@/lib/media/MediaTypes";

function orderPair(a: number, b: number) {
  return a < b ? [a, b] : [b, a];
}

function toJsonString(
  payload: MessageMetadata | MessageStatusMetadata | null | undefined
) {
  if (!payload) {
    return JSON.stringify({});
  }
  return JSON.stringify(payload);
}

function handleDatabaseError(message: string, error: unknown): never {
  throw new DatabaseError(message, error instanceof Error ? error : undefined);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return fallback;
}

export class MessageRepository {
  async getThreadByPublicId(
    threadId: string
  ): Promise<MessageThreadRecord | null> {
    try {
      const rows = await sql`
        SELECT id, thread_id, user_a_id, user_b_id, created_at, updated_at
        FROM message_threads
        WHERE thread_id = ${threadId}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return null;
      }
      const record = rows[0] as Record<string, unknown>;
      return this.mapThread(record);
    } catch (error) {
      handleDatabaseError("Failed to load thread", error);
    }
  }

  async getOrCreateThread(
    userIdA: number,
    userIdB: number
  ): Promise<MessageThreadRecord> {
    const [userAId, userBId] = orderPair(userIdA, userIdB);
    try {
      const existing = await sql`
        SELECT id, thread_id, user_a_id, user_b_id, created_at, updated_at
        FROM message_threads
        WHERE user_a_id = ${userAId}
          AND user_b_id = ${userBId}
        LIMIT 1
      `;
      if (existing.length > 0) {
        const record = existing[0] as Record<string, unknown>;
        return this.mapThread(record);
      }
      const inserted = await sql`
        INSERT INTO message_threads (thread_id, user_a_id, user_b_id)
        VALUES (${randomUUID()}, ${userAId}, ${userBId})
        RETURNING id, thread_id, user_a_id, user_b_id, created_at, updated_at
      `;
      const record = inserted[0] as Record<string, unknown>;
      return this.mapThread(record);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        try {
          const retry = await sql`
            SELECT id, thread_id, user_a_id, user_b_id, created_at, updated_at
            FROM message_threads
            WHERE user_a_id = ${userAId}
              AND user_b_id = ${userBId}
            LIMIT 1
          `;
          if (retry.length > 0) {
            const record = retry[0] as Record<string, unknown>;
            return this.mapThread(record);
          }
        } catch (retryError) {
          handleDatabaseError("Failed to load message thread", retryError);
        }
      }
      handleDatabaseError("Failed to upsert message thread", error);
    }
  }

  async findThreadByParticipants(
    userIdA: number,
    userIdB: number
  ): Promise<MessageThreadRecord | null> {
    const [userAId, userBId] = orderPair(userIdA, userIdB);
    try {
      const existing = await sql`
        SELECT id, thread_id, user_a_id, user_b_id, created_at, updated_at
        FROM message_threads
        WHERE user_a_id = ${userAId}
          AND user_b_id = ${userBId}
        LIMIT 1
      `;
      if (existing.length === 0) {
        return null;
      }
      return this.mapThread(existing[0] as Record<string, unknown>);
    } catch (error) {
      handleDatabaseError("Failed to locate thread", error);
    }
  }

  async storeEncryptedMessage(options: {
    threadPublicId: string;
    fromId: number;
    toId: number;
    clientMessageId: string;
    ciphertext: string;
    nonce: string;
    metadata?: MessageMetadata | null;
    statusMetadata?: MessageStatusMetadata | null;
  }): Promise<EncryptedMessageRecord> {
    const thread = await this.getThreadByPublicId(options.threadPublicId);
    if (!thread) {
      handleDatabaseError("Thread not found", new Error("thread_missing"));
    }
    const metadata = toJsonString(options.metadata ?? {});
    const statusMetadata = toJsonString(options.statusMetadata ?? {});
    try {
      const rows = await sql`
        INSERT INTO messages (
          thread_id,
          from_id,
          to_id,
          client_message_id,
          ciphertext,
          nonce,
          metadata,
          status_metadata
        ) VALUES (
          ${thread.internalId},
          ${options.fromId},
          ${options.toId},
          ${options.clientMessageId},
          ${options.ciphertext},
          ${options.nonce},
          ${metadata}::jsonb,
          ${statusMetadata}::jsonb
        )
        ON CONFLICT (client_message_id) DO UPDATE SET
          ciphertext = EXCLUDED.ciphertext,
          nonce = EXCLUDED.nonce,
          metadata = EXCLUDED.metadata,
          status_metadata = EXCLUDED.status_metadata
        RETURNING id, thread_id, from_id, to_id, client_message_id, ciphertext, nonce, metadata, status_metadata, created_at
      `;
      const record = rows[0] as Record<string, unknown>;
      return this.mapMessage(record, thread.threadId);
    } catch (error) {
      handleDatabaseError("Failed to store encrypted message", error);
    }
  }

  async fetchThreadMessages(options: {
    threadPublicId: string;
    limit?: number;
    after?: string | null;
  }): Promise<EncryptedMessageRecord[]> {
    const thread = await this.getThreadByPublicId(options.threadPublicId);
    if (!thread) {
      return [];
    }
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    try {
      if (options.after) {
        const rows = await sql`
          SELECT id, thread_id, from_id, to_id, client_message_id, ciphertext, nonce, metadata, status_metadata, created_at
          FROM messages
          WHERE thread_id = ${thread.internalId}
            AND created_at > ${options.after}
          ORDER BY created_at ASC
          LIMIT ${limit}
        `;
        return rows.map((row) =>
          this.mapMessage(row as Record<string, unknown>, thread.threadId)
        );
      }
      const rows = await sql`
        SELECT id, thread_id, from_id, to_id, client_message_id, ciphertext, nonce, metadata, status_metadata, created_at
        FROM messages
        WHERE thread_id = ${thread.internalId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return rows
        .map((row) =>
          this.mapMessage(row as Record<string, unknown>, thread.threadId)
        )
        .reverse();
    } catch (error) {
      handleDatabaseError("Failed to load thread messages", error);
    }
  }

  async getThreadParticipants(
    threadPublicId: string
  ): Promise<{ userAId: number; userBId: number } | null> {
    const thread = await this.getThreadByPublicId(threadPublicId);
    if (!thread) {
      return null;
    }
    return { userAId: thread.userAId, userBId: thread.userBId };
  }

  async deleteMessagesByThreadPublicId(threadPublicId: string): Promise<boolean> {
    const thread = await this.getThreadByPublicId(threadPublicId);
    if (!thread) {
      return false;
    }
    try {
      await sql`
        DELETE FROM messages
        WHERE thread_id = ${thread.internalId}
      `;
      return true;
    } catch (error) {
      handleDatabaseError("Failed to delete thread messages", error);
    }
  }

  async getMessageByClientId(
    threadPublicId: string,
    clientMessageId: string
  ): Promise<EncryptedMessageRecord | null> {
    const thread = await this.getThreadByPublicId(threadPublicId);
    if (!thread) {
      return null;
    }

    try {
      const rows = await sql`
        SELECT id, thread_id, from_id, to_id, client_message_id, ciphertext, nonce, metadata, status_metadata, created_at
        FROM messages
        WHERE thread_id = ${thread.internalId}
          AND client_message_id = ${clientMessageId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return null;
      }

      return this.mapMessage(
        rows[0] as Record<string, unknown>,
        thread.threadId
      );
    } catch (error) {
      handleDatabaseError("Failed to load message", error);
    }
  }

  async deleteThreadByPublicId(threadPublicId: string): Promise<boolean> {
    const thread = await this.getThreadByPublicId(threadPublicId);
    if (!thread) {
      return false;
    }
    try {
      const result = await sql`
        DELETE FROM message_threads
        WHERE id = ${thread.internalId}
        RETURNING id
      `;
      return result.length > 0;
    } catch (error) {
      handleDatabaseError("Failed to delete thread", error);
    }
  }

  async deleteThreadByParticipants(
    userIdA: number,
    userIdB: number
  ): Promise<boolean> {
    const [userAId, userBId] = orderPair(userIdA, userIdB);
    try {
      const result = await sql`
        DELETE FROM message_threads
        WHERE user_a_id = ${userAId}
          AND user_b_id = ${userBId}
        RETURNING id
      `;
      return result.length > 0;
    } catch (error) {
      handleDatabaseError("Failed to delete thread", error);
    }
  }

  async updateMessageStatusByClientId(
    clientMessageId: string,
    updates: MessageStatusMetadata
  ): Promise<EncryptedMessageRecord | null> {
    const payload = toJsonString(updates ?? {});
    try {
      const rows = await sql`
        UPDATE messages
        SET status_metadata = COALESCE(status_metadata, '{}'::jsonb) || ${payload}::jsonb
        WHERE client_message_id = ${clientMessageId}
        RETURNING
          id,
          thread_id,
          from_id,
          to_id,
          client_message_id,
          ciphertext,
          nonce,
          metadata,
          status_metadata,
          created_at,
          (SELECT thread_id FROM message_threads WHERE message_threads.id = messages.thread_id) AS thread_public_id
      `;
      if (rows.length === 0) {
        return null;
      }
      const record = rows[0] as Record<string, unknown>;
      const threadId = record.thread_public_id as string | undefined;
      if (!threadId) {
        return null;
      }
      return this.mapMessage(record, threadId);
    } catch (error) {
      handleDatabaseError("Failed to update message status", error);
    }
  }

  async blockUser(blockerId: number, blockedId: number): Promise<void> {
    if (blockerId === blockedId) {
      handleDatabaseError("Cannot block self", new Error("block_self"));
    }
    try {
      await sql`
        INSERT INTO user_blocks (blocker_id, blocked_id)
        VALUES (${blockerId}, ${blockedId})
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `;
    } catch (error) {
      handleDatabaseError("Failed to block user", error);
    }
  }

  async unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
    try {
      const result = await sql`
        DELETE FROM user_blocks
        WHERE blocker_id = ${blockerId}
          AND blocked_id = ${blockedId}
        RETURNING id
      `;
      return result.length > 0;
    } catch (error) {
      handleDatabaseError("Failed to unblock user", error);
    }
  }

  async getBlockStatus(
    userId: number,
    otherUserId: number
  ): Promise<{
    isBlocked: boolean;
    blockedBy?: number;
    recordCreatedAt?: string;
  }> {
    try {
      const rows = await sql`
        SELECT blocker_id, blocked_id, created_at
        FROM user_blocks
        WHERE (blocker_id = ${userId} AND blocked_id = ${otherUserId})
           OR (blocker_id = ${otherUserId} AND blocked_id = ${userId})
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (rows.length === 0) {
        return { isBlocked: false };
      }
      const row = rows[0] as {
        blocker_id: number;
        blocked_id: number;
        created_at: string;
      };
      return {
        isBlocked: true,
        blockedBy: row.blocker_id,
        recordCreatedAt: row.created_at,
      };
    } catch (error) {
      handleDatabaseError("Failed to resolve block status", error);
    }
  }

  private mapThread(row: Record<string, unknown>): MessageThreadRecord {
    return {
      internalId: row.id as number,
      threadId: row.thread_id as string,
      userAId: row.user_a_id as number,
      userBId: row.user_b_id as number,
      createdAt: row.created_at as string | undefined,
      updatedAt: row.updated_at as string | undefined,
    };
  }

  private mapMessage(
    row: Record<string, unknown>,
    threadPublicId: string
  ): EncryptedMessageRecord {
    return {
      id: row.id as number,
      threadPublicId,
      threadInternalId: row.thread_id as number,
      fromId: row.from_id as number,
      toId: row.to_id as number,
      clientMessageId: row.client_message_id as string,
      ciphertext: row.ciphertext as string,
      nonce: row.nonce as string,
      metadata: parseJson<MessageMetadata>(row.metadata, {}),
      statusMetadata: parseJson<MessageStatusMetadata>(row.status_metadata, {}),
      createdAt: row.created_at as string,
    };
  }
}
