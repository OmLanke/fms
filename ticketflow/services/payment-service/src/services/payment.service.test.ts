import { paymentService } from './payment.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const prisma = new PrismaClient() as unknown as {
  payment: { create: jest.Mock; findUnique: jest.Mock };
};

const mockPayment = (status: string) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: { toString: () => '75.00' },
  currency: 'USD',
  status,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('paymentService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create a payment and return SUCCESS with high success rate', async () => {
    process.env.PAYMENT_SUCCESS_RATE = '1.0';
    prisma.payment.create.mockResolvedValue(mockPayment('SUCCESS'));

    const payment = await paymentService.charge({ bookingId: 'booking-1', amount: 75, currency: 'USD' });
    expect(payment.status).toBe('SUCCESS');
  });

  it('should create a payment and return FAILED with zero success rate', async () => {
    process.env.PAYMENT_SUCCESS_RATE = '0.0';
    prisma.payment.create.mockResolvedValue(mockPayment('FAILED'));

    const payment = await paymentService.charge({ bookingId: 'booking-1', amount: 75, currency: 'USD' });
    expect(payment.status).toBe('FAILED');
  });

  it('should throw 404 when payment not found', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(paymentService.getById('none')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PAYMENT_NOT_FOUND',
    });
  });
});
