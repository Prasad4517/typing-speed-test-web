export function getHealth() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

export function createHealthService({ readyCheck }) {
  return Object.freeze({
    getHealth,
    async getReadiness() {
      await readyCheck();
      return { status: 'ok', database: 'ok' };
    },
  });
}
