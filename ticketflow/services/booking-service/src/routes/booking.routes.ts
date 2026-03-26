import { Router } from 'express';
import { requireAuth, validate } from '@ticketflow/shared';
import {
  createBooking,
  getBookingById,
  getMyBookings,
  confirmBooking,
  cancelBooking,
} from '../controllers/booking.controller';
import { createBookingSchema } from '../schemas/booking.schema';

export const bookingRouter = Router();

bookingRouter.post('/', requireAuth, validate(createBookingSchema), createBooking);
bookingRouter.get('/my', requireAuth, getMyBookings);
bookingRouter.get('/:id', requireAuth, getBookingById);
bookingRouter.post('/:id/confirm', requireAuth, confirmBooking);
bookingRouter.post('/:id/cancel', requireAuth, cancelBooking);
