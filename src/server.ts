import mongoose from 'mongoose';
import { app } from './app';
import { env } from './config/env';
import { initializeDatabase } from './config/initialize';

async function main() {
    await initializeDatabase();
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
