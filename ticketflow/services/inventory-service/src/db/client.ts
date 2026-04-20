import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

const queryClient = postgres(config.db.url);
export const db = drizzle(queryClient, { schema });

export async function createTableIfNotExists() {
  // Create enum type first — ignore error if it already exists
  await queryClient`
    DO $$ BEGIN
      CREATE TYPE seat_status AS ENUM ('AVAILABLE', 'LOCKED', 'RESERVED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  await queryClient`
    CREATE TABLE IF NOT EXISTS seats (
      id          TEXT PRIMARY KEY,
      event_id    TEXT NOT NULL,
      seat_number TEXT NOT NULL,
      row         TEXT NOT NULL,
      section     TEXT DEFAULT 'GENERAL',
      status      seat_status DEFAULT 'AVAILABLE' NOT NULL,
      booking_id  TEXT,
      created_at  TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at  TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE (event_id, row, seat_number)
    )
  `;
}
