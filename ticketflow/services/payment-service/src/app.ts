import express from 'express';
import { errorHandler } from '@ticketflow/shared';
import { paymentRouter } from './routes/payment.routes';

export const app = express();

app.use(express.json());
app.use('/api/payments', paymentRouter);
app.use(errorHandler);
