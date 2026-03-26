import { Router } from 'express';
import { requireAdmin, validate } from '@ticketflow/shared';
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
} from '../controllers/event.controller';
import { createEventSchema, updateEventSchema } from '../schemas/event.schema';

export const eventRouter = Router();

eventRouter.get('/', getAllEvents);
eventRouter.get('/:id', getEventById);
eventRouter.post('/', requireAdmin, validate(createEventSchema), createEvent);
eventRouter.put('/:id', requireAdmin, validate(updateEventSchema), updateEvent);
