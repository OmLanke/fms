import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().datetime('Invalid date format'),
  price: z.number().positive('Price must be positive'),
  totalSeats: z.number().int().positive('Total seats must be a positive integer'),
  venueId: z.string().optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  venueCity: z.string().optional(),
  venueCountry: z.string().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
