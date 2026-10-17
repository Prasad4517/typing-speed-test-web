import { clientHeadersSchema } from '../schemas/client.schema.js';
import { healthQuerySchema } from '../schemas/health.schema.js';
import { validateHeaders, validateQuery } from '../utils/validate.js';

async function validateClient(request) {
  validateHeaders(request, clientHeadersSchema);
}

export default async function statsRoutes(app, { controllers }) {
  app.get('/stats/summary', {
    preHandler: [
      validateClient,
      async (request) => {
        validateQuery(request, healthQuerySchema);
      },
    ],
    handler: controllers.stats.summary,
  });
}
