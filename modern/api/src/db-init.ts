import { loadConfig } from './config.js';
import { seedIfEmpty } from './reset.js';

// Container entrypoint step: seed on first start only (see modern/Dockerfile).
const { databaseUrl } = loadConfig();
const seeded = await seedIfEmpty(databaseUrl);
console.log(seeded ? 'Empty database seeded.' : 'Database already initialized; left as is.');
