import { wordsQuerySchema } from '../schemas/words.schema.js';
import { validateQuery } from '../utils/validate.js';

export default async function wordsRoutes(app, { controllers }) {
  app.get('/words', {
    preHandler: async (request) => {
      request.query = validateQuery(request, wordsQuerySchema);
    },
    handler: controllers.words.getWords,
  });
}
