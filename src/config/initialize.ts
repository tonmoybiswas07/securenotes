import { connectDB } from './db';
import { User } from '../models/user.model';
import { Note } from '../models/note.model';
import { Post } from '../models/post.model';

let initialization: Promise<void> | undefined;
export async function initializeDatabase() {
  await connectDB();
  if (!initialization) {
    initialization = Promise.all([User.init(), Note.init(), Post.init()])
      .then(() => undefined)
      .catch(error => { initialization = undefined; throw error; });
  }
  await initialization;
}
