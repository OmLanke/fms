import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            fields: zodError.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
