import { ROUTES } from './routes';

export const PRIMARY_NAVIGATION = Object.freeze([
  Object.freeze({ key: 'test', label: 'Test', href: ROUTES.home }),
  Object.freeze({ key: 'progress', label: 'Progress', href: ROUTES.progress }),
  Object.freeze({
    key: 'certificates',
    label: 'Certificates',
    href: ROUTES.certificate,
  }),
  Object.freeze({
    key: 'leaderboard',
    label: 'Leaderboard',
    href: ROUTES.leaderboard,
  }),
]);
