# Typing Speed Test

A production-oriented typing practice application with a Next.js frontend and a Node.js/Fastify backend.

## Prerequisites

- Node.js LTS (Node 22+ is recommended; the current workspace was validated on Node 20.20)
- MySQL or MariaDB running on port 3306
- A MariaDB database named `typing_db`

## Frontend

```bash
cd typing-frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api` in `typing-frontend/.env.local`.

## Backend

```bash
cd typing-backend
cp .env.example .env
# Set DATABASE_URL to your real MySQL/MariaDB credentials.
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

The backend runs on `http://localhost:4000`.

Health endpoints:

- `GET http://localhost:4000/api/health`
- `GET http://localhost:4000/api/health/ready`

The readiness endpoint requires the database to be running and the backend `DATABASE_URL` to be valid.

## Architecture

The frontend talks to the backend over REST/JSON. The backend follows:

```text
route -> controller -> service -> repository -> database or file source
```

The frontend owns live typing interaction and transient UI state. The backend owns sessions, authoritative scoring, anti-cheat validation, history, and summary statistics.

See [typing-backend/ARCHITECTURE.md](typing-backend/ARCHITECTURE.md) and [typing-backend/docs/API.md](typing-backend/docs/API.md) for the detailed contracts.
