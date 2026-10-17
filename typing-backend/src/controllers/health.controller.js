export function createHealthController({ service }) {
  return {
    getHealth: async () => service.getHealth(),
    getReadiness: async () => service.getReadiness(),
  };
}
