import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin, validate } from '@ticketflow/shared';
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
} from '../controllers/event.controller';
import { createEventSchema, updateEventSchema } from '../schemas/event.schema';

export const eventRouter = Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } },
});

eventRouter.get('/', readLimiter, getAllEvents);
eventRouter.get('/:id', readLimiter, getEventById);
eventRouter.post('/', writeLimiter, requireAdmin, validate(createEventSchema), createEvent);
eventRouter.put('/:id', writeLimiter, requireAdmin, validate(updateEventSchema), updateEvent);

