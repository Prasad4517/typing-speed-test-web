# Keystroke typing practice

Keystroke is a Next.js typing application with an independently deployable
Fastify API. The repository uses JavaScript/JSX and ESM throughout application
code. Authentication is integrated with the real UI and API; it is not a
separate demonstration.

```text
typing-frontend/          Next.js App Router, React, SCSS modules, Motion
typing-backend/           Fastify, Prisma, MariaDB/MySQL, Redis, JOSE, Argon2id
SECURITY_ARCHITECTURE.md  Security decisions, failure modes, and tradeoffs
MIGRATION_MARIADB.md      Forward-only MariaDB/MySQL authentication migration
```

## Authentication model

- A short-lived PS256 JWT is returned in the sign-in/refresh response, held only
  in browser memory, and sent in `Authorization: Bearer`.
- A high-entropy opaque refresh token is held only in an `HttpOnly` cookie. The
  database stores its SHA-256 verifier, rotates it on every use, and retains
  history for replay detection.
- Every device has a stable logical session. Protected requests verify the JWT
  and authoritative user/session/security-version state, so revocation is
  immediate.
- Signed double-submit CSRF proof, strict Origin/Fetch Metadata checks, explicit
  CORS origins, and narrow cookie paths protect cookie-authenticated actions.
- MariaDB/MySQL is the durable authority. Redis supplies distributed, fail-closed
  throttling for sensitive endpoints. Verification/recovery notifications are
  represented by durable outbox events.
- Signup creates a pending account. Email verification activates it; sign-in
  never silently treats an unverified account as active.

Read [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) before changing token,
session, cookie, CSRF, or key behavior.

## Prerequisites

- Node.js LTS. Node 26 is the production target; use at least the version in each
  package's `engines` field for local tooling.
- MariaDB 10.6+ or MySQL 8.0+.
- Redis 7 or newer.
- OpenSSL for local signing-key generation.

The application does not require Docker. Use dedicated test databases and never
run destructive test/migration commands against development or production data.

## First-time development setup

### 1. Backend

```bash
cd typing-backend
# Review and set local values in .env.development.
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

Create a local PS256 key pair outside Git:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out access-private.pem
openssl pkey -in access-private.pem -pubout -out access-public.pem
```

Point `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH` at those files. Development
and tests may use a process-only ephemeral key when explicitly supported by the
backend configuration; production refuses to start without external key
material and a strong `CSRF_SIGNING_SECRET`.

Important backend variables are documented in
[`typing-backend/.env.development`](typing-backend/.env.development):

- `DATABASE_URL` and `REDIS_URL`
- `CORS_ALLOWED_ORIGINS`, `FRONTEND_PUBLIC_URL`, and `TRUST_PROXY`
- `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_SIGNING_KID`, signing/public key sources,
  token TTL, and clock skew
- refresh-cookie security attributes and `CSRF_SIGNING_SECRET`
- password, lockout, verification, reset, and rate-limit policy

The API listens on `http://localhost:4000` by default.

### 2. Frontend

```bash
cd typing-frontend
# Review local values in .env.development.
npm ci
npm run dev
```

`BACKEND_INTERNAL_URL=http://127.0.0.1:4000` is server-only. Next.js rewrites the
browser-visible `/api/v1/*` path to that backend so cookies remain same-origin
and no internal URL is included in the browser bundle. The UI listens on
`http://localhost:3000` by default.

## API overview

All application routes are under `/api/v1`.

| Area                 | Endpoints                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| Session bootstrap    | `GET /auth/csrf`, `POST /auth/signin`, `POST /auth/refresh`                      |
| Account creation     | `POST /auth/signup`, `POST /auth/verify-email`, `POST /auth/resend-verification` |
| Recovery             | `POST /auth/forgot-password`, `POST /auth/reset-password`                        |
| Sign-out             | `POST /auth/logout`, `POST /auth/logout-all`                                     |
| Account              | `GET/PATCH /account/me`, `POST /account/change-password`                         |
| Devices              | `GET /account/sessions`, `DELETE /account/sessions/:sessionId`                   |
| Authorization checks | `GET /user/dashboard`, `GET /admin/dashboard`                                    |

Unsafe browser requests first obtain CSRF proof and send it as
`X-CSRF-Token`. Protected endpoints additionally require the in-memory access
JWT as a Bearer token. Authentication responses and errors are marked
`Cache-Control: no-store`.

See [`typing-backend/docs/API.md`](typing-backend/docs/API.md) for request and
response contracts.

## Browser lifecycle

On page load, the authentication provider enters an initializing state and
attempts one coordinated refresh. A valid refresh cookie yields a new in-memory
access token, then `/account/me` restores the safe user record. Protected calls
perform a single-flight refresh once after an authentication failure; they do
not endlessly retry. Browser locks/BroadcastChannel coordination reduces
refresh races across tabs. Logout invalidates pending refresh work before the
UI clears private state.

Signup leads to manual email-token verification. The recovery UI also accepts
the emailed reset token in a form rather than putting credentials in a URL,
history, access log, or referrer. The profile security area supports password
change, device-session review/revocation, and logout-all.

## Verification commands

Run from each package directory:

```bash
# typing-backend
npm ci
npm run db:generate
npx prisma validate
npm run lint
npm test
npm run db:deploy
npm run smoke

# typing-frontend
npm ci
npm run lint
npm test
npm run build
```

Fast tests use injected collaborators for deterministic contract feedback. A
release must additionally run the integration/security suite against dedicated
real MariaDB/MySQL and Redis services, apply the migration, start both processes,
and exercise browser cookie behavior. Critical cases include simultaneous
refresh, replay revocation, CSRF/origin rejection, stale security versions,
role denial, reset/change-password invalidation, Redis failure, and key
rotation. Never report these checks as passed when the services were not
available.

## Production operations

- Terminate HTTPS at a trusted proxy and configure `TRUST_PROXY` only for known
  proxy boundaries. Production refresh cookies must be `Secure`.
- Use a secret manager or mounted files for private signing keys and CSRF/outbox
  secrets. Never use `NEXT_PUBLIC_*` for backend secrets.
- Use a bounded MariaDB/MySQL pool. Apply `npm run db:deploy` before application
  rollout; never use `db:reset` in production.
- Configure Redis with authentication/TLS as appropriate and bounded reconnect
  behavior. Authentication throttling must not fail open.
- Process notification outbox entries and cleanup jobs with separately scoped
  worker identities. Retain rotated-token history for at least the replay
  detection window.
- Redact authorization/cookie headers and authentication bodies from logs. Add
  alerts for replay detection, lockout spikes, dependency failures, and signing
  key age.
- Rotate keys by publishing the new public key, changing the active `kid`, then
  retaining old public keys beyond the maximum access-token lifetime.

The existing MariaDB/MySQL migration history is retained. Follow
[MIGRATION_MARIADB.md](MIGRATION_MARIADB.md) for the forward-only authentication
migration and rollback plan.
