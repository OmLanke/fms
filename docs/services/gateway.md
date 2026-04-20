# API Gateway

## Responsibility

The API Gateway is the single entry point for all client traffic. It handles:

- **JWT authentication** — verifies tokens locally and rejects unauthenticated requests to protected routes.
- **Request routing** — proxies requests to the appropriate downstream service based on path prefix.
- **Header injection** — adds `X-User-Id` and `X-User-Role` headers before forwarding to downstream services.
- **Rate limiting** — per-IP rate limiting on all public endpoints.
- **Request/response logging** — structured JSON logs with `requestId`, method, path, status, and duration.
- **Circuit breaking** — half-open circuit breaker for each upstream service.

The gateway does **not** contain business logic. It knows nothing about bookings, events, or payments.

---

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | Bun 1.1 |
| Framework | Elysia |
| Language | TypeScript |
| Auth | JWT (HS256) via `@elysiajs/jwt` |
| HTTP Client | Bun native `fetch` |
| Metrics | `prom-client` |
| Tracing | OpenTelemetry |

---

## API Endpoints

| Method | Path | Auth | Proxies To |
|---|---|---|---|
| GET | `/health` | No | — (gateway itself) |
| POST | `/api/users/register` | No | user-service:3001 |
| POST | `/api/users/login` | No | user-service:3001 |
| GET | `/api/users/me` | Yes | user-service:3001 |
| GET | `/api/events` | No | event-service:3002 |
| GET | `/api/events/:id` | No | event-service:3002 |
| POST | `/api/events` | Yes (ADMIN) | event-service:3002 |
| PUT | `/api/events/:id` | Yes (ADMIN) | event-service:3002 |
| POST | `/api/venues` | Yes (ADMIN) | event-service:3002 |
| GET | `/api/venues/:id` | No | event-service:3002 |
| GET | `/api/inventory/events/:eventId/seats` | No | inventory-service:3004 |
| POST | `/api/bookings` | Yes | booking-service:3003 |
| GET | `/api/bookings/my` | Yes | booking-service:3003 |
| GET | `/api/bookings/:id` | Yes | booking-service:3003 |
| POST | `/api/bookings/:id/cancel` | Yes | booking-service:3003 |
| GET | `/api/payments/:id` | Yes | payment-service:3005 |
| GET | `/api/payments/booking/:bookingId` | Yes | payment-service:3005 |
| GET | `/api/notifications/recent` | Yes | notification-service:3006 |
| GET | `/api/notifications/health` | No | notification-service:3006 |

---

## Kafka Topics

The gateway does not produce or consume Kafka topics directly.

---

## Key Algorithms

### JWT Verification Middleware

```typescript
// middleware/auth.ts
export const authMiddleware = (app: Elysia) =>
  app.derive(async ({ headers, jwt, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      set.status = 401;
      throw new Error('Missing or invalid Authorization header');
    }
    const token = authHeader.slice(7);
    const payload = await jwt.verify(token);
    if (!payload) {
      set.status = 401;
      throw new Error('Invalid or expired token');
    }
    return {
      userId: payload.sub as string,
      userRole: payload.role as string,
    };
  });
```

### Proxy Handler

```typescript
// routes/proxy.ts
async function proxyTo(targetUrl: string, request: Request, additionalHeaders?: Record<string, string>) {
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      ...additionalHeaders,
    },
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined,
  });
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Gateway listening port | `3000` |
| `JWT_SECRET` | HMAC secret for token verification | — |
| `JWT_EXPIRY_HOURS` | Token lifetime | `24` |
| `USER_SERVICE_URL` | User service base URL | `http://user-service:3001` |
| `EVENT_SERVICE_URL` | Event service base URL | `http://event-service:3002` |
| `BOOKING_SERVICE_URL` | Booking service base URL | `http://booking-service:3003` |
| `INVENTORY_SERVICE_URL` | Inventory service base URL | `http://inventory-service:3004` |
| `PAYMENT_SERVICE_URL` | Payment service base URL | `http://payment-service:3005` |
| `NOTIFICATION_SERVICE_URL` | Notification service base URL | `http://notification-service:3006` |
| `RATE_LIMIT_MAX` | Max requests per window per IP | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` |
| `LOG_LEVEL` | Log level | `info` |

---

## Local Development

```bash
cd gateway
bun install
bun dev
# Hot reload via Bun --watch
# Service available at http://localhost:3000
```

---

## Docker Build

```dockerfile
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY src/ ./src/
COPY tsconfig.json ./
RUN bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1.1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "dist/index.js"]
```
