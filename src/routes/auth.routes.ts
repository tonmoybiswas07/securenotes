import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { authenticate } from '../middlewares/auth.middleware';
import { credentialsSchema, profileSchema, HttpError } from '../utils/http';

export const authRouter = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: 'draft-8', legacyHeaders: false
});
const registerSchema = credentialsSchema.extend(profileSchema.shape).strict();
const tokenFor = (id: string) => jwt.sign({}, env.JWT_SECRET,
  { subject: id, expiresIn: '1h', algorithm: 'HS256' });

authRouter.post('/register', limiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await User.create({ ...input, password: await bcrypt.hash(input.password, 12), role: 'user' });
  const { password: _password, ...safeUser } = user.toObject();
  res.status(201).json({ user: safeUser, token: tokenFor(String(user._id)) });
});
authRouter.post('/login', limiter, async (req, res) => {
  const input = credentialsSchema.strict().parse(req.body);
  const user = await User.findOne({ email: input.email }).select('+password');
  
  const hash = user?.password ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const matches = await bcrypt.compare(input.password, hash);
  if (!user || !matches) throw new HttpError(401, 'Invalid email or password');
  const { password: _password, ...safeUser } = user.toObject();
  res.json({ user: safeUser, token: tokenFor(String(user._id)) });
});
authRouter.get('/me', authenticate, async (req, res) => {
  res.json({ user: await User.findById(req.auth!.id).lean() });
});
