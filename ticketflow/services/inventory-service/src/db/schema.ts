import { pgTable, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";

export const seatStatusEnum = pgEnum("seat_status", ["AVAILABLE", "LOCKED", "RESERVED"]);

export const seats = pgTable(
  "seats",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    seatNumber: text("seat_number").notNull(),
    row: text("row").notNull(),
    section: text("section").default("GENERAL"),
    status: seatStatusEnum("status").default("AVAILABLE").notNull(),
    bookingId: text("booking_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSeat: unique().on(table.eventId, table.row, table.seatNumber),
  })
);

export type Seat = typeof seats.$inferSelect;
export type NewSeat = typeof seats.$inferInsert;
