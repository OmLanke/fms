import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { ChargeInput } from '../schemas/payment.schema';

export async function chargePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId, amount, currency } = req.body as ChargeInput;
    const payment = await paymentService.charge({ bookingId, amount, currency });
    const statusCode = payment.status === 'SUCCESS' ? 200 : 402;
    res.status(statusCode).json({ payment });
  } catch (err) {
    next(err);
  }
}

export async function getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment = await paymentService.getById(req.params.id);
    res.json({ payment });
  } catch (err) {
    next(err);
  }
}
