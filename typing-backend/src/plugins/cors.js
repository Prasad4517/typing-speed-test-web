import cors from '@fastify/cors';
import fastifyPlugin from 'fastify-plugin';

import { config } from '../config/env.js';
import { MESSAGES } from '../constants/messages.js';
import { ForbiddenError } from '../utils/app-error.js';

async function registerCors(app) {
  await app.register(cors, {
    // Keep the allow-list explicit. Requests without an Origin (curl, health
    // checks, and server-to-server calls) are still allowed by the plugin.
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'X-Client-Id',
      'X-CSRF-Token',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
  app.addHook('onRequest', async (request) => {
    const origin = request.headers.origin;
    if (origin && !config.corsOrigins.includes(origin)) {
      throw new ForbiddenError(MESSAGES.forbiddenOrigin);
    }
  });
}

// Fastify plugins are encapsulated by default. Exporting this wrapper with
// fastify-plugin makes the CORS hook apply to the route plugins registered by
// the parent application as well.
export default fastifyPlugin(registerCors);
