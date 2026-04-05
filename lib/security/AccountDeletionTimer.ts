import { UserRepository, sql } from "@/lib";
import type { DbUser } from "@/lib/media/MediaTypes";
import { publishAccountDeletionEvent } from "@/lib/events/RealtimeEvents";

const DELETION_DELAY_MS = 1000 * 60 * 60 * 48;
const DEFAULT_BATCH_SIZE = 100;
let queueTableEnsured = false;

function resolveCreatedAt(user: DbUser): number {
  if (user.created_at) {
    const parsed = new Date(user.created_at).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

async function executeAccountDeletion(userId: number): Promise<boolean> {
  try {
    const repository = new UserRepository();
    const deleted = await repository.deleteById(userId);
    if (deleted) {
      try {
        await publishAccountDeletionEvent(userId);
      } catch (error) {
        console.error("Account deletion notification error", error);
      }
    }
    return deleted;
  } catch (error) {
    console.error(`Account deletion failure for user ${userId}`, error);
    return false;
  }
}

async function ensureAccountDeletionQueueTable() {
  if (queueTableEnsured) {
    return;
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS account_deletion_queue (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        execute_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_account_deletion_queue_execute_at
      ON account_deletion_queue(execute_at)
    `;
    queueTableEnsured = true;
  } catch (error) {
    queueTableEnsured = false;
    console.error("Account deletion queue ensure error", error);
    throw error;
  }
}

async function persistScheduledDeletion(userId: number, executeAt: number) {
  const executeAtIso = new Date(executeAt).toISOString();
  await ensureAccountDeletionQueueTable();
  try {
    await sql`
      INSERT INTO account_deletion_queue (user_id, execute_at)
      VALUES (${userId}, ${executeAtIso})
      ON CONFLICT (user_id)
      DO UPDATE SET execute_at = EXCLUDED.execute_at
    `;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") {
      queueTableEnsured = false;
      await ensureAccountDeletionQueueTable();
      await sql`
        INSERT INTO account_deletion_queue (user_id, execute_at)
        VALUES (${userId}, ${executeAtIso})
        ON CONFLICT (user_id)
        DO UPDATE SET execute_at = EXCLUDED.execute_at
      `;
      return;
    }
    throw error;
  }
}

export async function queueEligibleAccountDeletions(): Promise<number> {
  try {
    await ensureAccountDeletionQueueTable();
    const result = await sql`
      SELECT cleanup_old_accounts() AS queued_count
    `;
    const value = result?.[0]?.queued_count;
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  } catch (error) {
    console.error("Account deletion queue enqueue error", error);
    return 0;
  }
}

export async function processDueAccountDeletions(
  limit: number = DEFAULT_BATCH_SIZE,
): Promise<number> {
  try {
    await ensureAccountDeletionQueueTable();
    const rows = (await sql`
      SELECT user_id
      FROM account_deletion_queue
      WHERE execute_at <= NOW()
      ORDER BY execute_at
      LIMIT ${limit}
    `) as Array<{ user_id: number }>;
    let processed = 0;
    for (const row of rows) {
      const userId = Number(row.user_id);
      if (!Number.isFinite(userId)) {
        continue;
      }
      const deleted = await executeAccountDeletion(userId);
      if (deleted) {
        await sql`
          DELETE FROM account_deletion_queue WHERE user_id = ${userId}
        `;
        processed += 1;
      }
    }
    return processed;
  } catch (error) {
    console.error("Account deletion queue processing error", error);
    return 0;
  }
}

export async function scheduleAccountDeletion(user: DbUser): Promise<void> {
  if (!user.id) {
    return;
  }

  const createdAt = resolveCreatedAt(user);
  const now = Date.now();
  const targetTime = createdAt + DELETION_DELAY_MS;
  const remaining = targetTime - now;

  if (remaining <= 0) {
    await executeAccountDeletion(user.id);
    return;
  }

  await persistScheduledDeletion(user.id, targetTime);
}
