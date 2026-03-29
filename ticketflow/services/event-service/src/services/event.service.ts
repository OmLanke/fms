import { randomUUID } from 'crypto';
import { asc, eq } from 'drizzle-orm';
import { AppError } from '@ticketflow/shared';
import { CreateEventInput, UpdateEventInput } from '../schemas/event.schema';
import { db } from '../db/client';
import { events, venues } from '../db/schema';

function serializeEvent(event: {
  id: string;
  name: string;
  description: string;
  venueId: string;
  venue?: { id: string; name: string; address: string; city: string; country: string; capacity: number; createdAt: Date | string; updatedAt: Date | string };
  date: Date | string;
  price: { toString(): string } | string;
  totalSeats: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    venueId: event.venueId,
    venue: event.venue
      ? {
          ...event.venue,
          createdAt: new Date(event.venue.createdAt).toISOString(),
          updatedAt: new Date(event.venue.updatedAt).toISOString(),
        }
      : undefined,
    date: new Date(event.date).toISOString(),
    price: parseFloat(event.price.toString()),
    totalSeats: event.totalSeats,
    createdAt: new Date(event.createdAt).toISOString(),
    updatedAt: new Date(event.updatedAt).toISOString(),
  };
}

export const eventService = {
  async getAll() {
    const rows = await db
      .select({ event: events, venue: venues })
      .from(events)
      .leftJoin(venues, eq(events.venueId, venues.id))
      .orderBy(asc(events.date));
    return rows.map(({ event, venue }) => serializeEvent({ ...event, venue: venue ?? undefined }));
  },

  async getById(id: string) {
    const row = await db
      .select({ event: events, venue: venues })
      .from(events)
      .leftJoin(venues, eq(events.venueId, venues.id))
      .where(eq(events.id, id))
      .limit(1);
    if (row.length === 0) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }
    return serializeEvent({ ...row[0].event, venue: row[0].venue ?? undefined });
  },

  async create(input: CreateEventInput) {
    if (!input.venueId && !input.venueName) {
      throw new AppError(400, 'VENUE_REQUIRED', 'Provide venueId to link an existing venue, or venueName/venueAddress/venueCity/venueCountry to create one');
    }

    let venueId = input.venueId;

    if (!venueId) {
      const createdVenue = await db
        .insert(venues)
        .values({
          id: randomUUID(),
          name: input.venueName ?? '',
          address: input.venueAddress ?? '',
          city: input.venueCity ?? '',
          country: input.venueCountry ?? '',
          capacity: input.totalSeats,
        })
        .returning();
      venueId = createdVenue[0].id;
    }

    const createdEvent = await db
      .insert(events)
      .values({
        id: randomUUID(),
        name: input.name,
        description: input.description,
        date: new Date(input.date),
        price: input.price.toString(),
        totalSeats: input.totalSeats,
        venueId,
      })
      .returning();

    const venueRows = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    return serializeEvent({ ...createdEvent[0], venue: venueRows[0] });
  },

  async update(id: string, input: UpdateEventInput) {
    const existing = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (existing.length === 0) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const patched = await db
      .update(events)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
        ...(input.price !== undefined ? { price: input.price.toString() } : {}),
        ...(input.totalSeats !== undefined ? { totalSeats: input.totalSeats } : {}),
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();

    const venueRows = await db.select().from(venues).where(eq(venues.id, patched[0].venueId)).limit(1);
    return serializeEvent({ ...patched[0], venue: venueRows[0] });
  },
};
