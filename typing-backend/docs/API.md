# Keystroke API contract

Base URL: `http://localhost:4000/api/v1`

All dates are UTC ISO-8601 strings. Successful responses return JSON directly.
Errors use one stable envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable text",
    "details": []
  }
}
```

Sensitive responses include `Cache-Control: no-store`. Production browser
origins must be explicitly allowlisted and use HTTPS.

## Browser security contract

1. Call `GET /auth/csrf` with `credentials: "include"`.
2. Keep the returned `csrfToken` in memory. The server also sets the matching
   readable `keystroke_csrf` cookie.
3. Send `X-CSRF-Token` on every unsafe auth/account request. The browser sends
   the cookie automatically.
4. Signin and refresh return a short-lived access JWT in JSON. Keep it only in
   memory and send `Authorization: Bearer <token>` to protected endpoints.
5. The opaque refresh token exists only in the `keystroke_refresh` HttpOnly
   cookie. JavaScript never reads it.

After signin/refresh, replace the in-memory CSRF proof with the new response
value. It is signed and bound to the stable session ID. Refresh requests are
single-flight: an uncertain/lost refresh response requires a fresh signin;
blindly retrying the old refresh token intentionally triggers replay revocation.

## Authentication

### `GET /auth/csrf`

Returns `{ "csrfToken": "..." }` and sets the CSRF cookie. If a valid refresh
cookie is present, the proof is bound to that session; otherwise it is a
pre-authentication proof.

### `POST /auth/signup`

```json
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "a long password-manager password"
}
```

Creates a `PENDING_VERIFICATION` account and queues an encrypted verification
message. It does not create a login session.

### `POST /auth/verify-email`

```json
{ "token": "the token pasted from the email" }
```

The token is single-use, short-lived, and never accepted through a query string.

### `POST /auth/resend-verification`

```json
{ "email": "ada@example.com" }
```

Always returns a generic response. Outstanding verification tokens are consumed
before a replacement is created.

### `POST /auth/signin`

```json
{
  "email": "ada@example.com",
  "password": "the account password",
  "deviceLabel": "Ada's laptop"
}
```

Successful signin creates an independent logical session and refresh family:

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 600,
  "user": {
    "id": "uuid",
    "fullName": "Ada Lovelace",
    "email": "ada@example.com",
    "emailVerified": true,
    "status": "ACTIVE",
    "roles": ["ROLE_USER"],
    "createdAt": "2026-11-04T10:00:00.000Z"
  },
  "session": {
    "id": "uuid",
    "deviceLabel": "Ada's laptop",
    "current": true,
    "createdAt": "2026-11-04T10:00:00.000Z",
    "lastActivityAt": "2026-11-04T10:00:00.000Z",
    "expiresAt": "2026-11-18T10:00:00.000Z",
    "revokedAt": null
  },
  "csrfToken": "..."
}
```

The refresh token is never included in JSON.

### `POST /auth/refresh`

Uses the refresh cookie and session-bound CSRF proof. The old token is marked
`ROTATED`, a new hash is persisted atomically, and a replacement cookie/access
JWT are issued. Reusing a rotated token revokes the entire stable session and
invalidates its access tokens.

### `POST /auth/logout`

Uses any known refresh record—active or rotated—to revoke the stable session.
The operation is idempotent and clears browser auth cookies.

### `POST /auth/logout-all`

Requires Bearer authentication and session-bound CSRF. Revokes every device and
increments `securityVersion`, immediately invalidating old access JWTs.

### Password recovery

- `POST /auth/forgot-password` — `{ "email": "ada@example.com" }`
- `POST /auth/reset-password` — `{ "token": "...", "newPassword": "..." }`

Forgot-password responses do not disclose whether an account exists. Reset
consumes the verifier transactionally, changes credentials, increments security
version, revokes every session, and queues a confirmation message.

## Account endpoints

All require Bearer authentication.

| Method   | Path                                       | Additional requirement         |
| -------- | ------------------------------------------ | ------------------------------ |
| `GET`    | `/account/me`                              | None                           |
| `PATCH`  | `/account/me`                              | CSRF; `{ "fullName": "..." }`  |
| `POST`   | `/account/change-password`                 | CSRF; current and new password |
| `GET`    | `/account/sessions?limit=20&cursor=<uuid>` | Bounded pagination             |
| `DELETE` | `/account/sessions/{sessionId}`            | CSRF; ownership enforced       |
| `GET`    | `/user/dashboard`                          | `ROLE_USER` or `ROLE_ADMIN`    |
| `GET`    | `/admin/dashboard`                         | Authoritative `ROLE_ADMIN`     |

Role checks are backend checks. UI visibility is not authorization.

## Typing APIs

Anonymous typing requests use a browser UUID in `X-Client-Id`.

| Method | Path                          | Purpose                                 |
| ------ | ----------------------------- | --------------------------------------- |
| `GET`  | `/health`                     | Liveness                                |
| `GET`  | `/health/ready`               | Generic MariaDB/MySQL + Redis readiness |
| `GET`  | `/passages/random`            | Select a passage                        |
| `GET`  | `/words?count=50&language=en` | Select words                            |
| `POST` | `/tests/start`                | Create an authoritative test session    |
| `POST` | `/tests/{testId}/submit`      | Server-verify and score a result        |
| `GET`  | `/tests/history`              | Bounded test history                    |
| `GET`  | `/stats/summary`              | Aggregate statistics                    |

The scoring server stores the assigned text and rejects cross-client,
duplicate, expired, or physically unverifiable submissions.

## Status codes

`400` validation, `401` authentication/token failure, `403` CSRF/account/role
failure, `404` undisclosable resource, `409` state conflict, `422` suspicious
typing result, `429` distributed rate limit, `503` required security dependency
unavailable, and `500` unexpected failure with no internal details in production.
