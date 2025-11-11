const CHANNEL_PREFIX = "user:lifecycle:";

export type AccountLifecycleEvent = {
  type: "account_deleted";
  userId: number;
  deletedAt: string;
};

export function userLifecycleChannel(userId: number): string {
  return `${CHANNEL_PREFIX}${userId}`;
}
