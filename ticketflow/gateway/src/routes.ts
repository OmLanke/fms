import { Express, Request, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL ?? 'http://localhost:3002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3003';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:3004';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3005';

function proxy(target: string): ReturnType<typeof createProxyMiddleware> {
  const options: Options = {
    target,
    changeOrigin: true,
    onError: (err: Error, _req: Request, res: Response) => {
      console.error(`Proxy error to ${target}:`, err.message);
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Upstream service is unavailable' },
      });
    },
  };
  return createProxyMiddleware(options);
}

export function setupRoutes(app: Express): void {
  app.use('/api/users', proxy(USER_SERVICE_URL));
  app.use('/api/events', proxy(EVENT_SERVICE_URL));
  app.use('/api/bookings', proxy(BOOKING_SERVICE_URL));
  app.use('/api/inventory', proxy(INVENTORY_SERVICE_URL));
  app.use('/api/payments', proxy(PAYMENT_SERVICE_URL));
}
