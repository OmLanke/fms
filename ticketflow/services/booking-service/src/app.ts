import express from 'express';
import { errorHandler } from '@ticketflow/shared';
import { bookingRouter } from './routes/booking.routes';

export const app = express();

app.use(express.json());
app.use('/api/bookings', bookingRouter);
app.use(errorHandler);
