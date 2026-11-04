# Backend architecture

The backend is an independent Fastify 5 application written in ESM JavaScript.
Run commands from `typing-backend/`. Its public contract is versioned under
`/api/v1`; see `docs/API.md`.

## Runtime and dependencies

- MariaDB/MySQL is the durable source of truth through Prisma 7 and
  `@prisma/adapter-mariadb`.
- Redis is required for distributed sensitive-endpoint rate limits and is part
  of readiness. Authentication fails closed when Redis cannot enforce limits.
- Node 26 LTS is the production target. The package currently requires Node 22
  or newer; deploy on Node 26 after the platform image is available.
- The API and notification outbox worker are separate processes. A Vercel API
  deployment still needs a supervised/scheduled worker environment for
  `npm run jobs:outbox` and `npm run jobs:cleanup`.

## Layering

Database-backed requests use:

```text
route -> controller -> service -> repository -> MariaDB/MySQL
```

Routes own paths and Zod edge validation. Controllers translate HTTP metadata
and cookies. Services own security/business state transitions. Repositories own
Prisma queries, locks, and transactions. Services do not import Fastify or
Prisma. File-backed passage and word repositories follow the same boundary.

Errors are domain-specific `AppError` values mapped centrally to:

```json
{
  "error": {
    "code": "INVALID_SESSION",
    "message": "Safe client message",
    "details": []
  }
}
```

Unexpected production failures are logged by correlation ID without credential
headers and return a generic 500.

## Authentication and authorization

### Password and account state

Passwords use Argon2id with the OWASP baseline (`m=19456`, `t=2`, `p=1`).
Validation permits password-manager strings and Unicode while bounding input
cost. A replaceable common-password check and dummy hash verification reduce
common-password and unknown-account attacks.

Users move through explicit states: `PENDING_VERIFICATION`, `ACTIVE`, `LOCKED`,
`DISABLED`, and `DELETED`. Temporary lockout can only transition an already
active account to `LOCKED`; it cannot activate pending/disabled/deleted users.
Roles live in authoritative role tables and are enforced by backend middleware.

### Access tokens

Access tokens are 10-minute PS256 JWTs returned in JSON and kept in browser
memory. Keys are external PEM/base64/file sources behind a key provider. The
protected header fixes `alg`, `typ=at+jwt`, and `kid`; verification rejects
unknown keys, weak RSA keys, a mismatched active public/private pair, or an
unexpected token type.

Claims include `iss`, `sub`, `aud`, `iat`, `nbf`, `exp`, `jti`, `sid`, `roles`,
`sv`, and `token_use`. Every protected request verifies the signature and then
consults MariaDB/MySQL for current user state, session revocation/expiry,
securityVersion, and roles. Logout, password change/reset, disabled accounts,
and replay detection therefore invalidate authorization immediately.

### Refresh tokens and sessions

Each signin creates a stable logical `Session` and independent family. The raw
384-bit opaque refresh token exists only during issuance/transmission and in a
narrow HttpOnly cookie; MariaDB/MySQL stores a SHA-256 verifier.

Refresh locks the stable MariaDB/MySQL session row, re-reads the token, creates one
successor, and marks the predecessor `ROTATED` in one transaction. A second use
of a rotated token commits session/family revocation and a durable high-priority
audit event before returning 401. This deliberately treats a lost response plus
retry as possible theft. No process-local mutex participates in correctness.

Logout resolves any known family record, including a rotated token, locks and
revokes the stable session, and clears cookies. Logout-all and credential
changes revoke all sessions and increment the user's monotonic securityVersion.

### CSRF, origin, and cookies

The refresh cookie is HttpOnly; access JWTs are never cookies. Cookie-backed
unsafe operations require all of:

- an exact configured Origin (plus Fetch Metadata rejection for cross-site),
- a signed double-submit proof in `X-CSRF-Token` and the readable CSRF cookie,
- stable-session binding after authentication,
- explicit credentialed CORS allowlisting.

`GET /auth/csrf` permits a same-origin Fetch Metadata request without Origin,
which matches normal browser GET behavior. Production cookies are Secure and
production configuration rejects non-HTTPS browser URLs.

## Transactions and persistence

The MariaDB/MySQL forward migration extends the existing users, roles, sessions, refresh history,
verification/reset verifiers, security audits, an encrypted notification
outbox, and the existing typing sessions. Security-changing multi-row
operations are transactional and use row locks or conditional updates.

Verification and reset secrets are hashed in verifier tables. The copy required
for delivery is AES-256-GCM encrypted with a separate externally supplied key.
The bounded outbox worker claims rows with `FOR UPDATE`, supplies an
idempotency key to the HTTPS mail adapter, leases work, and applies capped
backoff without logging message bodies.

`npm run jobs:cleanup` deletes bounded indexed batches after configured
retention. Refresh history is kept beyond the usable token lifetime so cleanup
does not weaken replay detection.

## Rate limiting and proxy trust

Sensitive operations increment independent Redis buckets for IP and normalized
account identifier. The Lua increment/expiry is atomic; 429 responses include
`Retry-After`. Redis connect/reconnect is bounded, outage returns 503, and
readiness reports only a generic dependency status. Production proxy trust uses
an explicit hop count rather than trusting arbitrary forwarding headers.

## Typing integrity

Anonymous practice still uses a browser UUID in `X-Client-Id`; it is continuity,
not authorization. The server owns test text, timing bounds, single submission,
and final scoring. Authentication changes do not weaken the existing test
session or anti-cheat boundaries.

## Verification

`npm run lint`, `npm test`, `npm run db:generate`, and `npx prisma validate`
run without external services. Migration/concurrency deployment validation must
use dedicated real MariaDB/MySQL and Redis instances; never point tests at a
development or production database.
