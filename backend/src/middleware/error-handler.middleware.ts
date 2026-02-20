import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ConflictError, NotFoundError } from '../services/firebase.service';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request data',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({ error: 'conflict', message: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: 'not_found', message: err.message });
    return;
  }

  // Unexpected errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
}
