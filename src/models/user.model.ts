import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  interests: { type: [String], default: [] },
}, { timestamps: true });


userSchema.index({ email: 1 }, { unique: true });

userSchema.index({ interests: 1, _id: -1 });

export const User = model('User', userSchema);
