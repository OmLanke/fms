import { Router } from 'express';
import { validate } from '@ticketflow/shared';
import {
  getSeatsByEvent,
  lockSeats,
  releaseSeats,
  confirmSeats,
} from '../controllers/inventory.controller';
import { lockSeatsSchema, releaseSeatsSchema, confirmSeatsSchema } from '../schemas/inventory.schema';

export const inventoryRouter = Router();

inventoryRouter.get('/events/:eventId/seats', getSeatsByEvent);
inventoryRouter.post('/lock', validate(lockSeatsSchema), lockSeats);
inventoryRouter.post('/release', validate(releaseSeatsSchema), releaseSeats);
inventoryRouter.post('/confirm', validate(confirmSeatsSchema), confirmSeats);
