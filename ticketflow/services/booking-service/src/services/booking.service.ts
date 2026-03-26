import axios from 'axios';
import { PrismaClient } from '../../../generated/client';
import { AppError, Events, BookingConfirmedPayload } from '@ticketflow/shared';
import { publisher } from '../messaging/publisher';

const prisma = new PrismaClient();

const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:3004';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3005';
const EVENT_URL = process.env.EVENT_SERVICE_URL ?? 'http://localhost:3002';

interface CreateBookingArgs {
  userId: string;
  userEmail: string;
  eventId: string;
  seatIds: string[];
}

function serializeBooking(booking: {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  totalAmount: { toString(): string };
  items: Array<{ id: string; bookingId: string; seatId: string }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: booking.id,
    userId: booking.userId,
    eventId: booking.eventId,
    status: booking.status,
    totalAmount: parseFloat(booking.totalAmount.toString()),
    items: booking.items,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

export const bookingService = {
  async create(args: CreateBookingArgs) {
    const { userId, userEmail, eventId, seatIds } = args;

    // Step 2: Check event exists
    let event: { id: string; name: string; price: number };
    try {
      const response = await axios.get<{ event: { id: string; name: string; price: number } }>(
        `${EVENT_URL}/api/events/${eventId}`
      );
      event = response.data.event;
    } catch {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    // Step 3: Attempt seat locks
    const tempBookingId = `temp-${userId}-${Date.now()}`;
    try {
      const lockResponse = await axios.post<{ locked: boolean }>(
        `${INVENTORY_URL}/api/inventory/lock`,
        {
          seatIds,
          bookingId: tempBookingId,
          ttlSeconds: 300,
        }
      );
      if (!lockResponse.data.locked) {
        throw new AppError(409, 'SEAT_LOCKED', 'One or more seats are unavailable');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        throw new AppError(409, 'SEAT_LOCKED', 'One or more seats are unavailable', {
          conflictingSeatIds:
            (err.response.data as { error?: { details?: { conflictingSeatIds?: string[] } } })
              ?.error?.details?.conflictingSeatIds ?? seatIds,
        });
      }
      throw new AppError(503, 'INVENTORY_UNAVAILABLE', 'Inventory service unavailable');
    }

    // Step 4: Create PENDING booking record
    const totalAmount = event.price * seatIds.length;
    const booking = await prisma.booking.create({
      data: {
        userId,
        eventId,
        status: 'PENDING',
        totalAmount,
        items: {
          create: seatIds.map((seatId) => ({ seatId })),
        },
      },
      include: { items: true },
    });

    // Step 5: Call Payment Service
    let paymentSuccess = false;
    try {
      const paymentResponse = await axios.post<{ payment: { status: string } }>(
        `${PAYMENT_URL}/api/payments/charge`,
        {
          bookingId: booking.id,
          amount: totalAmount,
          currency: 'USD',
        }
      );
      paymentSuccess = paymentResponse.data.payment.status === 'SUCCESS';
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 402) {
        paymentSuccess = false;
      } else {
        await axios.post(`${INVENTORY_URL}/api/inventory/release`, { seatIds }).catch(() => null);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'FAILED' },
        });
        throw new AppError(503, 'PAYMENT_SERVICE_UNAVAILABLE', 'Payment service unavailable');
      }
    }

    if (!paymentSuccess) {
      // Release seat locks and mark booking FAILED
      await axios.post(`${INVENTORY_URL}/api/inventory/release`, { seatIds }).catch(() => null);
      const failedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'FAILED' },
        include: { items: true },
      });
      throw new AppError(402, 'PAYMENT_FAILED', 'Payment was declined', {
        bookingId: failedBooking.id,
      });
    }

    // Step 6: Confirm seat reservation
    await axios.post(`${INVENTORY_URL}/api/inventory/confirm`, { seatIds }).catch(() => null);

    // Step 7: Mark booking CONFIRMED
    const confirmedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED' },
      include: { items: true },
    });

    // Step 8: Publish BOOKING_CONFIRMED event to RabbitMQ (fire-and-forget, non-blocking)
    const payload: BookingConfirmedPayload = {
      bookingId: confirmedBooking.id,
      userId,
      userEmail,
      eventId,
      eventName: event.name,
      seatIds,
      totalAmount,
      confirmedAt: confirmedBooking.updatedAt.toISOString(),
    };
    publisher.publish(Events.BOOKING_CONFIRMED, payload).catch((publishErr) => {
      console.error('Failed to publish BOOKING_CONFIRMED event:', publishErr);
    });

    return serializeBooking(confirmedBooking);
  },

  async getById(id: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (booking.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
    return serializeBooking(booking);
  },

  async getByUser(userId: string) {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map(serializeBooking);
  },

  async confirm(id: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (booking.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
    if (booking.status !== 'PENDING') {
      throw new AppError(400, 'INVALID_STATUS', `Cannot confirm a booking in ${booking.status} status`);
    }
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { items: true },
    });
    return serializeBooking(updated);
  },

  async cancel(id: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (booking.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
    if (booking.status === 'CANCELLED') {
      throw new AppError(400, 'ALREADY_CANCELLED', 'Booking is already cancelled');
    }
    const seatIds = booking.items.map((item) => item.seatId);
    await axios.post(`${INVENTORY_URL}/api/inventory/release`, { seatIds }).catch(() => null);
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });
    return serializeBooking(updated);
  },
};
