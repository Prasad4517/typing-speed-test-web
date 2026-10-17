# Keystroke 2026 redesign implementation plan

The PDF is the visual reference. Existing backend contracts remain the source
of truth for functional behaviour.

## Page order

1. **Test (`/`)** — public timed test, duration selection, keyboard shortcuts,
   responsive typing workspace, and test completion.
2. **Progress (`/progress`)** — real summary/history data from the current
   stats APIs; `/results` remains available and will share the same data.
3. **Certificates (`/certificate`)** — verified-result claim view. Issued list,
   downloads, payment confirmation, and public links wait for certificate APIs.
4. **Profile (`/profile`)** — only after authentication, profile storage, photo
   upload, and email-verification APIs are approved.

## Reusable foundation

- Semantic design tokens: colour, typography, spacing, radius, shadows, and
  responsive container width.
- Central navigation configuration in `src/constants/navigation.js`.
- Feature constants for display copy and repeated step/metric data.
- Existing shared `Button`, `Card`, `Container`, `TextField`, `StatCard`,
  `ProgressBar`, loading, empty, and error components.
- Route-aware shell/navigation variants: a focused test navigation and a
  standard top navigation for content pages.

## Non-negotiable behaviour

- No hard-coded results, issued certificates, user profiles, or leaderboard
  entries.
- Validate and retain current API/error/loading states.
- Keyboard controls remain accessible: Escape restarts the same text and Tab
  requests a new text.
- Desktop, tablet, and mobile layouts use fluid widths and tested breakpoints.
- Each page must pass lint, tests, and a production build before moving to the
  next page.
