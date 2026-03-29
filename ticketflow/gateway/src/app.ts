import express from 'express';
import { errorHandler } from '@ticketflow/shared';
import { rateLimiter } from './middleware/rateLimiter';
import { gatewayAuth } from './middleware/auth';
import { setupRoutes } from './routes';

export const app = express();

app.use(express.json());
app.use(rateLimiter);
app.use(gatewayAuth);
setupRoutes(app);
app.use(errorHandler);
