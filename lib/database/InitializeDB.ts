import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(process.env.DATABASE_URL);

export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export async function initializeDatabase() {
  try {
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'friendships', 'messages')
    `;

    const existingTables = result.map((row) => row.table_name);
    const requiredTables = ["users", "friendships", "messages"];
    const missingTables = requiredTables.filter(
      (table) => !existingTables.includes(table),
    );

    if (missingTables.length > 0) {
      console.warn(`Missing tables: ${missingTables.join(", ")}`);
      return false;
    }

    console.log("Database schema is properly initialized");
    return true;
  } catch (error) {
    throw new DatabaseError(
      "Failed to check database initialization",
      error as Error,
    );
  }
}

export async function testConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    return result.length === 1 && result[0].test === 1;
  } catch (error) {
    throw new DatabaseError("Database connection test failed", error as Error);
  }
}

export function generateUserId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(8);
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
