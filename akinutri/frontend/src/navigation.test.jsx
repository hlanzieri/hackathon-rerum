// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import { navigate } from './navigation';
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});
const denied = () => ({
  ok: false,
  status: 401,
  json: async () => ({ detail: 'Entre na sua conta para continuar.' }),
});
test('forged browser session cannot open a protected deep link', async () => {
  sessionStorage.setItem(
    'akinutri.session.v1',
    JSON.stringify({
      version: 1,
      email: 'forged@example.com',
      role: 'consultor',
      expiresAt: Date.now() + 100000,
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => denied()),
  );
  window.history.replaceState(null, '', '/dashboard/historico');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull();
  expect(screen.queryByText('O registro de cada decisão.')).toBeNull();
  expect(window.location.pathname).toBe('/login');
});
test('failed authentication never opens the workspace', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => denied()),
  );
  window.history.replaceState(null, '', '/login');
  render(<App />);
  await screen.findByRole('heading', { name: 'Acesse sua conta' });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'wrong@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Da análise ao cocho.')).toBeNull();
});
test.each([
  ['/dashboard/historico', 'O registro de cada decisão.'],
  ['/dashboard/akibot', 'Sua dieta, passo a passo.'],
])(
  'authenticated deep link %s opens and logout removes operational content',
  async (path, heading) => {
    sessionStorage.setItem('akinutri.access_token.v1', 'server-issued-token');
    let signedIn = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).endsWith('/auth/me'))
          return signedIn
            ? {
                ok: true,
                status: 200,
                json: async () => ({
                  user: {
                    id: 1,
                    name: 'Carlos',
                    email: 'carlos@example.com',
                    role: 'zootecnista',
                    fazenda_nome: 'Fazenda',
                  },
                }),
              }
            : denied();
        if (String(url).endsWith('/auth/logout')) {
          signedIn = false;
          return { ok: true, status: 204 };
        }
        return {
          ok: true,
          status: 200,
          json: async () =>
            String(url).endsWith('/regras') ? { version: '0.1.0', sha256: 'test', rules: [] } : [],
        };
      }),
    );
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    if (path === '/dashboard/akibot') {
      expect(
        await screen.findByRole('region', { name: 'AkiBot · Assistente guiado' }),
      ).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        screen.getByRole('link', { name: 'AkiBot · Assistente' }).getAttribute('aria-current'),
      ).toBe('page');
      act(() => navigate('/dashboard/historico'));
      expect(
        await screen.findByRole('heading', { name: 'O registro de cada decisão.' }),
      ).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
    expect(screen.queryByText('O registro de cada decisão.')).toBeNull();
    expect(window.location.pathname).toBe('/login');
  },
);

test('native panel link redirects anonymous users without hashes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => denied()),
  );
  window.history.replaceState(null, '', '/');
  render(<App />);
  fireEvent.click(await screen.findByRole('link', { name: 'Acessar painel' }));
  expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  expect(window.location.pathname).toBe('/login');
  expect(window.location.hash).toBe('');
});

test('login restores the protected deep link using a server-issued token', async () => {
  let signedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (String(url).endsWith('/auth/login')) {
        signedIn = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'signed-by-server',
            token_type: 'bearer',
            user: { id: 1 },
          }),
        };
      }
      if (String(url).endsWith('/auth/me'))
        return signedIn && options.headers.Authorization === 'Bearer signed-by-server'
          ? {
              ok: true,
              status: 200,
              json: async () => ({
                user: { id: 1, name: 'Carlos', email: 'carlos@example.com', role: 'zootecnista' },
              }),
            }
          : denied();
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).endsWith('/regras') ? { version: '0.1.0', sha256: 'test', rules: [] } : [],
      };
    }),
  );
  window.history.replaceState(null, '', '/dashboard/historico');
  render(<App />);
  await screen.findByRole('heading', { name: 'Acesse sua conta' });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'carlos@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha123' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form'));
  expect(await screen.findByRole('heading', { name: 'O registro de cada decisão.' })).toBeTruthy();
  expect(window.location.pathname).toBe('/dashboard/historico');
  expect(window.location.hash).toBe('');
  act(() => navigate('/dashboard/comparacao'));
  expect(window.location.pathname).toBe('/dashboard/comparacao');
  window.history.back();
  expect(await screen.findByRole('heading', { name: 'O registro de cada decisão.' })).toBeTruthy();
  expect(window.location.pathname).toBe('/dashboard/historico');
});

test('existing hash bookmarks are replaced by clean login URLs', async () => {
  window.history.replaceState(null, '', '/#login');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  expect(window.location.pathname).toBe('/login');
  expect(window.location.hash).toBe('');
});
