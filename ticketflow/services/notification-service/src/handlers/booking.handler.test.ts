import { bookingConfirmedHandler } from './booking.handler';
import { mailer } from '../mailer';

jest.mock('../mailer', () => ({
  mailer: { send: jest.fn().mockResolvedValue(undefined) },
}));

const mockMailer = mailer as { send: jest.Mock };

describe('bookingConfirmedHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should send confirmation email', async () => {
    await bookingConfirmedHandler.handleConfirmed({
      bookingId: 'booking-1',
      userId: 'user-1',
      userEmail: 'test@example.com',
      eventId: 'event-1',
      eventName: 'Rock Night',
      seatIds: ['A1', 'A2'],
      totalAmount: 150,
      confirmedAt: new Date().toISOString(),
    });

    expect(mockMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Rock Night'),
      })
    );
  });

  it('should send payment failed email', async () => {
    await bookingConfirmedHandler.handlePaymentFailed({
      bookingId: 'booking-1',
      userId: 'user-1',
      userEmail: 'test@example.com',
      eventId: 'event-1',
      eventName: 'Rock Night',
      seatIds: ['A1'],
      amount: 75,
      failedAt: new Date().toISOString(),
      reason: 'Insufficient funds',
    });

    expect(mockMailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Payment Failed'),
      })
    );
  });
});
