import { db } from "../db/client";
import { seats } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { acquireSeatLock, releaseSeatLocks } from "../redis/client";
import { config } from "../config";
import crypto from "crypto";

export async function getSeatsByEvent(eventId: string) {
  return db.select().from(seats).where(eq(seats.eventId, eventId));
}

/**
 * Venue layout definition: sections with rows and seat counts.
 */
const VENUE_LAYOUT = [
  { section: "VIP",      rows: ["A", "B"],           seatsPerRow: 10 },
  { section: "FLOOR",    rows: ["C", "D", "E", "F"], seatsPerRow: 15 },
  { section: "BALCONY",  rows: ["G", "H", "I"],      seatsPerRow: 12 },
];

/**
 * Bulk-creates seats for a newly created event using a fixed venue layout.
 * Sections: VIP (rows A–B, 10 seats), FLOOR (rows C–F, 15 seats), BALCONY (rows G–I, 12 seats).
 * Total capacity: 20 + 60 + 36 = 116 seats (capped at totalSeats).
 */
export async function createSeatsForEvent(
  eventId: string,
  totalSeats: number,
  _rows = 5
) {
  const newSeats: {
    id: string;
    eventId: string;
    row: string;
    seatNumber: string;
    section: string;
    status: "AVAILABLE";
  }[] = [];

  for (const { section, rows, seatsPerRow } of VENUE_LAYOUT) {
    for (const row of rows) {
      for (let s = 1; s <= seatsPerRow; s++) {
        if (newSeats.length >= totalSeats) break;
        newSeats.push({
          id: crypto.randomUUID(),
          eventId,
          row,
          seatNumber: s.toString(),
          section,
          status: "AVAILABLE",
        });
      }
      if (newSeats.length >= totalSeats) break;
    }
    if (newSeats.length >= totalSeats) break;
  }

  await db.insert(seats).values(newSeats).onConflictDoNothing();
  return newSeats;
}

/**
 * Attempts to lock the requested seats for a booking.
 *
 * Uses a Postgres transaction with SELECT FOR UPDATE SKIP LOCKED to atomically
 * claim available seats at the DB level, eliminating the TOCTOU race that allowed
 * two concurrent booking.initiated messages (from different Kafka partitions) to
 * both see AVAILABLE before either committed a LOCKED status update.
 *
 * Redis NX locks are still acquired inside the transaction for TTL-based expiry:
 * if payment times out the lock TTL releases the seats even if the saga stalls.
 */
export async function lockSeats(
  bookingId: string,
  seatIds: string[]
): Promise<{ success: boolean; conflictingSeatIds?: string[] }> {
  return db.transaction(async (tx) => {
    // SELECT FOR UPDATE SKIP LOCKED: rows already locked by a concurrent transaction
    // are skipped rather than blocking, so we get an immediate result.
    const availableSeats = await tx
      .select()
      .from(seats)
      .where(and(inArray(seats.id, seatIds), eq(seats.status, "AVAILABLE")))
      .for("update", { skipLocked: true });

    // If we got fewer rows than requested, some seats are unavailable or
    // are currently being locked by another concurrent transaction.
    if (availableSeats.length !== seatIds.length) {
      const foundIds = new Set(availableSeats.map((s) => s.id));
      const conflicting = seatIds.filter((id) => !foundIds.has(id));
      return { success: false, conflictingSeatIds: conflicting };
    }

    // Acquire Redis NX locks for TTL-based expiry (payment timeout protection).
    // Roll back all Redis locks on first failure.
    const lockedSoFar: string[] = [];
    for (const seatId of seatIds) {
      const acquired = await acquireSeatLock(seatId, bookingId, config.redis.lockTtl);
      if (!acquired) {
        await releaseSeatLocks(lockedSoFar);
        return { success: false, conflictingSeatIds: [seatId] };
      }
      lockedSoFar.push(seatId);
    }

    // Persist LOCKED status within the same transaction (row locks held until commit).
    await tx
      .update(seats)
      .set({ status: "LOCKED", bookingId, updatedAt: new Date() })
      .where(inArray(seats.id, seatIds));

    return { success: true };
  });
}

/**
 * Releases previously locked seats back to AVAILABLE.
 * Only transitions seats still owned by this bookingId to prevent a stale
 * saga release from clobbering seats already re-locked by a new booking.
 */
export async function releaseSeats(bookingId: string, seatIds: string[]): Promise<void> {
  await releaseSeatLocks(seatIds);
  await db
    .update(seats)
    .set({ status: "AVAILABLE", bookingId: null, updatedAt: new Date() })
    .where(and(inArray(seats.id, seatIds), eq(seats.bookingId, bookingId)));
}

/**
 * Confirms locked seats as RESERVED (payment completed).
 * Only transitions seats that are still LOCKED under this specific bookingId
 * to guard against a stale saga event acting on seats re-acquired by another booking.
 */
export async function confirmSeats(bookingId: string, seatIds: string[]): Promise<void> {
  await releaseSeatLocks(seatIds); // Redis lock no longer needed
  await db
    .update(seats)
    .set({ status: "RESERVED", updatedAt: new Date() })
    .where(and(inArray(seats.id, seatIds), eq(seats.bookingId, bookingId)));
}
