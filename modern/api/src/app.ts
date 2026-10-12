import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { fileURLToPath } from 'node:url';
import { loadConfig, type Config } from './config.js';
import { registerDb } from './db.js';
import { registerLegacyVetsRoutes } from './routes/legacy-vets.js';
import { registerOwnerWriteRoutes } from './routes/owners-write.js';
import { registerPageRoutes } from './routes/pages.js';
import { registerPetWriteRoutes } from './routes/pets-write.js';
import { registerReadRoutes } from './routes/read.js';
import { registerVisitWriteRoutes } from './routes/visits-write.js';

export interface BuildAppOptions {
  config?: Config;
  logger?: FastifyServerOptions['logger'];
  /** The built web app (`modern/web/dist`); tests may point at a fixture. */
  webRoot?: string;
}

// Same relative path from `src/` (tests) and `dist/` (production).
const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../../web/dist', import.meta.url));

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: options.logger ?? true });
  app.decorate('config', config);
  registerDb(app, config.databaseUrl);

  app.get('/api/health', () => ({ status: 'ok' }));
  registerReadRoutes(app);
  registerOwnerWriteRoutes(app);
  registerPetWriteRoutes(app);
  registerVisitWriteRoutes(app);
  registerLegacyVetsRoutes(app);
  registerPageRoutes(app, options.webRoot ?? DEFAULT_WEB_ROOT);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}
