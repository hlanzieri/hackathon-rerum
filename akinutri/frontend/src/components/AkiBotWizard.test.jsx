// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AkiBotWizard, { defaultLactationIds } from './AkiBotWizard';
import { api } from '../api';
vi.mock('../api', () => ({ api: vi.fn(), number: (v) => String(v) }));
const workspace = {
  insumos: [{ id: 1, nome: 'Silagem de Milho', preco_kg_mn: 0.3, categoria: 'volumoso' }],
  racas: [{ id: 1, nome: 'Holandesa' }],
  grupos: [
    {
      id: 7,
      nome: 'Grupo A',
      ativo: true,
      fase: 'lactacao',
      numero_animais: 20,
      peso_medio_kg: 650,
      del_medio: 100,
      producao_media_l_dia: 35,
      ecc_medio: 3,
      fracao_multiparas: 1,
    },
  ],
};
beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);
test('default shortcut prefers complete composition and selects one ingredient per type', () => {
  const complete = {
    ms_pct: 35,
    pb_pct: 8,
    fdn_pct: 45,
    amido_pct: 30,
    el_mcal_kg: 1.5,
    ca_pct: 0.25,
    p_pct: 0.22,
  };
  expect(
    defaultLactationIds([
      { id: 1, nome: 'Silagem de Milho particular', ca_pct: null },
      { id: 2, nome: 'Silagem de Milho', ...complete },
      { id: 3, nome: 'Farelo de Soja', ...complete },
      { id: 4, nome: 'Milho Moído', ...complete },
    ]),
  ).toEqual([2, 3, 4]);
});
async function advance(user) {
  await user.click(screen.getByRole('button', { name: 'Avançar' }));
}
async function start(user, onComplete = vi.fn()) {
  render(<AkiBotWizard workspace={workspace} onComplete={onComplete} />);
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(true);
  await user.selectOptions(screen.getByLabelText('Grupo de produção'), '7');
  await advance(user);
  await user.type(screen.getByLabelText('CMS · kg MS/animal/dia'), '24');
}
test('formulates via local contracts after NASEM and group selection', async () => {
  const user = userEvent.setup();
  const complete = vi.fn();
  api.mockImplementation(async (path) => {
    if (path === '/estimar-cms') return { cms_kg_dia: 23, inputs: { peso_kg: 650 } };
    if (path === '/lotes') return { id: 9 };
    return { session_id: 42 };
  });
  await start(user, complete);
  await user.click(screen.getByRole('button', { name: 'Usar Sugestão Automática NASEM 2021' }));
  await advance(user);
  await user.click(screen.getByRole('button', { name: 'Usar Insumos Padrão de Lactação' }));
  await advance(user);
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(false);
  await advance(user);
  await user.click(screen.getByRole('button', { name: /Processar Análise/ }));
  expect(api).toHaveBeenCalledWith(
    '/formular',
    'POST',
    expect.objectContaining({
      lote_id: 9,
      grupo_id: 7,
      consumo_ms_kg: 23,
      estimativa_cms: { peso_kg: 650 },
    }),
  );
  expect(complete).toHaveBeenCalledWith(42);
});
test('verification requires quantities, preserves manual CMS and price, and permits retry without duplicating lot', async () => {
  const user = userEvent.setup();
  api.mockImplementation(async (path) => {
    if (path === '/lotes') return { id: 9 };
    throw new Error('Motor indisponível');
  });
  await start(user);
  await user.click(screen.getByRole('button', { name: 'Ajustar Consumo Manualmente' }));
  await user.clear(screen.getByLabelText('CMS · kg MS/animal/dia'));
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(true);
  await user.type(screen.getByLabelText('CMS · kg MS/animal/dia'), '22');
  await advance(user);
  await user.click(screen.getByRole('button', { name: 'Usar Insumos Padrão de Lactação' }));
  await user.clear(screen.getByLabelText(/Preço de/));
  await user.type(screen.getByLabelText(/Preço de/), '0.5');
  await advance(user);
  await user.click(screen.getByRole('button', { name: /Verificar Balanço/ }));
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(true);
  await user.type(screen.getByLabelText(/Quantidade de/), '35');
  await advance(user);
  await user.click(screen.getByRole('button', { name: /Processar Análise/ }));
  expect(screen.getByRole('alert').textContent).toBe('Motor indisponível');
  await user.click(screen.getByRole('button', { name: /Processar Análise/ }));
  expect(api.mock.calls.filter(([path]) => path === '/lotes')).toHaveLength(1);
  const payload = api.mock.calls.find(([path]) => path === '/verificar')[2];
  expect(payload).toMatchObject({
    consumo_ms_kg: 22,
    estimativa_cms: null,
    itens: [{ insumo_id: 1, preco_kg_mn: 0.5, quantidade_kg_mn: 35 }],
  });
  expect(payload.grupo_id).toBe(7);
});
test('unavailable NASEM estimate displays backend explanation and retains profile intake', async () => {
  const user = userEvent.setup();
  api.mockResolvedValue({ cms_kg_dia: null, message: 'Fora do escopo NASEM' });
  await start(user);
  await user.click(screen.getByRole('button', { name: 'Usar Sugestão Automática NASEM 2021' }));
  expect(screen.getByRole('alert').textContent).toBe('Fora do escopo NASEM');
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(false);
});

test('retry after result loading failure reopens saved session without another formulation', async () => {
  const user = userEvent.setup();
  const complete = vi
    .fn()
    .mockRejectedValueOnce(new Error('Falha ao abrir resultado'))
    .mockResolvedValue(true);
  api.mockImplementation(async (path) => (path === '/lotes' ? { id: 9 } : { session_id: 42 }));
  await start(user, complete);
  await advance(user);
  await user.click(screen.getByRole('button', { name: 'Usar Insumos Padrão de Lactação' }));
  await advance(user);
  await advance(user);
  await user.click(screen.getByRole('button', { name: /Processar Análise/ }));
  expect(screen.getByRole('alert').textContent).toBe('Falha ao abrir resultado');
  await user.click(screen.getByRole('button', { name: /Processar Análise/ }));
  expect(api.mock.calls.filter(([path]) => path === '/formular')).toHaveLength(1);
  expect(complete).toHaveBeenCalledTimes(2);
});

test('group is required first and changing it clears consumption and saved context', async () => {
  const user = userEvent.setup();
  render(<AkiBotWizard workspace={workspace} onComplete={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(true);
  expect(screen.queryByLabelText('CMS · kg MS/animal/dia')).toBeNull();
  await user.selectOptions(screen.getByLabelText('Grupo de produção'), '7');
  expect(screen.getByText(/20 animais/)).toBeTruthy();
  await advance(user);
  await user.type(screen.getByLabelText('CMS · kg MS/animal/dia'), '22');
  await user.click(screen.getByRole('button', { name: 'Voltar' }));
  await user.selectOptions(screen.getByLabelText('Grupo de produção'), '');
  expect(screen.getByRole('button', { name: 'Avançar' }).disabled).toBe(true);
});
