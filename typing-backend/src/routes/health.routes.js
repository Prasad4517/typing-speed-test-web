import { healthQuerySchema } from '../schemas/health.schema.js';
import { validateQuery } from '../utils/validate.js';

export default async function healthRoutes(app, { controllers }) {
  app.get('/health', {
    preHandler: async (request) => {
      validateQuery(request, healthQuerySchema);
    },
    handler: controllers.health.getHealth,
  });

  app.get('/health/ready', {
    preHandler: async (request) => {
      validateQuery(request, healthQuerySchema);
    },
    handler: controllers.health.getReadiness,
  });
}
