import { randomUUID } from 'crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { redisClient } from '../redis/client';
import { db } from '../db/client';
import { seats } from '../db/schema';

// Local status constants used by both Redis lock logic and database updates.
const SeatStatus = {
  AVAILABLE: 'AVAILABLE',
  LOCKED: 'LOCKED',
  RESERVED: 'RESERVED',
} as const;
type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];

interface SeatRow {
  id: string;
  eventId: string;
  seatNumber: string;
  row: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const LOCK_PREFIX = 'seat:lock:';

function lockKey(seatId: string): string {
  return `${LOCK_PREFIX}${seatId}`;
}

async function lockSeat(seatId: string, bookingId: string, ttl: number): Promise<boolean> {
  // SET key value EX ttl NX — atomically set only if key does not exist
  const result = await redisClient.set(lockKey(seatId), bookingId, 'EX', ttl, 'NX');
  return result === 'OK';
}

export const inventoryService = {
  async getSeatsByEvent(eventId: string) {
    const seatRows = await db.select().from(seats).where(eq(seats.eventId, eventId)).orderBy(asc(seats.row), asc(seats.seatNumber));
    return seatRows.map((s: SeatRow) => ({
      ...s,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    }));
  },

  async lockSeats(
    seatIds: string[],
    bookingId: string,
    ttl: number
  ): Promise<{ locked: boolean; conflictingSeatIds?: string[] }> {
    const lockedSoFar: string[] = [];
    const conflicting: string[] = [];

    for (const seatId of seatIds) {
      const seat = await db.select().from(seats).where(eq(seats.id, seatId)).limit(1);
      const currentSeat = seat[0];
      if (!currentSeat) {
        conflicting.push(seatId);
        break;
      }
      if (currentSeat.status === SeatStatus.RESERVED) {
        conflicting.push(seatId);
        break;
      }

      const acquired = await lockSeat(seatId, bookingId, ttl);
      if (!acquired) {
        conflicting.push(seatId);
        break;
      }
      lockedSoFar.push(seatId);
    }

    if (conflicting.length > 0) {
      if (lockedSoFar.length > 0) {
        const pipeline = redisClient.pipeline();
        for (const seatId of lockedSoFar) {
          pipeline.del(lockKey(seatId));
        }
        await pipeline.exec();
      }
      return { locked: false, conflictingSeatIds: conflicting };
    }

    return { locked: true };
  },

  async releaseSeats(seatIds: string[]): Promise<void> {
    const pipeline = redisClient.pipeline();
    for (const seatId of seatIds) {
      pipeline.del(lockKey(seatId));
    }
    await pipeline.exec();
    await db
      .update(seats)
      .set({ status: SeatStatus.AVAILABLE, updatedAt: new Date() })
      .where(and(inArray(seats.id, seatIds), eq(seats.status, SeatStatus.LOCKED)));
  },

  async confirmSeats(seatIds: string[]): Promise<void> {
    await db.update(seats).set({ status: SeatStatus.RESERVED, updatedAt: new Date() }).where(inArray(seats.id, seatIds));
    const pipeline = redisClient.pipeline();
    for (const seatId of seatIds) {
      pipeline.del(lockKey(seatId));
    }
    await pipeline.exec();
  },

  async initSeatsForEvent(eventId: string, rows: string[], seatsPerRow: number): Promise<void> {
    const existing = await db.select().from(seats).where(eq(seats.eventId, eventId)).limit(1);
    if (existing.length > 0) return;

    const seatRows = rows.flatMap((row) =>
      Array.from({ length: seatsPerRow }, (_, i) => ({
        eventId,
        row,
        seatNumber: String(i + 1),
        status: SeatStatus.AVAILABLE,
      }))
    );

    await db.insert(seats).values(
      seatRows.map((seat) => ({
        id: randomUUID(),
        ...seat,
      }))
    );
  },
};
