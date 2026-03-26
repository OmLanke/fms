import amqplib, { Channel, ChannelModel } from 'amqplib';
import { EventName, RabbitMQMessage } from '@ticketflow/shared';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'ticketflow';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

async function getChannel(): Promise<Channel> {
  if (channel) return channel;

  connection = await amqplib.connect(RABBITMQ_URL);
  const ch = await connection.createChannel();
  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  channel = ch;

  connection.on('error', (err: Error) => {
    console.error('RabbitMQ connection error:', err.message);
    connection = null;
    channel = null;
  });

  connection.on('close', () => {
    console.warn('RabbitMQ connection closed');
    connection = null;
    channel = null;
  });

  return channel;
}

export const publisher = {
  async publish<T>(event: EventName, payload: T): Promise<void> {
    const ch = await getChannel();
    const message: RabbitMQMessage<T> = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    const content = Buffer.from(JSON.stringify(message));
    ch.publish(EXCHANGE_NAME, event, content, { persistent: true });
  },

  async close(): Promise<void> {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
  },
};
