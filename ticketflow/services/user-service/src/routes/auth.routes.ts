import { Router } from 'express';
import { requireAuth } from '@ticketflow/shared';
import { register, login, getMe } from '../controllers/auth.controller';
import { validate } from '@ticketflow/shared';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/login', validate(loginSchema), login);
authRouter.get('/me', requireAuth, getMe);
