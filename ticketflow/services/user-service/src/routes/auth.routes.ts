import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '@ticketflow/shared';
import { register, login, getMe } from '../controllers/auth.controller';
import { validate } from '@ticketflow/shared';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } },
});

authRouter.post('/register', authLimiter, validate(registerSchema), register);
authRouter.post('/login', authLimiter, validate(loginSchema), login);
authRouter.get('/me', requireAuth, getMe);
