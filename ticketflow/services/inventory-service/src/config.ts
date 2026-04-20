export const config = {
  port: parseInt(process.env.PORT || "3004"),
  db: {
    url:
      process.env.INVENTORY_DB_URL ||
      "postgresql://postgres:postgres@localhost:5432/ticketflow_inventory",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    lockTtl: 300, // 5 minutes in seconds
  },
  kafka: {
    brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || "localhost:9092").split(","),
    groupId: "inventory-service",
  },
};
