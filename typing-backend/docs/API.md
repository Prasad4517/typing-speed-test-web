# Typing API contract

Base URL: `http://localhost:4000/api`

All successful responses return JSON data directly. Every client-owned endpoint requires:

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

`VALIDATION_ERROR` (400), `NOT_FOUND` (404), `SESSION_EXPIRED` (410), `CONFLICT` (409), `SUSPICIOUS_RESULT` (422), `RATE_LIMITED` (429), and `INTERNAL_ERROR` (500).
