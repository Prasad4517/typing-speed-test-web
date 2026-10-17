import { buildApp } from './application.js';

// Vercel recognizes src/app.js as a function entrypoint. Fastify's Node HTTP
// server is used as the request handler after the application is initialized.
const app = buildApp();
await app.ready();

export default function handler(request, response) {
  app.server.emit('request', request, response);
}
