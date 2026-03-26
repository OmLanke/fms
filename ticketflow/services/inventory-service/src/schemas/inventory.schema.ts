import { z } from 'zod';

export const lockSeatsSchema = z.object({
  seatIds: z.array(z.string()).min(1, 'At least one seat ID is required'),
  bookingId: z.string().min(1, 'Booking ID is required'),
  ttlSeconds: z.number().int().positive().optional(),
});

export const releaseSeatsSchema = z.object({
  seatIds: z.array(z.string()).min(1, 'At least one seat ID is required'),
});

export const confirmSeatsSchema = z.object({
  seatIds: z.array(z.string()).min(1, 'At least one seat ID is required'),
});

export type LockSeatsInput = z.infer<typeof lockSeatsSchema>;
export type ReleaseSeatsInput = z.infer<typeof releaseSeatsSchema>;
export type ConfirmSeatsInput = z.infer<typeof confirmSeatsSchema>;
