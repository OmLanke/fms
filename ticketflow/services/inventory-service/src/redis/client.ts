import Redis from "ioredis";
import { config } from "../config";

export const redis = new Redis(config.redis.url, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => console.log("[Redis] Connected"));
redis.on("error", (err) => console.error("[Redis] Error:", err));

export const LOCK_PREFIX = "seat:lock:";

/**
 * Attempts to acquire an NX lock on a single seat.
 * Returns true if the lock was successfully acquired.
 */
export async function acquireSeatLock(
  seatId: string,
  bookingId: string,
  ttlSeconds: number
): Promise<boolean> {
  const key = `${LOCK_PREFIX}${seatId}`;
  const result = await redis.set(key, bookingId, "EX", ttlSeconds, "NX");
  return result === "OK";
}

/**
 * Releases the Redis lock for a single seat.
 */
export async function releaseSeatLock(seatId: string): Promise<void> {
  await redis.del(`${LOCK_PREFIX}${seatId}`);
}

/**
 * Releases Redis locks for multiple seats in a single DEL call.
 */
export async function releaseSeatLocks(seatIds: string[]): Promise<void> {
  if (seatIds.length === 0) return;
  const keys = seatIds.map((id) => `${LOCK_PREFIX}${id}`);
  await redis.del(...keys);
}
