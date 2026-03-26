import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'JWT secret not configured' },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired' },
    });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
      return;
    }
    next();
  });
}
