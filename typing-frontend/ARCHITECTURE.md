# Frontend architecture

The frontend is JavaScript/JSX only. Next.js route files under `src/app/` stay thin and compose feature components. Interactive leaves use `'use client'`; static content remains server-rendered where possible.

## Boundaries

```text
app route -> feature -> common-components / services / store -> backend API
```

- `app/` contains route composition, metadata, and route-level loading/error states.
- `features/` owns page and product behavior. A feature must not import another feature.
- `common-components/` is presentation-only and must not import features, stores, or API services.
- `layouts/` owns the application shell, header, footer, and global navigation.
- `services/` owns API calls; `http.js` owns headers, timeouts, and standard API errors.
- `store/` owns cross-component client state. Live typing interaction remains isolated to the typing feature.
- `lib/`, `hooks/`, and `utils/` contain reusable infrastructure and pure helpers.
- `styles/` owns SCSS tokens, themes, mixins, and global primitives. Component-specific styles use SCSS modules.

## Constants

Reusable paths, API endpoints, storage keys, test configuration, themes, feature flags, messages, and validation limits live in `src/constants/`. Each constants module uses frozen exports. Contract constants intentionally mirror backend values and must stay aligned with `typing-backend/docs/API.md`.

Components must not contain hard-coded route names, storage keys, API paths, statuses, or repeated user-facing messages. Feature-specific copy belongs in its feature folder; shared copy belongs in `constants/messages.js`.

## UI rules

- Common controls are added once under `src/common-components/<ComponentName>/` and exported from `src/common-components/index.js`.
- Components accept props, render UI, forward useful attributes, and do not make API calls.
- Variants use props and data/class attributes; colors and spacing come from CSS custom properties.
- Focus states, labels, keyboard operation, reduced motion, and touch targets are built into shared components.
- Heavy charts are loaded with `next/dynamic` and a reserved skeleton area.
- `/dev/components` is a development-only gallery for all shared component states.
