import 'dotenv/config';
import { PrismaClient } from '../../generated/client';

const prisma = new PrismaClient();

const ROWS = ['A', 'B', 'C', 'D', 'E'];
const SEATS_PER_ROW = 10;

async function seed() {
  console.log('Seeding event service database...');

  const venue1 = await prisma.venue.upsert({
    where: { id: 'venue-1' },
    update: {},
    create: {
      id: 'venue-1',
      name: 'Madison Square Garden',
      address: '4 Pennsylvania Plaza',
      city: 'New York',
      country: 'US',
      capacity: 20000,
    },
  });

  const venue2 = await prisma.venue.upsert({
    where: { id: 'venue-2' },
    update: {},
    create: {
      id: 'venue-2',
      name: 'The O2 Arena',
      address: 'Peninsula Square',
      city: 'London',
      country: 'UK',
      capacity: 20000,
    },
  });

  const venue3 = await prisma.venue.upsert({
    where: { id: 'venue-3' },
    update: {},
    create: {
      id: 'venue-3',
      name: 'Sydney Opera House',
      address: 'Bennelong Point',
      city: 'Sydney',
      country: 'AU',
      capacity: 5000,
    },
  });

  const totalSeats = ROWS.length * SEATS_PER_ROW;

  const event1 = await prisma.event.upsert({
    where: { id: 'event-1' },
    update: {},
    create: {
      id: 'event-1',
      name: 'Rock Night Live',
      description: 'An epic night of rock music featuring top bands from around the world.',
      venueId: venue1.id,
      date: new Date('2025-06-15T20:00:00Z'),
      price: 75.0,
      totalSeats,
    },
  });

  const event2 = await prisma.event.upsert({
    where: { id: 'event-2' },
    update: {},
    create: {
      id: 'event-2',
      name: 'Jazz & Blues Festival',
      description: 'Two days of smooth jazz and soulful blues performances.',
      venueId: venue2.id,
      date: new Date('2025-07-20T18:00:00Z'),
      price: 55.0,
      totalSeats,
    },
  });

  const event3 = await prisma.event.upsert({
    where: { id: 'event-3' },
    update: {},
    create: {
      id: 'event-3',
      name: 'Classical Symphony Evening',
      description: 'A breathtaking evening of classical masterpieces performed by world-class musicians.',
      venueId: venue3.id,
      date: new Date('2025-08-10T19:00:00Z'),
      price: 95.0,
      totalSeats,
    },
  });

  console.log('Events created:', [event1.id, event2.id, event3.id]);
  console.log('Seeding complete!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
