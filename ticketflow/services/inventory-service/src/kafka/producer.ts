import { Kafka, type Producer } from "kafkajs";
import { config } from "../config";

export interface KafkaProducerHandle {
  publishSeatsLocked(bookingId: string, seatIds: string[]): Promise<void>;
  publishSeatsLockFailed(
    bookingId: string,
    reason: string,
    conflictingSeatIds: string[]
  ): Promise<void>;
}

let producer: Producer;

const kafka = new Kafka({
  clientId: "inventory-service-producer",
  brokers: config.kafka.brokers,
  retry: { initialRetryTime: 300, retries: 10 },
});

export async function startProducer(): Promise<KafkaProducerHandle> {
  producer = kafka.producer();
  await producer.connect();
  console.log("[Kafka Producer] Inventory service producer started");

  return {
    async publishSeatsLocked(bookingId: string, seatIds: string[]) {
      await producer.send({
        topic: "ticketflow.seats.locked",
        messages: [
          {
            key: bookingId,
            value: JSON.stringify({
              eventType: "seats.locked",
              bookingId,
              seatIds,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });
    },

    async publishSeatsLockFailed(
      bookingId: string,
      reason: string,
      conflictingSeatIds: string[]
    ) {
      await producer.send({
        topic: "ticketflow.seats.lock-failed",
        messages: [
          {
            key: bookingId,
            value: JSON.stringify({
              eventType: "seats.lock-failed",
              bookingId,
              reason,
              conflictingSeatIds,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });
    },
  };
}

export async function stopProducer() {
  if (producer) {
    await producer.disconnect();
    console.log("[Kafka Producer] Disconnected");
  }
}
