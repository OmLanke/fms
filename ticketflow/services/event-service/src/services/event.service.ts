import { PrismaClient } from '../../../generated/client';
import { AppError } from '@ticketflow/shared';
import { CreateEventInput, UpdateEventInput } from '../schemas/event.schema';

const prisma = new PrismaClient();

function serializeEvent(event: {
  id: string;
  name: string;
  description: string;
  venueId: string;
  venue?: { id: string; name: string; address: string; city: string; country: string; capacity: number; createdAt: Date; updatedAt: Date };
  date: Date;
  price: { toString(): string };
  totalSeats: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    venueId: event.venueId,
    venue: event.venue
      ? {
          ...event.venue,
          createdAt: event.venue.createdAt.toISOString(),
          updatedAt: event.venue.updatedAt.toISOString(),
        }
      : undefined,
    date: event.date.toISOString(),
    price: parseFloat(event.price.toString()),
    totalSeats: event.totalSeats,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export const eventService = {
  async getAll() {
    const events = await prisma.event.findMany({
      include: { venue: true },
      orderBy: { date: 'asc' },
    });
    return events.map(serializeEvent);
  },

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { venue: true },
    });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }
    return serializeEvent(event);
  },

  async create(input: CreateEventInput) {
    if (!input.venueId && !input.venueName) {
      throw new AppError(400, 'VENUE_REQUIRED', 'Provide venueId to link an existing venue, or venueName/venueAddress/venueCity/venueCountry to create one');
    }

    const venueConnect = input.venueId
      ? { connect: { id: input.venueId } }
      : {
          create: {
            name: input.venueName ?? '',
            address: input.venueAddress ?? '',
            city: input.venueCity ?? '',
            country: input.venueCountry ?? '',
            capacity: input.totalSeats,
          },
        };

    const event = await prisma.event.create({
      data: {
        name: input.name,
        description: input.description,
        date: new Date(input.date),
        price: input.price,
        totalSeats: input.totalSeats,
        venue: venueConnect,
      },
      include: { venue: true },
    });
    return serializeEvent(event);
  },

  async update(id: string, input: UpdateEventInput) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.date !== undefined && { date: new Date(input.date) }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.totalSeats !== undefined && { totalSeats: input.totalSeats }),
      },
      include: { venue: true },
    });
    return serializeEvent(event);
  },
};
