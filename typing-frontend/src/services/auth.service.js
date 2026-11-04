import { API } from '@/constants/api';

import {
  clearAccessSession,
  establishAccessSession,
  refreshAccessSession,
  subscribeAuthSession,
  terminateAccessSession,
} from './auth-client';
import { request } from './http';

const PUBLIC_REQUEST = Object.freeze({ auth: false, retryAuth: false });

function userFrom(payload) {
  return payload?.user || payload;
}

export function signUp(payload) {
  return request(API.endpoints.signUp, {
    ...PUBLIC_REQUEST,
    method: 'POST',
    body: payload,
  });
}

export async function signIn(payload) {
  return establishAccessSession(() =>
    request(API.endpoints.signIn, {
      ...PUBLIC_REQUEST,
      method: 'POST',
      body: payload,
    }),
  );
}

export const login = signIn;

export function refreshSession() {
  return refreshAccessSession();
}

export const coordinatedRefresh = refreshSession;

export async function bootstrapSession() {
  await refreshSession();
  const user = await getCurrentUser();
  return { user };
}

async function endSession(endpoint) {
  return terminateAccessSession((accessToken) =>
    request(endpoint, {
      method: 'POST',
      authToken: accessToken,
      retryAuth: false,
    }),
  );
}

export function logout() {
  return endSession(API.endpoints.logout);
}

export function logoutAll() {
  return endSession(API.endpoints.logoutAll);
}

export async function getCurrentUser() {
  return userFrom(await request(API.endpoints.currentUser));
}

export async function updateCurrentUser(payload) {
  return userFrom(
    await request(API.endpoints.currentUser, {
      method: 'PATCH',
      body: payload,
    }),
  );
}

export function verifyEmail(payload) {
  return request(API.endpoints.verifyEmail, {
    ...PUBLIC_REQUEST,
    method: 'POST',
    body: payload,
  });
}

export function resendVerification(payload) {
  return request(API.endpoints.resendVerification, {
    ...PUBLIC_REQUEST,
    method: 'POST',
    body: payload,
  });
}

export function requestPasswordReset(payload) {
  return request(API.endpoints.forgotPassword, {
    ...PUBLIC_REQUEST,
    method: 'POST',
    body: payload,
  });
}

export function resetPassword(payload) {
  return request(API.endpoints.resetPassword, {
    ...PUBLIC_REQUEST,
    method: 'POST',
    body: payload,
  });
}

export function changePassword(payload) {
  return request(API.endpoints.changePassword, {
    method: 'POST',
    body: payload,
  });
}

export async function getSessions() {
  const response = await request(API.endpoints.sessions);
  return response?.sessions || response || [];
}

export function revokeSession(sessionId) {
  return request(API.endpoints.session(sessionId), { method: 'DELETE' });
}

export function getUserDashboard() {
  return request(API.endpoints.userDashboard);
}

export function getAdminDashboard() {
  return request(API.endpoints.adminDashboard);
}

export function clearAuthState({ broadcast = true } = {}) {
  clearAccessSession({ broadcast });
}

export const invalidateAuthSession = clearAuthState;
export { subscribeAuthSession };
