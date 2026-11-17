import { Router } from 'express';
import { Note } from '../models/note.model';
import { authenticate } from '../middlewares/auth.middleware';
import { contentSchema, HttpError, idSchema, meta, pagination } from '../utils/http';

export const noteRouter = Router();
noteRouter.use(authenticate);
noteRouter.get('/', async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
 
  const filter = req.auth!.role === 'admin' ? {} : { owner: req.auth!.id };
  const [notes, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(), Note.countDocuments(filter),
  ]);
  res.json({ notes, pagination: meta(page, limit, total) });
});
noteRouter.post('/', async (req, res) => {
  const input = contentSchema.strict().parse(req.body);
  res.status(201).json({ note: await Note.create({ ...input, owner: req.auth!.id }) });
});
noteRouter.get('/:id', async (req, res) => {
  const _id = idSchema.parse(req.params.id);
  const filter = req.auth!.role === 'admin' ? { _id } : { _id, owner: req.auth!.id };
  const note = await Note.findOne(filter).lean();
  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ note });
});
noteRouter.patch('/:id', async (req, res) => {
  const _id = idSchema.parse(req.params.id);
  const input = contentSchema.partial().strict().refine(v => Object.keys(v).length > 0,
    'Provide at least one field').parse(req.body);
  const note = await Note.findOneAndUpdate({ _id, owner: req.auth!.id }, { $set: input },
    { returnDocument: 'after', runValidators: true });
  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ note });
});
noteRouter.delete('/:id', async (req, res) => {
  const _id = idSchema.parse(req.params.id);
  const note = await Note.findOneAndDelete({ _id, owner: req.auth!.id });
  if (!note) throw new HttpError(404, 'Note not found');
  res.status(204).send();
});
