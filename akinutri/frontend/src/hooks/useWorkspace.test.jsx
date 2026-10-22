// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import useWorkspace from './useWorkspace';
import { api } from '../api';
vi.mock('../api', () => ({ api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test('opening a saved formulation restores its inputs and verification retains the same group', async () => {
  const lot = {
    id: 9,
    nome: 'Lote salvo',
    estado: 'lactacao',
    peso_kg: 650,
    dias_lactacao: 100,
    quantidade: 40,
  };
  const group = {
    id: 7,
    nome: 'Grupo salvo',
    fase: 'lactacao',
    numero_animais: 7,
    del_medio: 160,
    peso_medio_kg: 500,
    producao_media_l_dia: 15,
    ecc_medio: 3,
    fracao_multiparas: 1,
  };
  const snapshot = {
    lote: lot,
    grupo: group,
    insumos: [{ id: 1, preco_kg_mn: 0.5 }],
    request: {
      lote_id: 9,
      grupo_id: 7,
      consumo_ms_kg: 16,
      sistema: 'tmr',
      particula_adequada: true,
      milho_seco_predominante: true,
      itens: [
        { insumo_id: 1, quantidade_kg_mn: 0, minimo_kg_ms: 0, maximo_kg_ms: 40, preco_kg_mn: null },
      ],
    },
  };
  const saved = {
    modo: 'formular',
    snapshot,
    result: { session_id: 42, items: [{ insumo_id: 1, quantidade_kg_mn: 35 }] },
  };
  api.mockImplementation(async (path) => {
    if (path === '/insumos') return [{ id: 1, nome: 'Silagem', preco_kg_mn: 1 }];
    if (path === '/grupos-producao') return [group];
    if (path === '/lotes') return [lot];
    if (path === '/regras') return { version: '0.1.0' };
    if (path.startsWith('/sessoes/')) return saved;
    if (path === '/verificar') return { session_id: 43 };
    return [];
  });
  const { result } = renderHook(() => useWorkspace());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.openSession(42)).toBe(true);
  });
  expect(result.current.lote.nome).toBe('Lote salvo');
  expect(result.current.lote).not.toHaveProperty('id');
  expect(result.current.rows[1].preco_kg_mn).toBe(0.5);
  expect(result.current.intake).toBe(16);
  act(() => result.current.useFormulated());
  await act(async () => {
    await result.current.run();
  });
  expect(api).toHaveBeenCalledWith(
    '/verificar',
    'POST',
    expect.objectContaining({
      lote_id: 9,
      grupo_id: 7,
      consumo_ms_kg: 16,
      itens: [expect.objectContaining({ quantidade_kg_mn: 35, preco_kg_mn: 0.5 })],
    }),
  );
});

test('new formulation ignores empty current-ration quantities but verification requires them', async () => {
  const group = {
    id: 7,
    fase: 'lactacao',
    numero_animais: 20,
    del_medio: 100,
    peso_medio_kg: 650,
    producao_media_l_dia: 35,
    ecc_medio: 3,
    fracao_multiparas: 1,
  };
  api.mockImplementation(async (path) => {
    if (path === '/insumos') return [{ id: 1, nome: 'Silagem', preco_kg_mn: 0.3 }];
    if (path === '/grupos-producao') return [group];
    if (path === '/regras') return { version: '0.1.0' };
    if (path === '/formular') return { session_id: 42 };
    if (path === '/sessoes/42') return { snapshot: {} };
    return [];
  });
  const { result } = renderHook(() => useWorkspace());
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    result.current.selectGrupo('7');
    result.current.setLoteId(9);
    result.current.setRows({
      1: {
        selected: true,
        quantidade_kg_mn: '',
        minimo_kg_ms: 0,
        maximo_kg_ms: 40,
        preco_kg_mn: 0.3,
      },
    });
  });
  await act(async () => {
    await result.current.run();
  });
  expect(api).toHaveBeenCalledWith(
    '/formular',
    'POST',
    expect.objectContaining({
      grupo_id: 7,
      itens: [expect.not.objectContaining({ quantidade_kg_mn: expect.anything() })],
    }),
  );
  act(() => result.current.setMode('verificar'));
  await act(async () => {
    await result.current.run();
  });
  expect(result.current.error).toContain('campo vazio não significa zero');
  expect(api.mock.calls.some(([path]) => path === '/verificar')).toBe(false);
});
