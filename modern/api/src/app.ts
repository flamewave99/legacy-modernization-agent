import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { loadConfig, type Config } from './config.js';

export interface BuildAppOptions {
  config?: Config;
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: options.logger ?? true });
  app.decorate('config', config);

  app.get('/api/health', () => ({ status: 'ok' }));

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}
