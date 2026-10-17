import { API } from '@/constants/api';

import { request } from './http';

export function signUp(payload) {
  return request(API.endpoints.signUp, { method: 'POST', body: payload });
}

export function login(payload) {
  return request(API.endpoints.login, { method: 'POST', body: payload });
}

export function refreshSession() {
  return request(API.endpoints.refresh, { method: 'POST' });
}

export function logout() {
  return request(API.endpoints.logout, { method: 'POST' });
}

export function logoutAll() {
  return request(API.endpoints.logoutAll, { method: 'POST' });
}

export function getCurrentUser() {
  return request(API.endpoints.currentUser);
}

export function updateCurrentUser(payload) {
  return request(API.endpoints.currentUser, { method: 'PATCH', body: payload });
}

export function requestPasswordReset(payload) {
  return request(API.endpoints.forgotPassword, {
    method: 'POST',
    body: payload,
  });
}

export function resetPassword(payload) {
  return request(API.endpoints.resetPassword, {
    method: 'POST',
    body: payload,
  });
}
