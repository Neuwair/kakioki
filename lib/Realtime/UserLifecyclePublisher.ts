import { getAblyRest } from "@/lib/Realtime/AblyServer";
import {
  userLifecycleChannel,
  type AccountLifecycleEvent,
} from "@/lib/Realtime/UserLifecycleEvents";

export async function publishAccountDeletionEvent(
  userId: number
): Promise<void> {
  const rest = getAblyRest();
  const channel = rest.channels.get(userLifecycleChannel(userId));
  await channel.publish("account_deleted", {
    type: "account_deleted",
    userId,
    deletedAt: new Date().toISOString(),
  } satisfies AccountLifecycleEvent);
}
