import { STORAGE_KEYS } from '@/constants/storage-keys';
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createUuidV4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}

export function getClientId() {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(STORAGE_KEYS.clientId);
  if (existing && UUID_V4_PATTERN.test(existing)) return existing;

  const clientId = createUuidV4();
  window.localStorage.setItem(STORAGE_KEYS.clientId, clientId);
  return clientId;
}
