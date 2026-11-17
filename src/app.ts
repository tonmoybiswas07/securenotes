import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import { initializeDatabase } from './config/initialize';
import { authRouter } from './routes/auth.routes';
import { noteRouter } from './routes/note.routes';
import { userRouter } from './routes/user.routes';
import { postRouter } from './routes/post.routes';
import { errorHandler } from './middlewares/error.middleware';
import { notFound } from './middlewares/not-found.middleware';

export const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 300,
  standardHeaders: 'draft-8', legacyHeaders: false
}));
app.get('/', (_req, res) => { res.json({ name: 'Secure Notes API', health: '/api/health' }); });
app.get('/api/health', async (_req, res) => {
  await initializeDatabase();
  res.json({ status: 'ok' });
});
app.use('/api', async (_req, _res, next) => {
  await initializeDatabase();
  next();
});
app.use('/api/auth', authRouter);
app.use('/api/notes', noteRouter);
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
