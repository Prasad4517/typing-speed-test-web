export function createPassagesController({ service }) {
  return {
    getRandom: async (request) => service.getRandomPassage(request.query),
  };
}
