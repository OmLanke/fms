import { z } from 'zod';

export const chargeSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).optional().default('USD'),
});

export type ChargeInput = z.infer<typeof chargeSchema>;
