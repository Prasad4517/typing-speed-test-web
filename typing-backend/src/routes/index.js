import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import passagesRoutes from './passages.routes.js';
import statsRoutes from './stats.routes.js';
import testsRoutes from './tests.routes.js';
import wordsRoutes from './words.routes.js';

export default async function routes(app, options) {
  const { controllers } = options;
  await app.register(authRoutes, { controllers });
  await app.register(healthRoutes, { controllers });
  await app.register(passagesRoutes, { controllers });
  await app.register(wordsRoutes, { controllers });
  await app.register(testsRoutes, { controllers });
  await app.register(statsRoutes, { controllers });
}
