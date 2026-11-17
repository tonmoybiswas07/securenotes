import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Validation failed', errors: error.issues }); return;
  }
  if (error?.code === 11000) { res.status(409).json({ message: 'Email already exists' }); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ message: error.message }); return; }
  if (error?.type === 'entity.parse.failed') { res.status(400).json({ message: 'Invalid JSON body' }); return; }
  if (error?.type === 'entity.too.large') { res.status(413).json({ message: 'Request body too large' }); return; }
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
};
