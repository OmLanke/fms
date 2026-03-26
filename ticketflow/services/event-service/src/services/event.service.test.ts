import { eventService } from './event.service';
import { PrismaClient } from '../../../generated/client';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const prisma = new PrismaClient() as unknown as {
  event: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

const mockEvent = {
  id: 'event-1',
  name: 'Rock Night',
  description: 'An epic night',
  venueId: 'venue-1',
  venue: {
    id: 'venue-1',
    name: 'MSG',
    address: '4 Penn',
    city: 'NYC',
    country: 'US',
    capacity: 20000,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  date: new Date('2025-06-15T20:00:00Z'),
  price: { toString: () => '75.00' },
  totalSeats: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('eventService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAll returns serialized events', async () => {
    prisma.event.findMany.mockResolvedValue([mockEvent]);
    const events = await eventService.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('event-1');
    expect(typeof events[0].price).toBe('number');
  });

  it('getById returns event', async () => {
    prisma.event.findUnique.mockResolvedValue(mockEvent);
    const event = await eventService.getById('event-1');
    expect(event.id).toBe('event-1');
  });

  it('getById throws 404 when not found', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(eventService.getById('none')).rejects.toMatchObject({
      statusCode: 404,
      code: 'EVENT_NOT_FOUND',
    });
  });
});
