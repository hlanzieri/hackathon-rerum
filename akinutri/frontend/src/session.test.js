// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { createSession, readSession, clearSession, SESSION_KEY, SESSION_DURATION } from './session';
afterEach(() => sessionStorage.clear());
test('session keeps normalized identity and profile without password', () => {
  const value = createSession('  DEMO@example.com ', 'consultor');
  expect(readSession()).toEqual(value);
  expect(value.email).toBe('demo@example.com');
  expect(Object.keys(value).sort()).toEqual(['email', 'expiresAt', 'role', 'version']);
  clearSession();
  expect(readSession()).toBeNull();
});
test.each([
  '{broken',
  JSON.stringify({
    version: 1,
    email: 'demo@example.com',
    role: 'admin',
    expiresAt: Date.now() + 10000,
  }),
  JSON.stringify({
    version: 1,
    email: 'demo@example.com',
    role: 'produtor',
    expiresAt: Date.now() - 1,
  }),
  JSON.stringify({
    version: 1,
    email: 'demo@example.com',
    role: 'produtor',
    expiresAt: Date.now() + SESSION_DURATION * 2,
  }),
])('rejects malformed, expired, or unsupported session: %s', (raw) => {
  sessionStorage.setItem(SESSION_KEY, raw);
  expect(readSession()).toBeNull();
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
});
