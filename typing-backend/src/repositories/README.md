# Repositories

Put all database/ORM queries in this folder. Repository files may import the database client when it is added in Phase 2.

Services must call repositories instead of importing Prisma, Sequelize, MariaDB clients, or Fastify directly. Do not put business rules or HTTP handling here.
