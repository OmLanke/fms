import { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services/inventory.service';
import { LockSeatsInput, ReleaseSeatsInput, ConfirmSeatsInput } from '../schemas/inventory.schema';

export async function getSeatsByEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const seats = await inventoryService.getSeatsByEvent(req.params.eventId);
    res.json({ seats });
  } catch (err) {
    next(err);
  }
}

export async function lockSeats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { seatIds, bookingId, ttlSeconds } = req.body as LockSeatsInput;
    const result = await inventoryService.lockSeats(seatIds, bookingId, ttlSeconds ?? 300);
    if (!result.locked) {
      res.status(409).json({
        error: {
          code: 'SEAT_LOCKED',
          message: 'One or more seats are unavailable',
          details: { conflictingSeatIds: result.conflictingSeatIds },
        },
      });
      return;
    }
    res.json({ locked: true });
  } catch (err) {
    next(err);
  }
}

export async function releaseSeats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { seatIds } = req.body as ReleaseSeatsInput;
    await inventoryService.releaseSeats(seatIds);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function confirmSeats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { seatIds } = req.body as ConfirmSeatsInput;
    await inventoryService.confirmSeats(seatIds);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
