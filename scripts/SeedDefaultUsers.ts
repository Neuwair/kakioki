import { loadEnvConfig } from "@next/env";

async function seed() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const { seedDefaultUsers } = await import("@/lib/server/DefaultUsers");
  const users = await seedDefaultUsers();
  console.log(
    `Seeded ${users.length} default users: ${users.map((user) => user.username).join(", ")}`,
  );
}

seed().catch((error: unknown) => {
  console.error("Default user seeding failed:", error);
  process.exitCode = 1;
});
