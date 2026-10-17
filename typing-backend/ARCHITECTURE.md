# Backend architecture

The backend is an independent Node.js application. Run every backend command from `typing-backend/`.

The database is MySQL/MariaDB through Prisma 7 and the official MariaDB driver adapter. The current local content source is validated JSON in `src/data/`; database-backed passage storage can replace it later.

## Layering

Every database-backed API follows this direction:

```text
route -> controller -> service -> repository -> database
```

- **Routes** define HTTP methods, URLs, edge schemas, and route registration only.
- **Controllers** translate validated HTTP input into service calls and return service data.
- **Services** contain business rules. They must not import Fastify or Prisma/database clients.
- **Repositories** contain all database queries. Only repositories may import the ORM client.
- **Database** is accessed only through repositories.

Files are data sources too. A file-backed repository owns loading, validation, indexing, and selection from JSON. Services must not read `src/data/` directly.

Health is an exception because it has no database access: `route -> controller -> service`.

## Naming conventions

- Files use `kebab-case` where a multi-word filename is needed.
- Resource files use `<resource>.routes.js`, `<resource>.controller.js`, `<resource>.service.js`, `<resource>.repository.js`, and `<resource>.schema.js`.
- URL resources are plural, for example `/api/passages` and `/api/words`.
- Variables and functions use `camelCase`.
- Classes use `PascalCase`.

## Responses and errors

Successful responses return their data directly as JSON. Errors always use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable text",
    "details": []
  }
}
```

Validate all request input at the edge with Zod. Throw an `AppError` subclass for expected failures; never send raw errors from routes or controllers.

## Constants

`src/constants/` is the single source for backend error codes, headers, modes, difficulty values, scoring rules, limits, and reusable messages. Constants modules import only other constants. Schemas build enums and limits from these exports so routes and services do not repeat magic values.

Frontend contract constants intentionally mirror the backend because the applications are independently deployable. `docs/API.md` is the shared contract reference.

## How to add a new API

1. Create the Zod schema.
2. Create the repository if database access is needed.
3. Create the service.
4. Create the controller.
5. Create the route file.
6. Register the route in `src/routes/index.js`.
7. Update the API documentation section of the project brief.

Keep business logic out of routes/controllers, and never pass Fastify request/reply objects into services.

## Identity and timing

The frontend creates an anonymous UUID v4 once per browser and sends it as `X-Client-Id`. The backend validates it at the request edge and stores it on every test session. This is continuity, not authentication.

The client timer starts at the first keystroke. On submit, the server accepts elapsed time only when it is no greater than the server-measured age of the session plus the configured tolerance. A pre-typing pause is therefore valid, while impossible elapsed time is rejected.

## Moving passages to the database

Passages currently come from `src/data/passages.seed.json` through `passages.repository.js`. The repository exposes selection operations rather than exposing the file itself. To move content to MySQL:

1. Add a Prisma-backed passages repository implementing `count`, `getByIndex`, `getByKey`, and `getRandom`.
2. Add a scheduler/import script under `src/jobs/` or `src/scripts/` to populate and refresh the database.
3. Swap the repository factory in `src/repositories/index.js`.
4. Leave routes, controllers, and services unchanged.

The passage keys must remain stable strings so existing exclusions and future certificate/audit records do not depend on database auto-increment ids.

## Certificate readiness

Final score fields are computed and stored by the server against a single-use `TestSession`. Future certificate generation should consume a submitted session/result record, include the scoring version and verification identifier, and remain separate from the typing interaction and payment flow.
