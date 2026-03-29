import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { AppError, JwtPayload } from '@ticketflow/shared';
import { db } from '../db/client';
import { users } from '../db/schema';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function normalizeRole(role: string): 'USER' | 'ADMIN' {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

function sanitizeUser(user: { id: string; name: string; email: string; role: string; createdAt: Date | string; updatedAt: Date | string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
    }
    const hashedPassword = await bcrypt.hash(input.password, 12);
    const inserted = await db
      .insert(users)
      .values({
        id: randomUUID(),
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: 'USER',
      })
      .returning();
    const user = inserted[0];
    const token = signToken({ sub: user.id, email: user.email, role: normalizeRole(user.role) });
    return { user: sanitizeUser(user), token };
  },

  async login(input: LoginInput) {
    const found = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = found[0];
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const token = signToken({ sub: user.id, email: user.email, role: normalizeRole(user.role) });
    return { token };
  },

  async getById(id: string) {
    const found = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = found[0];
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return sanitizeUser(user);
  },
};
