import { db } from "../db/client";
import { seats } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
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
 * Uses a Redis NX lock per seat plus a DB status update.
 */
export async function lockSeats(
  bookingId: string,
  seatIds: string[]
): Promise<{ success: boolean; conflictingSeatIds?: string[] }> {
  // Verify seats exist in DB and are AVAILABLE
  const dbSeats = await db.select().from(seats).where(inArray(seats.id, seatIds));

  if (dbSeats.length !== seatIds.length) {
    const foundIds = new Set(dbSeats.map((s) => s.id));
    const missing = seatIds.filter((id) => !foundIds.has(id));
    return { success: false, conflictingSeatIds: missing };
  }

  const unavailable = dbSeats.filter((s) => s.status !== "AVAILABLE");
  if (unavailable.length > 0) {
    return { success: false, conflictingSeatIds: unavailable.map((s) => s.id) };
  }

  // Acquire Redis locks one-by-one; roll back on first failure
  const lockedSoFar: string[] = [];
  for (const seatId of seatIds) {
    const acquired = await acquireSeatLock(seatId, bookingId, config.redis.lockTtl);
    if (!acquired) {
      await releaseSeatLocks(lockedSoFar);
      return { success: false, conflictingSeatIds: [seatId] };
    }
    lockedSoFar.push(seatId);
  }

  // Persist LOCKED status to DB
  await db
    .update(seats)
    .set({ status: "LOCKED", bookingId, updatedAt: new Date() })
    .where(inArray(seats.id, seatIds));

  return { success: true };
}

/**
 * Releases previously locked seats back to AVAILABLE.
 */
export async function releaseSeats(seatIds: string[]): Promise<void> {
  await releaseSeatLocks(seatIds);
  await db
    .update(seats)
    .set({ status: "AVAILABLE", bookingId: null, updatedAt: new Date() })
    .where(inArray(seats.id, seatIds));
}

/**
 * Confirms locked seats as RESERVED (payment completed).
 */
export async function confirmSeats(seatIds: string[]): Promise<void> {
  await releaseSeatLocks(seatIds); // Redis lock no longer needed
  await db
    .update(seats)
    .set({ status: "RESERVED", updatedAt: new Date() })
    .where(inArray(seats.id, seatIds));
}
