import { Schema, model } from 'mongoose';

const noteSchema = new Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });


noteSchema.index({ owner: 1, _id: -1 });
export const Note = model('Note', noteSchema);
