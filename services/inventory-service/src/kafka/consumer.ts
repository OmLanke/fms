import { Kafka, type Consumer } from "kafkajs";
import { config } from "../config";
import {
  lockSeats,
  releaseSeats,
  confirmSeats,
  createSeatsForEvent,
} from "../services/inventory.service";
import type { KafkaProducerHandle } from "./producer";

let consumer: Consumer;

const kafka = new Kafka({
  clientId: "inventory-service",
  brokers: config.kafka.brokers,
  retry: { initialRetryTime: 300, retries: 10 },
});

export async function startConsumer(producer: KafkaProducerHandle) {
  consumer = kafka.consumer({ groupId: config.kafka.groupId });

  await consumer.connect();
  await consumer.subscribe({
    topics: [
      "ticketflow.booking.initiated",
      "ticketflow.seats.confirm",
      "ticketflow.seats.release",
      "ticketflow.event.created",
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      let payload: Record<string, any>;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        console.error(`[Kafka] Failed to parse message from ${topic}:`, err);
        return;
      }

      console.log(`[Kafka] Received ${topic}:`, payload.eventType ?? "(no eventType)");

      try {
        switch (topic) {
          case "ticketflow.booking.initiated": {
            const { bookingId, seatIds } = payload as {
              bookingId: string;
              seatIds: string[];
            };

            if (!bookingId || !Array.isArray(seatIds) || seatIds.length === 0) {
              console.error("[Kafka] Invalid booking.initiated payload:", payload);
              return;
            }

            const result = await lockSeats(bookingId, seatIds);

            if (result.success) {
              await producer.publishSeatsLocked(bookingId, seatIds);
              console.log(
                `[Inventory] Locked ${seatIds.length} seats for booking ${bookingId}`
              );
            } else {
              await producer.publishSeatsLockFailed(
                bookingId,
                "SEATS_UNAVAILABLE",
                result.conflictingSeatIds ?? []
              );
              console.warn(
                `[Inventory] Failed to lock seats for booking ${bookingId}. Conflicting: ${result.conflictingSeatIds?.join(", ")}`
              );
            }
            break;
          }

          case "ticketflow.seats.confirm": {
            const { seatIds } = payload as { seatIds: string[] };
            if (!Array.isArray(seatIds)) {
              console.error("[Kafka] Invalid seats.confirm payload:", payload);
              return;
            }
            await confirmSeats(seatIds);
            console.log(`[Inventory] Confirmed ${seatIds.length} seats`);
            break;
          }

          case "ticketflow.seats.release": {
            const { seatIds } = payload as { seatIds: string[] };
            if (!Array.isArray(seatIds)) {
              console.error("[Kafka] Invalid seats.release payload:", payload);
              return;
            }
            await releaseSeats(seatIds);
            console.log(`[Inventory] Released ${seatIds.length} seats`);
            break;
          }

          case "ticketflow.event.created": {
            const { eventId, totalSeats } = payload as {
              eventId: string;
              totalSeats: number;
            };
            if (!eventId || typeof totalSeats !== "number") {
              console.error("[Kafka] Invalid event.created payload:", payload);
              return;
            }
            await createSeatsForEvent(eventId, totalSeats);
            console.log(
              `[Inventory] Created ${totalSeats} seats for event ${eventId}`
            );
            break;
          }

          default:
            console.warn(`[Kafka] Unhandled topic: ${topic}`);
        }
      } catch (err) {
        console.error(`[Kafka] Error processing message from ${topic}:`, err);
      }
    },
  });

  console.log("[Kafka Consumer] Inventory service consumer started");
}

export async function stopConsumer() {
  if (consumer) {
    await consumer.disconnect();
    console.log("[Kafka Consumer] Disconnected");
  }
}
