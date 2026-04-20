// Simple in-memory rate limiter
const requests = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = requests.get(ip);

  if (!record || now > record.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of requests.entries()) {
    if (now > val.resetAt) requests.delete(key);
  }
}, 60_000);
