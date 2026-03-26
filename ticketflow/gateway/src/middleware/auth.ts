import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '@ticketflow/shared';

export function gatewayAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.headers['x-user-id'] = decoded.sub;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role;
  } catch {
    // Invalid token — let downstream services handle it
  }

  next();
}
