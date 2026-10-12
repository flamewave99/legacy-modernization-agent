export interface Config {
  port: number;
  databaseUrl: string;
}

export const DEFAULT_PORT = 3000;
export const DEFAULT_DATABASE_URL = 'postgres://petclinic:petclinic@localhost:5433/petclinic';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawPort = env.PORT;
  const port = rawPort === undefined || rawPort === '' ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${String(rawPort)}`);
  }
  const databaseUrl = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  return { port, databaseUrl: databaseUrl === '' ? DEFAULT_DATABASE_URL : databaseUrl };
}
