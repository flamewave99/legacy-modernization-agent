import { loadConfig } from './config.js';
import { resetDatabase } from './reset.js';

const { databaseUrl } = loadConfig();
await resetDatabase(databaseUrl);
console.log('Database reset and seeded.');
