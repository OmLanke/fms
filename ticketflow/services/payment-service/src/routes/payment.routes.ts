import { Router } from 'express';
import { validate } from '@ticketflow/shared';
import { chargePayment, getPaymentById } from '../controllers/payment.controller';
import { chargeSchema } from '../schemas/payment.schema';

export const paymentRouter = Router();

paymentRouter.post('/charge', validate(chargeSchema), chargePayment);
paymentRouter.get('/:id', getPaymentById);
