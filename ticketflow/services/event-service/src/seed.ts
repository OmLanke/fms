import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { events, venues } from './db/schema';

async function upsertVenue(data: {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
}) {
  const existing = await db.select().from(venues).where(eq(venues.id, data.id)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const created = await db.insert(venues).values(data).returning();
  return created[0];
}

async function upsertEvent(data: {
  id: string;
  name: string;
  description: string;
  venueId: string;
  date: Date;
  price: string;
  totalSeats: number;
}) {
  const existing = await db.select().from(events).where(eq(events.id, data.id)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const created = await db.insert(events).values(data).returning();
  return created[0];
}

const ROWS = ['A', 'B', 'C', 'D', 'E'];
const SEATS_PER_ROW = 10;

async function seed() {
  console.log('Seeding event service database...');

  const venue1 = await upsertVenue({
    id: 'venue-1',
    name: 'Madison Square Garden',
    address: '4 Pennsylvania Plaza',
    city: 'New York',
    country: 'US',
    capacity: 20000,
  });

  const venue2 = await upsertVenue({
    id: 'venue-2',
    name: 'The O2 Arena',
    address: 'Peninsula Square',
    city: 'London',
    country: 'UK',
    capacity: 20000,
  });

  const venue3 = await upsertVenue({
    id: 'venue-3',
    name: 'Sydney Opera House',
    address: 'Bennelong Point',
    city: 'Sydney',
    country: 'AU',
    capacity: 5000,
  });

  const totalSeats = ROWS.length * SEATS_PER_ROW;

  const event1 = await upsertEvent({
    id: 'event-1',
    name: 'Rock Night Live',
    description: 'An epic night of rock music featuring top bands from around the world.',
    venueId: venue1.id,
    date: new Date('2025-06-15T20:00:00Z'),
    price: '75.00',
    totalSeats,
  });

  const event2 = await upsertEvent({
    id: 'event-2',
    name: 'Jazz & Blues Festival',
    description: 'Two days of smooth jazz and soulful blues performances.',
    venueId: venue2.id,
    date: new Date('2025-07-20T18:00:00Z'),
    price: '55.00',
    totalSeats,
  });

  const event3 = await upsertEvent({
    id: 'event-3',
    name: 'Classical Symphony Evening',
    description: 'A breathtaking evening of classical masterpieces performed by world-class musicians.',
    venueId: venue3.id,
    date: new Date('2025-08-10T19:00:00Z'),
    price: '95.00',
    totalSeats,
  });

  console.log('Events created:', [event1.id, event2.id, event3.id]);
  console.log('Seeding complete!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
