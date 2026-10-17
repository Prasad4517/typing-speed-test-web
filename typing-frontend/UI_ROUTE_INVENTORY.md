# Keystroke UI route inventory

This inventory records the current frontend scope after the redesign pass. It
separates working product flows from intentionally deferred features so the UI
does not make unsupported claims.

| Route | Purpose | Current data/API | Status and next action |
| --- | --- | --- | --- |
| `/` | Public landing page and timed typing test | `POST /api/tests/start`, `POST /api/tests/:testId/submit` | Implemented. Includes loading, service recovery, live stats, completion, and responsive passage wrapping. |
| `/results` | Latest result, trend, and session history | `GET /api/stats/summary`, `GET /api/tests/history` | Implemented. Uses real data with loading, empty, and error states. |
| `/progress` | Existing progress route | No separate data contract | Preserved. Should either become a distinct dashboard after product scope is approved or redirect to `/results`; no fake analytics are shown. |
| `/certificate` | Certificate preview and checkout preparation | Uses the latest verified result from session storage | Implemented as a safe UI shell. Payment/certificate issuance remains disabled until backend APIs and payment provider are approved. |
| `/verify` | Public certificate ID verification | No certificate verification endpoint exists yet | Implemented as an honest pending state. It never claims an ID is valid without a backend record. |
| `/leaderboard` | Public ranking entry point | No leaderboard API/authentication exists | Preserved as a clearly labelled coming-soon state. No fabricated users or scores. |
| `/dev/components` | Development-only component gallery | Local only | Preserved and hidden in production. |

## Shared UI decisions

- The header and footer use the same route constants and active navigation state.
- The typing screen stays focused, while the landing page explains the product
  below the test instead of placing unsupported claims above it.
- Certificate copy uses the approved ₹21 value from the product brief, but the
  purchase action remains disabled while `NEXT_PUBLIC_CERTIFICATE_PURCHASE_ENABLED`
  is false.
- All new UI uses JavaScript/JSX and SCSS modules or the existing global SCSS
  tokens.

## Known backend-dependent work

The following should not be implemented with fake frontend data:

1. Certificate creation, payment confirmation, PDF generation, and certificate ID issuance.
2. Public certificate verification.
3. Authenticated profiles, streaks, goals, and account settings.
4. Public leaderboard, challenges, courses, and typing games.

Those can be added after their API contracts, authorization rules, and data
models are approved.
