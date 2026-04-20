import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import { createTableIfNotExists } from "./db/client";
import { startProducer, stopProducer } from "./kafka/producer";
import { startConsumer, stopConsumer } from "./kafka/consumer";
import { inventoryRoutes } from "./routes/inventory.routes";

const app = new Elysia().use(cors()).use(inventoryRoutes);

async function main() {
  console.log("[Inventory Service] Starting...");

  // Initialize DB schema
  await createTableIfNotExists();
  console.log("[DB] Tables ready");

  // Start Kafka producer first — consumer needs the producer handle to publish results
  const kafkaProducer = await startProducer();
  await startConsumer(kafkaProducer);

  // Start HTTP server
  app.listen(config.port, () => {
    console.log(`[Inventory Service] HTTP server running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error("[Inventory Service] Fatal startup error:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("[Inventory Service] Shutting down gracefully...");
  await stopConsumer();
  await stopProducer();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Inventory Service] Interrupted, shutting down...");
  await stopConsumer();
  await stopProducer();
  process.exit(0);
});
