import { z } from 'zod';

export const createBookingSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  seatIds: z.array(z.string()).min(1, 'At least one seat must be selected'),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
