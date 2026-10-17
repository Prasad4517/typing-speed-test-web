import { request } from './http';
import { API } from '@/constants/api';

export function startTest(payload) {
  return request(API.endpoints.startTest, { method: 'POST', body: payload });
}

export function submitTest(testId, payload) {
  return request(API.endpoints.submitTest(testId), {
    method: 'POST',
    body: payload,
  });
}

export function getTestHistory({ limit = 20, cursor } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return request(`${API.endpoints.history}?${params.toString()}`);
}
