import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { loadConfig, type Config } from './config.js';
import { registerDb } from './db.js';
import { registerLegacyVetsRoutes } from './routes/legacy-vets.js';
import { registerOwnerWriteRoutes } from './routes/owners-write.js';
import { registerReadRoutes } from './routes/read.js';

export interface BuildAppOptions {
  config?: Config;
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: options.logger ?? true });
  app.decorate('config', config);
  registerDb(app, config.databaseUrl);

  app.get('/api/health', () => ({ status: 'ok' }));
  registerReadRoutes(app);
  registerOwnerWriteRoutes(app);
  registerLegacyVetsRoutes(app);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}
