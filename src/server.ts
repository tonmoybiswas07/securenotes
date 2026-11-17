import mongoose from 'mongoose';
import { app } from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { User } from './models/user.model';
import { Note } from './models/note.model';
import { Post } from './models/post.model';

async function main() {
    await connectDB();
    await Promise.all([User.init(), Note.init(), Post.init()]);
    const server = app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
    const shutdown = () => {
        const timeout = setTimeout(() => process.exit(1), 10000);
        timeout.unref();
        server.close(() => { void mongoose.disconnect().then(() => process.exit(0)); });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch(error => { console.error(error); process.exit(1); });
