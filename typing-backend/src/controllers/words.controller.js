export function createWordsController({ service }) {
  return {
    getWords: async (request) => service.getWords(request.query),
  };
}
