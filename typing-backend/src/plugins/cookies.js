import cookie from '@fastify/cookie';
import fastifyPlugin from 'fastify-plugin';

async function registerCookies(app) {
  await app.register(cookie);
}

// Cookie parsing runs in Fastify's onRequest hook, so this must be registered
// before route plugins that read request.cookies.
export default fastifyPlugin(registerCookies);
