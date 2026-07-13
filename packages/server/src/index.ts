import { serve } from '@hono/node-server';
import { createApp, type AppOptions } from './app.js';

export { createApp, type AppOptions } from './app.js';
export { SessionStore, SessionNotFoundError } from './sessions.js';
export type { CreateSessionInput, Session } from './sessions.js';
export { SampleProvider, type SampleInfo } from './samples.js';

export interface ServerOptions extends AppOptions {
  port?: number;
  hostname?: string;
}

export interface RunningServer {
  port: number;
  close: () => void;
}

/**
 * Starts the BPMN Flow HTTP server on the given port and returns a handle for
 * shutting it down. Defaults to port 3000.
 */
export function startServer(options: ServerOptions = {}): RunningServer {
  const port = options.port ?? 3000;
  const app = createApp(options);
  const server = serve({
    fetch: app.fetch,
    port,
    ...(options.hostname ? { hostname: options.hostname } : {}),
  });
  return {
    port,
    close: () => server.close(),
  };
}
