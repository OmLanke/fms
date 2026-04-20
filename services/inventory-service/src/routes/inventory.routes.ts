import Elysia from "elysia";
import { getSeatsByEvent } from "../services/inventory.service";

export const inventoryRoutes = new Elysia()
  // List all seats for an event
  .get("/api/inventory/events/:eventId/seats", async ({ params, set }) => {
    try {
      const seatList = await getSeatsByEvent(params.eventId);
      return { seats: seatList, total: seatList.length };
    } catch (err) {
      console.error("[Route] GET seats error:", err);
      set.status = 500;
      return {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch seats",
        },
      };
    }
  })

  // Health check
  .get("/health", () => ({
    status: "up",
    service: "inventory-service",
    timestamp: new Date().toISOString(),
  }));
