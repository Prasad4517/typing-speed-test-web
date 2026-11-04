# Authentication security architecture

This document describes the security boundaries and operating assumptions for
Keystroke's browser authentication system. Application code is JavaScript/ESM;
the separation below is architectural rather than language-dependent.

## Trust boundaries

- The Next.js application is an untrusted public client. It never receives a
  refresh token, password hash, signing key, token verifier, or internal user
  security metadata.
- The Fastify API is the only component allowed to sign access tokens or change
  durable authentication state.
- MariaDB/MySQL is authoritative for users, roles, sessions, refresh history,
  security versions, audit events, and notification outbox records.
- Redis holds only distributed, short-lived abuse counters. It is not an
  authentication database and never stores raw credentials or refresh tokens.
- Email delivery consumes durable outbox events outside the transaction that
  creates them. External delivery is never performed while a database
  transaction is open.

The API fails closed when it cannot validate required durable session state or
enforce a sensitive-operation rate limit. Liveness can remain available while
readiness reports a required dependency failure.

## Tokens and browser storage

Access and refresh tokens have deliberately different properties.

### Access token

The API signs a short-lived JWT with PS256. The protected header fixes the
algorithm and includes a configured `kid`; verification resolves that identifier
only from the server's trusted public-key set. The payload includes `iss`, `sub`,
`aud`, `iat`, `nbf`, `exp`, `jti`, the stable session identifier (`sid`), roles,
`securityVersion`, and an explicit access-token use marker.

The browser keeps the JWT in memory and sends it as `Authorization: Bearer`.
It is not written to localStorage, sessionStorage, IndexedDB, or a readable
cookie. A page reload therefore loses the JWT by design and restores the
session through one refresh operation.

JWT verification alone is not authorization. Protected requests also consult
the authoritative user and session records. A disabled/deleted user, revoked
session, expired session, stale security version, or changed role set is
rejected immediately. This strict check trades a database read for prompt
revocation and a simpler consistency model.

### Refresh token

The refresh credential is an opaque random value with at least 256 bits of
entropy. Its raw value exists only during generation/transmission and in an
`HttpOnly`, production-`Secure`, narrowly scoped browser cookie. MariaDB/MySQL
stores only its SHA-256 verifier.

Every successful refresh consumes the current record and creates exactly one
successor in the same stable logical session and family. MariaDB/MySQL serializes
the state transition; process-local locks are never used for correctness. An
old token presented after rotation is treated as possible theft. The complete
session/family is durably revoked and the replay audit event is committed
before the API returns an authentication failure.

Under this strict policy, retrying a refresh whose response was lost revokes
the session. The frontend therefore never blindly retries an uncertain refresh
request. It uses single-flight coordination in one tab and browser coordination
across tabs to reduce accidental concurrent rotations.

## Session and account invalidation

Every sign-in creates an independent logical session and token family. A user
can list bounded, safe session metadata and revoke only a session they own.
Normal sign-in on one device does not revoke other devices.

`securityVersion` is monotonically increased for account-wide high-risk
changes such as password change, password reset, and logout-all. Existing JWTs
containing an earlier value stop authorizing. Session-specific logout/revocation
invalidates the JWT through the `sid` check without affecting other devices.

Password change and password reset revoke all sessions and require a fresh
sign-in. Verification and reset tokens are random, short-lived, single-use,
stored only as hashes, and consumed transactionally.

## Passwords and abuse controls

Passwords are stored as Argon2id PHC strings. The baseline parameters are
19 MiB memory, two iterations, and one lane; operators must benchmark and may
raise them without changing the schema. Long Unicode passphrases and spaces are
accepted within configured size limits. A replaceable common-password policy
rejects a conservative local denylist. Unknown-account sign-in performs a
dummy Argon2 verification to reduce obvious timing differences.

Sensitive endpoints use Redis-backed atomic counters keyed by route plus safe
hashes of IP/account identifiers as appropriate. Redis errors do not disable
the protection. Repeated credential failures use temporary account backoff;
the policy avoids permanent attacker-triggered lockout.

## CSRF, origin, cookies, and CORS

Refresh authentication uses a cookie and is therefore CSRF-sensitive. The API
issues a cryptographically random, server-signed double-submit proof. Unsafe
cookie-participating requests must send the proof in both the CSRF cookie and a
custom header. The API compares values safely, verifies the server HMAC, checks
the allowed `Origin`, and rejects hostile Fetch Metadata. `SameSite` is defense
in depth, not the primary CSRF control.

The CORS policy is an explicit environment allowlist with credentials enabled;
wildcard origins are never combined with credentials. Production does not add
localhost automatically. The refresh cookie has no `Domain` unless deployment
requires one, and deletion repeats the same path/domain/security attributes.
Sensitive responses use `Cache-Control: no-store`.

The preferred browser path is same-origin `/api/v1/...`. Next.js rewrites that
path to the internal API URL, preserving `Authorization`, CSRF, and `Set-Cookie`
headers without publishing an internal backend address to the client bundle.

## Signing keys

Production private keys are supplied by a secret manager-mounted file or a
secret environment value. They are never generated at application startup,
committed, logged, returned by an API, or exposed through `NEXT_PUBLIC_*`.
Development/test may explicitly use an ephemeral process key; such tokens stop
working after restart and this mode is rejected in production.

Generate a development PS256 key pair without committing it:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out access-private.pem
openssl pkey -in access-private.pem -pubout -out access-public.pem
```

Set a new active `kid` and private key while retaining the old public key for at
least the maximum access-token lifetime. Unknown `kid` values and every
algorithm except PS256 are rejected.

## Transactions and retry behavior

The following state changes are atomic: signup plus initial role/token/outbox,
verification consumption, refresh rotation, replay revocation, logout/session
revocation, logout-all, password change, and password reset. Email/network work
is outside these transactions.

- Repeating logout is safe and returns success.
- Repeating a consumed verification or reset token cannot repeat the change.
- Repeating a rotated refresh token intentionally revokes its family.
- Concurrent signup is decided by the database uniqueness constraint.
- Concurrent refresh has at most one ordinary winner; a replay loser can revoke
  the strict-policy family, making the winner's successor unusable.
- A transaction rollback exposes no partially active token state.

## Audit and sensitive-data handling

Security transitions write durable audit records with event type, safe request
metadata, and a correlation identifier. Application logging must redact
authorization/cookie headers and request bodies on authentication routes. Raw
passwords, JWTs, refresh tokens, verification/reset tokens, private keys, token
hashes, and high-cardinality personal data must never enter logs or metrics.

Rotated refresh history is retained through the maximum replay-detection
window. Cleanup jobs operate in bounded indexed batches and must not remove a
record while its family can still accept a descendant.

## Verification expectations

Fast unit/API tests use injected repositories and infrastructure only for fast
contract feedback. Release validation additionally requires dedicated, real
MariaDB/MySQL and Redis instances, applied migrations, actual HTTP processing,
real PS256 signing, and browser cookie behavior. The critical release cases are
concurrent refresh, replay revocation persistence, stale security-version
rejection, CSRF/origin rejection, Redis failure, role enforcement, session
ownership, password/reset invalidation, and key rotation.

Passing tests do not prove the absence of vulnerabilities. Dependency audits,
secret scanning, operational key rotation, database backups, TLS termination,
monitoring, and periodic adversarial review remain production responsibilities.
