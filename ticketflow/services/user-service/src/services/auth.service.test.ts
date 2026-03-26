import { authService } from './auth.service';
import { PrismaClient } from '../../../generated/client';
import bcrypt from 'bcryptjs';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const prisma = new PrismaClient() as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock };
};

process.env.JWT_SECRET = 'test-secret';

describe('authService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should create a new user and return token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed_password',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
    });

    it('should throw 409 if email already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

      await expect(
        authService.register({ name: 'Test', email: 'test@example.com', password: 'password123' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
    });
  });

  describe('login', () => {
    it('should return token for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed_password',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({ email: 'test@example.com', password: 'password123' });
      expect(result.token).toBeDefined();
    });

    it('should throw 401 for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'wrong@example.com', password: 'password123' })
      ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    });
  });
});
