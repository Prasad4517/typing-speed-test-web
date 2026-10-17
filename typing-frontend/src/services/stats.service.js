import { request } from './http';
import { API } from '@/constants/api';

export function getStatsSummary() {
  return request(API.endpoints.summary);
}

export function getStatsHistory(options) {
  const params = new URLSearchParams({ limit: String(options?.limit || 20) });
  if (options?.cursor) params.set('cursor', options.cursor);
  return request(`${API.endpoints.history}?${params.toString()}`);
}
