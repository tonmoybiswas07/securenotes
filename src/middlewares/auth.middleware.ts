import type {} from '../types/express';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { HttpError, idSchema } from '../utils/http';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required');
  let subject: string;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !idSchema.safeParse(payload.sub).success) throw new Error();
    subject = payload.sub as string;
  } catch { throw new HttpError(401, 'Invalid or expired token'); }
  // Read the current role: deleted users and revoked admin access take effect immediately.
  const user = await User.findById(subject).select('role').lean();
  if (!user) throw new HttpError(401, 'Account no longer exists');
  req.auth = { id: String(user._id), role: user.role };
  next();
};

export const adminOnly: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'admin') throw new HttpError(403, 'Admin access required');
  next();
};
