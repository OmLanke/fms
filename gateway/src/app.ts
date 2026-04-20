import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import { decodeToken } from "./middleware/auth";
import { checkRateLimit } from "./middleware/rateLimiter";
import { proxyRequest } from "./proxy";

const rateLimitedError = () =>
  new Response(
    JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );

function getIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function getAuthHeaders(request: Request): Record<string, string> {
  const auth = decodeToken(request.headers.get("Authorization"));
  if (!auth) return {};
  return {
    "x-user-id": auth.userId ?? "",
    "x-user-email": auth.email ?? "",
    "x-user-role": auth.role ?? "USER",
  };
}

export const createApp = () => {
  const app = new Elysia()
    .use(cors())

    // Basic gateway health check
    .get("/health", () => ({
      status: "up",
      service: "gateway",
      timestamp: new Date().toISOString(),
      services: config.services,
    }))

    // Aggregate health: fan out to all downstream services
    .get("/health/all", async () => {
      const results = await Promise.allSettled(
        Object.entries(config.services).map(async ([name, url]) => {
          try {
            const res = await fetch(`${url}/health`, {
              signal: AbortSignal.timeout(2000),
            });
            if (!res.ok) return { name, status: "down" };
            const data = await res.json();
            return { name, status: "up", ...data };
          } catch {
            return { name, status: "down" };
          }
        })
      );
      return {
        gateway: "up",
        services: results.map((r) =>
          r.status === "fulfilled" ? r.value : { status: "down" }
        ),
      };
    })

    // User Service routes
    .all("/api/users", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.user}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/users/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.user}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })

    // Event Service routes
    .all("/api/events", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.event}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/events/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.event}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })

    // Venues → Event Service
    .all("/api/venues", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.event}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/venues/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.event}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })

    // Booking Service routes
    .all("/api/bookings", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.booking}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/bookings/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.booking}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })

    // Inventory Service routes
    .all("/api/inventory", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.inventory}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/inventory/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.inventory}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })

    // Payment Service routes
    .all("/api/payments", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.payment}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/payments/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.payment}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })

    // Notification Service routes
    .all("/api/notifications", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.notification}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    })
    .all("/api/notifications/*", async ({ request }) => {
      const ip = getIp(request);
      if (!checkRateLimit(ip, config.rateLimit.maxRequests, config.rateLimit.windowMs)) {
        return rateLimitedError();
      }
      const url = new URL(request.url);
      const targetUrl = `${config.services.notification}${url.pathname}${url.search}`;
      return proxyRequest(targetUrl, request, getAuthHeaders(request));
    });

  return app;
};
