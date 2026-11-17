import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/user.model';
import { credentialsSchema } from '../utils/http';

async function main() {
  const input = credentialsSchema.parse({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  await connectDB();
  await User.init();
  const existing = await User.findOne({ email: input.email });
  if (existing) throw new Error('Account already exists; refusing to overwrite its password or role');
  await User.create({ name: 'Admin', ...input, password: await bcrypt.hash(input.password, 12), role: 'admin' });
  console.log('Admin created');
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
