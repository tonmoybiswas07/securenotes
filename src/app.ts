import express from 'express';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { noteRouter } from './routes/note.routes';
import { userRouter } from './routes/user.routes';
import { postRouter } from './routes/post.routes';
import { errorHandler } from './middlewares/error.middleware';
import { notFound } from './middlewares/not-found.middleware';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 300,
  standardHeaders: 'draft-8', legacyHeaders: false
}));
app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
app.use('/api/auth', authRouter);
app.use('/api/notes', noteRouter);
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use(express.static(path.join(__dirname, '../public')));
app.use(notFound);
app.use(errorHandler);
