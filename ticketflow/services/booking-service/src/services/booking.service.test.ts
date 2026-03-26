import axios from 'axios';
import { bookingService } from './booking.service';
import { PrismaClient } from '../../../generated/client';
import { publisher } from '../messaging/publisher';

jest.mock('axios');
jest.mock('../messaging/publisher', () => ({
  publisher: { publish: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    booking: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const mockedAxios = jest.mocked(axios);
const prisma = new PrismaClient() as unknown as {
  booking: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
};

const mockBooking = (status: string) => ({
  id: 'booking-1',
  userId: 'user-1',
  eventId: 'event-1',
  status,
  totalAmount: { toString: () => '75.00' },
  items: [{ id: 'item-1', bookingId: 'booking-1', seatId: 'seat-1' }],
  createdAt: new Date(),
  updatedAt: new Date(),
});

process.env.JWT_SECRET = 'test-secret';

describe('bookingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create CONFIRMED booking on success', async () => {
      mockedAxios.get.mockResolvedValue({ data: { event: { id: 'event-1', name: 'Rock Night', price: 75 } } });
      mockedAxios.post
        .mockResolvedValueOnce({ data: { locked: true } }) // lock
        .mockResolvedValueOnce({ data: { payment: { status: 'SUCCESS' } } }) // payment
        .mockResolvedValueOnce({ data: { ok: true } }); // confirm
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);

      prisma.booking.create.mockResolvedValue(mockBooking('PENDING'));
      prisma.booking.update.mockResolvedValue(mockBooking('CONFIRMED'));

      const result = await bookingService.create({
        userId: 'user-1',
        userEmail: 'user@test.com',
        eventId: 'event-1',
        seatIds: ['seat-1'],
      });
      expect(result.status).toBe('CONFIRMED');
      expect(publisher.publish).toHaveBeenCalled();
    });

    it('should return 409 when seat locking fails', async () => {
      mockedAxios.get.mockResolvedValue({ data: { event: { id: 'event-1', name: 'Rock Night', price: 75 } } });
      const error = Object.assign(new Error('Seat locked'), {
        response: { status: 409, data: { error: { details: { conflictingSeatIds: ['seat-1'] } } } },
        isAxiosError: true,
      });
      mockedAxios.post.mockRejectedValue(error);
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      await expect(
        bookingService.create({ userId: 'user-1', userEmail: 'user@test.com', eventId: 'event-1', seatIds: ['seat-1'] })
      ).rejects.toMatchObject({ statusCode: 409, code: 'SEAT_LOCKED' });
    });

    it('should return 402 and release locks when payment fails', async () => {
      mockedAxios.get.mockResolvedValue({ data: { event: { id: 'event-1', name: 'Rock Night', price: 75 } } });
      const paymentError = Object.assign(new Error('Payment failed'), {
        response: { status: 402, data: { payment: { status: 'FAILED' } } },
        isAxiosError: true,
      });
      mockedAxios.post
        .mockResolvedValueOnce({ data: { locked: true } }) // lock succeeds
        .mockRejectedValueOnce(paymentError) // payment fails
        .mockResolvedValueOnce({ data: { ok: true } }); // release
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      prisma.booking.create.mockResolvedValue(mockBooking('PENDING'));
      prisma.booking.update.mockResolvedValue(mockBooking('FAILED'));

      await expect(
        bookingService.create({ userId: 'user-1', userEmail: 'user@test.com', eventId: 'event-1', seatIds: ['seat-1'] })
      ).rejects.toMatchObject({ statusCode: 402, code: 'PAYMENT_FAILED' });
    });
  });
});
