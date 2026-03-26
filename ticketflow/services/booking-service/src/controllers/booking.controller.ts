import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../services/booking.service';
import { CreateBookingInput } from '../schemas/booking.schema';

export async function createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.sub;
    const userEmail = req.user!.email;
    const { eventId, seatIds } = req.body as CreateBookingInput;
    const booking = await bookingService.create({ userId, userEmail, eventId, seatIds });
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function getBookingById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const booking = await bookingService.getById(req.params.id, req.user!.sub);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function getMyBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bookings = await bookingService.getByUser(req.user!.sub);
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

export async function confirmBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const booking = await bookingService.confirm(req.params.id, req.user!.sub);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const booking = await bookingService.cancel(req.params.id, req.user!.sub);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
}
