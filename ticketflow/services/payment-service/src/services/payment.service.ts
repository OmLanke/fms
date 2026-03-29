import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { AppError } from '@ticketflow/shared';
import { ChargeInput } from '../schemas/payment.schema';
import { db } from '../db/client';
import { payments } from '../db/schema';

function getSuccessRate(): number {
  const rate = parseFloat(process.env.PAYMENT_SUCCESS_RATE ?? '0.95');
  return isNaN(rate) ? 0.95 : Math.min(1, Math.max(0, rate));
}

function serializePayment(payment: {
  id: string;
  bookingId: string;
  amount: { toString(): string } | string;
  currency: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    amount: parseFloat(payment.amount.toString()),
    currency: payment.currency,
    status: payment.status,
    createdAt: new Date(payment.createdAt).toISOString(),
    updatedAt: new Date(payment.updatedAt).toISOString(),
  };
}

export const paymentService = {
  async charge(input: ChargeInput) {
    const successRate = getSuccessRate();
    const succeeded = Math.random() < successRate;
    const status = succeeded ? 'SUCCESS' : ('FAILED' as const);

    const inserted = await db
      .insert(payments)
      .values({
        id: randomUUID(),
        bookingId: input.bookingId,
        amount: input.amount.toString(),
        currency: input.currency ?? 'USD',
        status,
      })
      .returning();
    const payment = inserted[0];

    return serializePayment(payment);
  },

  async getById(id: string) {
    const found = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    const payment = found[0];
    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }
    return serializePayment(payment);
  },
};
