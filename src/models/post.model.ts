import { Schema, model } from 'mongoose';

const postSchema = new Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

postSchema.index({ author: 1, _id: -1 });
export const Post = model('Post', postSchema);
