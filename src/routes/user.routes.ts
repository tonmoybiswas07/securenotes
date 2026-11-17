import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/user.model';
import { Note } from '../models/note.model';
import { Post } from '../models/post.model';
import { authenticate, adminOnly } from '../middlewares/auth.middleware';
import { credentialsSchema, profileSchema, HttpError, idSchema, meta, pagination } from '../utils/http';

export const userRouter = Router();

// Public posts, one pipeline, with pagination inside the indexed lookup.
userRouter.get('/:id/posts', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { page, limit, skip } = pagination(req.query);
  const [result] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    { $lookup: {
      from: Post.collection.name,
      let: { userId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$author', '$$userId'] } } },
        { $sort: { _id: -1 } },
        { $facet: {
          posts: [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: 'total' }],
        } },
      ],
      as: 'result',
    } },
    { $project: { _id: 0, result: { $arrayElemAt: ['$result', 0] } } },
  ]);
  if (!result) throw new HttpError(404, 'User not found');
  res.json({ posts: result.result?.posts ?? [],
    pagination: meta(page, limit, result.result?.count?.[0]?.total ?? 0) });
});

userRouter.use(authenticate, adminOnly);
userRouter.get('/interests', async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const { interest, usersPerGroup } = z.object({
    interest: z.string().trim().min(1).max(50).optional(),
    usersPerGroup: z.coerce.number().int().min(1).max(100).default(10),
  }).parse(req.query);
 
  const [result] = await User.collection.aggregate([
    { $match: { interests: interest ?? { $exists: true, $ne: [] } } },
    { $project: { name: 1, email: 1, interests: 1 } },
    { $unwind: '$interests' },
    ...(interest ? [{ $match: { interests: interest } }] : []),
    { $group: {
      _id: '$interests', totalUsers: { $sum: 1 },
      users: { $topN: { n: usersPerGroup, sortBy: { _id: -1 },
        output: { _id: '$_id', name: '$name', email: '$email' } } },
    } },
    { $sort: { _id: 1 } },
    { $facet: {
      groups: [{ $skip: skip }, { $limit: limit },
        { $project: { _id: 0, interest: '$_id', totalUsers: 1, users: 1 } }],
      count: [{ $count: 'total' }],
    } },
  ]).toArray();
  res.json({ groups: result?.groups ?? [], usersPerGroup,
    pagination: meta(page, limit, result?.count?.[0]?.total ?? 0) });
});
userRouter.get('/', async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const { interest } = z.object({ interest: z.string().trim().min(1).max(50).optional() }).parse(req.query);
  const filter = interest ? { interests: interest } : {};

  const [users, total] = await Promise.all([
    User.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter),
  ]);
  res.json({ users, pagination: meta(page, limit, total) });
});
userRouter.post('/', async (req, res) => {
  const input = credentialsSchema.extend(profileSchema.shape).extend({
    role: z.enum(['user', 'admin']).default('user'),
  }).strict().parse(req.body);
  const user = await User.create({ ...input, password: await bcrypt.hash(input.password, 12) });
  const { password: _password, ...safeUser } = user.toObject();
  res.status(201).json({ user: safeUser });
});
userRouter.get('/:id', async (req, res) => {
  const user = await User.findById(idSchema.parse(req.params.id)).lean();
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user });
});
userRouter.patch('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = credentialsSchema.extend(profileSchema.shape).extend({
    role: z.enum(['user', 'admin']),
    interests: profileSchema.shape.interests.removeDefault(),
  }).partial().strict().refine(v => Object.keys(v).length > 0, 'Provide at least one field').parse(req.body);
  if (id === req.auth!.id && input.role === 'user') throw new HttpError(400, 'Cannot demote your own admin account');
  if (input.password) input.password = await bcrypt.hash(input.password, 12);
  const user = await User.findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user });
});
userRouter.delete('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  if (id === req.auth!.id) throw new HttpError(400, 'Cannot delete your own admin account');
  // Delete the account and its content atomically. MongoDB must run as a replica set.
  await mongoose.connection.transaction(async session => {
    const user = await User.findByIdAndDelete(id, { session });
    if (!user) throw new HttpError(404, 'User not found');
    await Note.deleteMany({ owner: id }, { session });
    await Post.deleteMany({ author: id }, { session });
  });
  res.status(204).send();
});
