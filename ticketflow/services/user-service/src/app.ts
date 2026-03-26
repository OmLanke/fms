import express from 'express';
import { errorHandler } from '@ticketflow/shared';
import { authRouter } from './routes/auth.routes';

export const app = express();

app.use(express.json());
app.use('/api/users', authRouter);
app.use(errorHandler);
