export const ROUTES = Object.freeze({
  home: '/',
  results: '/results',
  progress: '/progress',
  certificate: '/certificate',
  verify: '/verify',
  leaderboard: '/leaderboard',
  verifyById: (id) => `/verify/${encodeURIComponent(id)}`,
  certificateById: (id) => `/certificate/${encodeURIComponent(id)}`,
});
