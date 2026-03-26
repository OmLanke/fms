import express from 'express';
import { errorHandler } from '@ticketflow/shared';
import { eventRouter } from './routes/event.routes';

export const app = express();

app.use(express.json());
app.use('/api/events', eventRouter);
app.use(errorHandler);
