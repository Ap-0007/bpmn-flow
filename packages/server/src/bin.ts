#!/usr/bin/env node
import { startServer, type ServerOptions } from './index.js';

/** Reads `--name value` or `--name=value` from argv. */
function readArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const index = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (index === -1) return undefined;
  const current = argv[index]!;
  if (current.includes('=')) return current.split('=').slice(1).join('=');
  return argv[index + 1];
}

const options: ServerOptions = {
  port: Number(process.env.PORT ?? readArg('port') ?? 3000),
};
const samplesDir = process.env.SAMPLES_DIR ?? readArg('samples');
const staticDir = process.env.STATIC_DIR ?? readArg('static');
if (samplesDir) options.samplesDir = samplesDir;
if (staticDir) options.staticDir = staticDir;

const server = startServer(options);
console.log(`BPMN Flow server listening on http://localhost:${server.port}`);

process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
