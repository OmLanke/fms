import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service';
import { CreateEventInput, UpdateEventInput } from '../schemas/event.schema';

export async function getAllEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const events = await eventService.getAll();
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

export async function getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await eventService.getById(req.params.id);
    res.json({ event });
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await eventService.create(req.body as CreateEventInput);
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await eventService.update(req.params.id, req.body as UpdateEventInput);
    res.json({ event });
  } catch (err) {
    next(err);
  }
}
