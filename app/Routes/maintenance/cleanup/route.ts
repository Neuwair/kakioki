import { NextResponse } from "next/server";
import {
  processDueAccountDeletions,
  queueEligibleAccountDeletions,
} from "@/lib/Service/AccountDeletionScheduler";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    console.error("Cleanup route misconfigured: missing CRON_SECRET");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queuedCount = await queueEligibleAccountDeletions();
    const deletedCount = await processDueAccountDeletions();
    return NextResponse.json({ success: true, queuedCount, deletedCount });
  } catch (error) {
    console.error("Cleanup execution error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
