import { config } from './config/env.js';
import { buildApp } from './app.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ host: '0.0.0.0', port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  app.log.info(`${signal} received. Shutting down.`);
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

await start();
