import { Router } from 'express';
import { Post } from '../models/post.model';
import { authenticate } from '../middlewares/auth.middleware';
import { contentSchema, meta, pagination } from '../utils/http';

export const postRouter = Router();
postRouter.get('/', async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const [posts, total] = await Promise.all([
    Post.find().sort({ _id: -1 }).skip(skip).limit(limit).lean(), Post.countDocuments(),
  ]);
  res.json({ posts, pagination: meta(page, limit, total) });
});
postRouter.post('/', authenticate, async (req, res) => {
  const input = contentSchema.strict().parse(req.body);
  res.status(201).json({ post: await Post.create({ ...input, author: req.auth!.id }) });
});
