# Project brief

## Current decisions

- Two independent apps: `typing-frontend` and `typing-backend`.
- Frontend: Next.js App Router, JavaScript/JSX, SCSS, Zustand, Recharts, Motion.
- Backend: Node.js ES modules, Fastify, Zod, Prisma 7, MySQL/MariaDB, and the MariaDB driver adapter.
- Passages and words are currently validated from backend-owned JSON files.
- The browser owns an anonymous UUID v4 `clientId`, stored in localStorage and sent as `X-Client-Id`.
- The server creates and owns test sessions and is authoritative for final scores.
- Leaderboard and authentication are deferred until identity and product policy are ready.
- Certificate generation and payment are future features. Submitted sessions already provide the server-verified record those features can consume.

## API phases currently implemented

- Health and readiness: `/api/health`, `/api/health/ready`
- File-backed content: `/api/passages/random`, `/api/words`
- Test lifecycle: `/api/tests/start`, `/api/tests/:testId/submit`
- Client analytics: `/api/tests/history`, `/api/stats/summary`

## Database model

The current Prisma migration creates `TestSession` with the exact text, anonymous client id, timing, score fields, status, and rejection reason. All timestamps are stored in UTC. The database URL is configured independently in `typing-backend/.env`.

## Deferred work

- Start and apply the first migration against the configured MySQL/MariaDB database.
- Run the backend smoke test against a live database.
- Add certificate verification/generation as a separate audited workflow.
- Add authenticated identity and public leaderboard policy.
- Add payment provider integration after the score/certificate contract is stable.
