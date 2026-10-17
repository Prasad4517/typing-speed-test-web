# Typing API contract

Base URL: `http://localhost:4000/api`

All successful responses return JSON data directly. Typing-session endpoints require:

```http
X-Client-Id: <UUID v4>
```

Errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable text",
    "details": []
  }
}
```

## Authentication

Authentication uses a 15-minute signed access JWT and a rotating opaque refresh
token. Both are sent only in HttpOnly cookies; neither token is returned in a
JSON response. Browser clients must use `credentials: 'include'` for auth
requests.

State-changing cookie requests accept only the configured frontend origins in
production. All authentication endpoints have tighter rate limits than the
general API limit.

### `POST /auth/signup`

Request:

```json
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "a password with at least 12 characters"
}
```

Response: `201 Created`

```json
{
  "user": {
    "id": "uuid",
    "fullName": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "USER",
    "emailVerifiedAt": null,
    "createdAt": "2026-10-17T00:00:00.000Z"
  }
}
```

The password is Argon2id-hashed before storage. Duplicate emails return
`CONFLICT`.

### `POST /auth/login`

Request:

```json
{ "email": "ada@example.com", "password": "the account password" }
```

Response: the same user envelope and fresh auth cookies as sign-up. An unknown
email and an incorrect password both return the same `UNAUTHORIZED` response.

### `POST /auth/refresh`

Uses the refresh cookie, revokes it atomically, and issues a new access/refresh
pair. Reusing a revoked refresh token revokes the whole token family and returns
`UNAUTHORIZED`.

### `POST /auth/logout`

Revokes the presented refresh session when present and clears both auth cookies.

### `POST /auth/logout-all`

Requires the access cookie. Revokes every refresh session belonging to the
current user and clears the current browser cookies.

### `GET /me`

Requires the access cookie. Returns the authenticated user profile.

### `PATCH /me`

Requires the access cookie. Currently supports changing the name shown on a
profile and future certificate.

```json
{ "fullName": "Ada Byron Lovelace" }
```

### Password recovery

`POST /auth/forgot-password` always returns a generic response to avoid email
enumeration. `POST /auth/reset-password` accepts an opaque, single-use token
and a new 12+ character password; it revokes every existing refresh session.

The reset-token database workflow is implemented, but live reset-email delivery
must be connected to an approved email provider before this endpoint is exposed
to users. The backend never returns reset tokens in API responses.

## `GET /health`

Response:

```json
{
  "status": "ok",
  "uptime": 123.4,
  "timestamp": "2026-10-17T00:00:00.000Z"
}
```

## `GET /health/ready`

Checks the MySQL connection.

Response:

```json
{ "status": "ok", "database": "ok" }
```

## `GET /passages/random`

Optional query parameters:

- `difficulty`: `easy`, `medium`, or `hard`
- `exclude`: comma-separated stable passage keys

Response:

```json
{
  "key": "p-001",
  "text": "...",
  "difficulty": "medium",
  "category": "focus",
  "wordCount": 52,
  "charCount": 301
}
```

## `GET /words`

Query parameters:

- `count`: integer from 1 to 1000, default `50`
- `language`: currently `en`

Response:

```json
{ "words": ["time", "people", "water"] }
```

## `POST /tests/start`

Timed request:

```json
{ "mode": "timed", "duration": 30 }
```

Passage request:

```json
{ "mode": "passage", "difficulty": "medium", "exclude": ["p-001"] }
```

Response:

```json
{
  "testId": "uuid",
  "mode": "timed",
  "text": "the exact text to type",
  "passageKey": null,
  "duration": 30,
  "expiresAt": "2026-10-17T00:05:00.000Z"
}
```

The server stores the exact text in the session.

## `POST /tests/:testId/submit`

Request:

```json
{ "typedText": "the text the client typed", "elapsedMs": 30012 }
```

Response:

```json
{
  "testId": "uuid",
  "wpm": 74.2,
  "rawWpm": 79.8,
  "accuracy": 96.5,
  "typedLength": 385,
  "correctChars": 371,
  "incorrectChars": 14,
  "elapsedMs": 30012
}
```

Submission is single-use and uses a conditional state update. The server recomputes all score fields.

## `GET /tests/history`

Query parameters:

- `limit`: 1–50, default `20`
- `cursor`: opaque cursor returned by the previous response

Response:

```json
{
  "entries": [],
  "nextCursor": null
}
```

## `GET /stats/summary`

Response:

```json
{
  "totalTests": 4,
  "averageWpm": 72.5,
  "bestWpm": 88.1,
  "averageAccuracy": 97.2,
  "trend": [],
  "breakdownByMode": {
    "timed": { "totalTests": 4, "averageWpm": 72.5, "averageAccuracy": 97.2 }
  }
}
```

## Error codes

`VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND`
(404), `SESSION_EXPIRED` (410), `CONFLICT` (409), `SUSPICIOUS_RESULT` (422),
`RATE_LIMITED` (429), and `INTERNAL_ERROR` (500).
