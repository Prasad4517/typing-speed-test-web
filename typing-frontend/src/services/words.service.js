import { request } from './http';
import { API } from '@/constants/api';

export function getWords({ count = 50, language = 'en' } = {}) {
  const params = new URLSearchParams({ count: String(count), language });
  return request(`${API.endpoints.words}?${params.toString()}`);
}
