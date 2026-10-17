import { request } from './http';
import { API } from '@/constants/api';

export function getRandomPassage({ difficulty, exclude = [] } = {}) {
  const params = new URLSearchParams();
  if (difficulty) params.set('difficulty', difficulty);
  if (exclude.length) params.set('exclude', exclude.join(','));
  const query = params.toString();
  return request(`${API.endpoints.randomPassage}${query ? `?${query}` : ''}`);
}
