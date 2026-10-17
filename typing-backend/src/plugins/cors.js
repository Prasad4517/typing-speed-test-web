import cors from '@fastify/cors';
import fastifyPlugin from 'fastify-plugin';

import { config } from '../config/env.js';

async function registerCors(app) {
  await app.register(cors, {
    // Keep the allow-list explicit. Requests without an Origin (curl, health
    // checks, and server-to-server calls) are still allowed by the plugin.
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'X-Client-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 204,
  });
}

// Fastify plugins are encapsulated by default. Exporting this wrapper with
// fastify-plugin makes the CORS hook apply to the route plugins registered by
// the parent application as well.
export default fastifyPlugin(registerCors);
