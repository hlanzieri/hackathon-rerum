// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import App from './App';
import useAuth from './hooks/useAuth';
beforeEach(() => sessionStorage.setItem('akinutri.access_token.v1', 'issued-token'));
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
test('dashboard stays hidden until server confirms the session', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  window.history.replaceState(null, '', '/dashboard');
  render(React.createElement(App));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(screen.queryByText('Da análise ao cocho.')).toBeNull();
});

test.each([60, 30 * 24 * 60 * 60])(
  'server expiration removes the authenticated identity after %i seconds',
  async (lifetime) => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++calls === 1
          ? {
              ok: true,
              status: 200,
              json: async () => ({
                user: { id: 1, email: 'operator@example.com' },
                expires_at: Math.floor(Date.now() / 1000) + lifetime,
              }),
            }
          : { ok: false, status: 401, json: async () => ({ detail: 'Sessão expirada.' }) },
      ),
    );
    try {
      const { result } = renderHook(() => useAuth());
      await act(async () => {});
      expect(result.current.user.id).toBe(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(lifetime * 1000 + 1000);
      });
      expect(result.current.user).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  },
);

test('an older unauthorized session check cannot erase a newer login', async () => {
  let resolveFirst;
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      ++calls === 1
        ? new Promise((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ user: { id: 2, email: 'new@example.com' } }),
          }),
    ),
  );
  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.user.id).toBe(2);
  await act(async () => {
    resolveFirst({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Sessão anterior expirada.' }),
    });
  });
  expect(result.current.user.id).toBe(2);
});
