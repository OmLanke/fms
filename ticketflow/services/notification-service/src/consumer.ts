import amqplib, { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { Events, RabbitMQMessage, BookingConfirmedPayload, PaymentFailedPayload } from '@ticketflow/shared';
import { bookingConfirmedHandler } from './handlers/booking.handler';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'ticketflow';
const QUEUE_NAME = 'notifications';

const RECONNECT_DELAY_MS = 5000;

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

async function setup(): Promise<void> {
  const conn = await amqplib.connect(RABBITMQ_URL);
  connection = conn;

  const ch = await conn.createChannel();
  channel = ch;

  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  await ch.assertQueue(QUEUE_NAME, { durable: true });

  await ch.bindQueue(QUEUE_NAME, EXCHANGE_NAME, Events.BOOKING_CONFIRMED);
  await ch.bindQueue(QUEUE_NAME, EXCHANGE_NAME, Events.PAYMENT_FAILED);

  ch.prefetch(1);

  await ch.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    try {
      const raw = JSON.parse(msg.content.toString()) as RabbitMQMessage;

      if (raw.event === Events.BOOKING_CONFIRMED) {
        await bookingConfirmedHandler.handleConfirmed(raw.payload as BookingConfirmedPayload);
      } else if (raw.event === Events.PAYMENT_FAILED) {
        await bookingConfirmedHandler.handlePaymentFailed(raw.payload as PaymentFailedPayload);
      } else {
        console.warn('Unknown event type:', raw.event);
      }

      ch.ack(msg);
    } catch (err) {
      console.error('Error processing message:', err);
      ch.nack(msg, false, false); // dead-letter, don't requeue
    }
  });

  console.log(`Notification consumer listening on queue: ${QUEUE_NAME}`);

  conn.on('error', (err: Error) => {
    console.error('RabbitMQ connection error:', err.message);
    scheduleReconnect();
  });

  conn.on('close', () => {
    console.warn('RabbitMQ connection closed, reconnecting...');
    scheduleReconnect();
  });
}

function scheduleReconnect(): void {
  connection = null;
  channel = null;
  setTimeout(() => {
    setup().catch((err) => {
      console.error('Reconnect failed:', err.message);
      scheduleReconnect();
    });
  }, RECONNECT_DELAY_MS);
}

export const consumer = {
  async start(): Promise<void> {
    await setup();
  },
};
