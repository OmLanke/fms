import { PrismaClient } from '../../../generated/client';
import { AppError } from '@ticketflow/shared';
import { ChargeInput } from '../schemas/payment.schema';

const prisma = new PrismaClient();

function getSuccessRate(): number {
  const rate = parseFloat(process.env.PAYMENT_SUCCESS_RATE ?? '0.95');
  return isNaN(rate) ? 0.95 : Math.min(1, Math.max(0, rate));
}

function serializePayment(payment: {
  id: string;
  bookingId: string;
  amount: { toString(): string };
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    amount: parseFloat(payment.amount.toString()),
    currency: payment.currency,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export const paymentService = {
  async charge(input: ChargeInput) {
    const successRate = getSuccessRate();
    const succeeded = Math.random() < successRate;
    const status = succeeded ? 'SUCCESS' : ('FAILED' as const);

    const payment = await prisma.payment.create({
      data: {
        bookingId: input.bookingId,
        amount: input.amount,
        currency: input.currency ?? 'USD',
        status,
      },
    });

    return serializePayment(payment);
  },

  async getById(id: string) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }
    return serializePayment(payment);
  },
};
