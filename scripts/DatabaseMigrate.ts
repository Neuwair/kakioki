import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

async function migrate() {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    DELETE FROM account_deletion_queue AS queue
    USING users
    WHERE users.id = queue.user_id
      AND users.is_default = TRUE
  `;

  await sql`
    CREATE OR REPLACE FUNCTION cleanup_old_accounts()
    RETURNS INTEGER AS $$
    DECLARE
      queued_count INTEGER;
    BEGIN
      DELETE FROM account_deletion_queue AS queue
      USING users
      WHERE users.id = queue.user_id
        AND users.is_default = TRUE;

      INSERT INTO account_deletion_queue (user_id, execute_at)
      SELECT id, CURRENT_TIMESTAMP
      FROM users
      WHERE is_default = FALSE
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '2 days'
      ON CONFLICT (user_id) DO NOTHING;

      GET DIAGNOSTICS queued_count = ROW_COUNT;
      RETURN queued_count;
    END;
    $$ LANGUAGE plpgsql
  `;

  console.log("Database migration completed successfully");
}

migrate().catch((error: unknown) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
