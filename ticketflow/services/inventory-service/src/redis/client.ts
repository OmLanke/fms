import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
  lazyConnect: false,
});

redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('error', (err: Error) => console.error('Redis error:', err.message));
