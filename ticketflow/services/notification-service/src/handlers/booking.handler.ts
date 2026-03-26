import { BookingConfirmedPayload, PaymentFailedPayload } from '@ticketflow/shared';
import { mailer } from '../mailer';

export const bookingConfirmedHandler = {
  async handleConfirmed(payload: BookingConfirmedPayload): Promise<void> {
    console.log(`Sending booking confirmation email to user ${payload.userId} for booking ${payload.bookingId}`);

    const text = `
Dear Customer,

Your booking has been confirmed!

Booking ID: ${payload.bookingId}
Event: ${payload.eventName}
Seats: ${payload.seatIds.join(', ')}
Total Amount: $${payload.totalAmount.toFixed(2)}
Confirmed At: ${new Date(payload.confirmedAt).toLocaleString()}

Thank you for choosing TicketFlow!

Best regards,
The TicketFlow Team
    `.trim();

    await mailer.send({
      to: payload.userEmail,
      subject: `Booking Confirmed — ${payload.eventName}`,
      text,
    });
  },

  async handlePaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    console.log(`Sending payment failure email to user ${payload.userId} for booking ${payload.bookingId}`);

    const text = `
Dear Customer,

Unfortunately, we were unable to process your payment.

Booking ID: ${payload.bookingId}
Event: ${payload.eventName}
Seats: ${payload.seatIds.join(', ')}
Amount: $${payload.amount.toFixed(2)}
Failed At: ${new Date(payload.failedAt).toLocaleString()}
Reason: ${payload.reason}

Please try again or contact our support team.

Best regards,
The TicketFlow Team
    `.trim();

    await mailer.send({
      to: payload.userEmail,
      subject: `Payment Failed — ${payload.eventName}`,
      text,
    });
  },
};
