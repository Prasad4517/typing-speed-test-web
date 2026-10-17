import { randomPassageQuerySchema } from '../schemas/passages.schema.js';
import { validateQuery } from '../utils/validate.js';

export default async function passagesRoutes(app, { controllers }) {
  app.get('/passages/random', {
    preHandler: async (request) => {
      request.query = validateQuery(request, randomPassageQuerySchema);
    },
    handler: controllers.passages.getRandom,
  });
}
