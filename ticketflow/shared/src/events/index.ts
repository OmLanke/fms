export const Events = {
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  NOTIFY_SEND: 'notify.send',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface BookingConfirmedPayload {
  bookingId: string;
  userId: string;
  userEmail: string;
  eventId: string;
  eventName: string;
  seatIds: string[];
  totalAmount: number;
  confirmedAt: string;
}

export interface PaymentFailedPayload {
  bookingId: string;
  userId: string;
  userEmail: string;
  eventId: string;
  eventName: string;
  seatIds: string[];
  amount: number;
  failedAt: string;
  reason: string;
}

export interface RabbitMQMessage<T = unknown> {
  event: EventName;
  payload: T;
  timestamp: string;
}
