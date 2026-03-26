import express from 'express';
import { errorHandler } from '@ticketflow/shared';
import { inventoryRouter } from './routes/inventory.routes';

export const app = express();

app.use(express.json());
app.use('/api/inventory', inventoryRouter);
app.use(errorHandler);
