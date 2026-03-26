import { inventoryService } from './inventory.service';
import { PrismaClient } from '../../../generated/client';
import { redisClient } from '../redis/client';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    seat: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma), SeatStatus: { AVAILABLE: 'AVAILABLE', LOCKED: 'LOCKED', RESERVED: 'RESERVED' } };
});

jest.mock('../redis/client', () => ({
  redisClient: {
    set: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn().mockReturnValue({
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  },
}));

const prisma = new PrismaClient() as unknown as {
  seat: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    createMany: jest.Mock;
    count: jest.Mock;
  };
};

const mockRedis = redisClient as unknown as {
  set: jest.Mock;
  del: jest.Mock;
  pipeline: jest.Mock;
};

describe('inventoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('lockSeats', () => {
    it('should successfully lock all seats', async () => {
      prisma.seat.findUnique.mockResolvedValue({ id: 'seat-1', status: 'AVAILABLE' });
      mockRedis.set.mockResolvedValue('OK');

      const result = await inventoryService.lockSeats(['seat-1'], 'booking-1', 300);
      expect(result.locked).toBe(true);
    });

    it('should return conflict if seat already locked in Redis', async () => {
      prisma.seat.findUnique.mockResolvedValue({ id: 'seat-1', status: 'AVAILABLE' });
      mockRedis.set.mockResolvedValue(null); // SETNX failed

      const result = await inventoryService.lockSeats(['seat-1'], 'booking-1', 300);
      expect(result.locked).toBe(false);
      expect(result.conflictingSeatIds).toContain('seat-1');
    });

    it('should rollback on partial failure', async () => {
      prisma.seat.findUnique
        .mockResolvedValueOnce({ id: 'seat-1', status: 'AVAILABLE' })
        .mockResolvedValueOnce({ id: 'seat-2', status: 'AVAILABLE' });
      mockRedis.set
        .mockResolvedValueOnce('OK')  // seat-1 succeeds
        .mockResolvedValueOnce(null); // seat-2 fails

      const result = await inventoryService.lockSeats(['seat-1', 'seat-2'], 'booking-1', 300);
      expect(result.locked).toBe(false);
      expect(mockRedis.pipeline).toHaveBeenCalled(); // rollback pipeline executed
    });

    it('should return conflict for RESERVED seat', async () => {
      prisma.seat.findUnique.mockResolvedValue({ id: 'seat-1', status: 'RESERVED' });

      const result = await inventoryService.lockSeats(['seat-1'], 'booking-1', 300);
      expect(result.locked).toBe(false);
    });
  });
});
