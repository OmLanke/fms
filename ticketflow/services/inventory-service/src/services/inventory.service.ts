import { PrismaClient } from '../../../generated/client';
import { redisClient } from '../redis/client';

// Mirror the Prisma enum locally so we can reference it before `prisma generate` runs
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
  createdAt: Date;
  updatedAt: Date;
}

const prisma = new PrismaClient();

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
    const seats = await prisma.seat.findMany({
      where: { eventId },
      orderBy: [{ row: 'asc' }, { seatNumber: 'asc' }],
    });
    return seats.map((s: SeatRow) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
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
      const seat = await prisma.seat.findUnique({ where: { id: seatId } });
      if (!seat) {
        conflicting.push(seatId);
        break;
      }
      if (seat.status === SeatStatus.RESERVED) {
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
    await prisma.seat.updateMany({
      where: { id: { in: seatIds }, status: SeatStatus.LOCKED },
      data: { status: SeatStatus.AVAILABLE },
    });
  },

  async confirmSeats(seatIds: string[]): Promise<void> {
    await prisma.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: SeatStatus.RESERVED },
    });
    const pipeline = redisClient.pipeline();
    for (const seatId of seatIds) {
      pipeline.del(lockKey(seatId));
    }
    await pipeline.exec();
  },

  async initSeatsForEvent(eventId: string, rows: string[], seatsPerRow: number): Promise<void> {
    const existingCount = await prisma.seat.count({ where: { eventId } });
    if (existingCount > 0) return;

    const seats = rows.flatMap((row) =>
      Array.from({ length: seatsPerRow }, (_, i) => ({
        eventId,
        row,
        seatNumber: String(i + 1),
        status: SeatStatus.AVAILABLE,
      }))
    );

    await prisma.seat.createMany({ data: seats });
  },
};
