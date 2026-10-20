// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.location.hash = '';
  vi.unstubAllGlobals();
});
test('public home does not request operational data', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Do lote ao vagão/ })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
test('protected deep link requires a local session', async () => {
  window.location.hash = 'historico';
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Acesse seu espaço de trabalho' }),
  ).toBeTruthy();
});
test('login validates fields without storing a password', async () => {
  window.location.hash = 'login';
  render(<App />);
  const submit = await screen.findByRole('button', { name: 'Entrar no ambiente local' });
  fireEvent.click(submit);
  expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
  expect(screen.getByText('Use ao menos 8 caracteres.')).toBeTruthy();
  expect(sessionStorage.length).toBe(0);
});
test('consultant login restores deep link, handles API failure, and logout clears session', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  window.location.hash = 'historico';
  render(<App />);
  await screen.findByRole('button', { name: 'Entrar no ambiente local' });
  fireEvent.click(screen.getByRole('radio', { name: 'Zootecnista / Consultor' }));
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'demo@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha de demonstração'), {
    target: { value: 'ficticia123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar no ambiente local' }));
  expect(
    await screen.findByRole('heading', { name: 'O registro de cada decisão.' }, { timeout: 5000 }),
  ).toBeTruthy();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  expect(JSON.parse(sessionStorage.getItem('akinutri.session.v1')).role).toBe('consultor');
  expect(sessionStorage.getItem('akinutri.session.v1')).not.toContain('ficticia123');
  fireEvent.click(screen.getByRole('button', { name: 'Sair / trocar perfil' }));
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Acesse seu espaço de trabalho' })).toBeTruthy(),
  );
  expect(sessionStorage.getItem('akinutri.session.v1')).toBeNull();
});
