import { buildApp } from '../src/app.js';

const app = buildApp();
await app.ready();

export default function handler(request, response) {
  app.server.emit('request', request, response);
}
