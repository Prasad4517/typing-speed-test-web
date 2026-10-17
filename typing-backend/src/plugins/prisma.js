import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { URL } from 'node:url';

import { config } from '../config/env.js';

function parseDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    connectionLimit: config.dbConnectionLimit,
  };
}

export function createPrismaClient() {
  const adapter = new PrismaMariaDb(parseDatabaseUrl(config.databaseUrl));
  return new PrismaClient({ adapter });
}

export function registerPrisma(app, prisma) {
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
