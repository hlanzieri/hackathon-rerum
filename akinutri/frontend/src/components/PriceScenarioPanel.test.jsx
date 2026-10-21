// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PriceScenarioPanel, { buildPriceScenario, sameScenarioContext } from './PriceScenarioPanel';
import { api } from '../api';
vi.mock('../api', () => ({
  api: vi.fn(),
  money: (n) => `R$ ${n.toFixed(2)}`,
  number: (n) => (n == null ? '—' : Number(n).toFixed(2)),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const snapshot = {
  lote: { id: 9, quantidade: 10 },
  grupo: { id: 7, numero_animais: 10 },
  base_sha256: 'base-1',
  engine_version: '0.2.0',
  insumos: [
    { id: 1, nome: 'Silagem de Milho', preco_kg_mn: 0.3, ms_pct: 35 },
    { id: 2, nome: 'Milho Moído', preco_kg_mn: 1, ms_pct: 88 },
    { id: 3, nome: 'Farelo de Soja', preco_kg_mn: 2, ms_pct: 90 },
  ],
  request: {
    lote_id: 9,
    grupo_id: 7,
    consumo_ms_kg: 24,
    sistema: 'tmr',
    particula_adequada: true,
    milho_seco_predominante: true,
    estimativa_cms: null,
    insumos_excluidos_explicitamente: [],
    itens: [1, 2, 3].map((id) => ({
      insumo_id: id,
      preco_kg_mn: null,
      minimo_kg_ms: 0,
      maximo_kg_ms: 40,
      quantidade_kg_mn: 0,
    })),
  },
};
const result = {
  session_id: 10,
  status: 'atende_perfil_demo',
  totals: { custo_animal_dia: 20 },
  items: [
    { insumo_id: 1, quantidade_kg_mn: 35 },
    { insumo_id: 2, quantidade_kg_mn: 5 },
    { insumo_id: 3, quantidade_kg_mn: 4 },
  ],
};
function nextSnapshot(request) {
  return {
    ...snapshot,
    request,
    insumos: snapshot.insumos
      .filter((i) => request.itens.some((item) => item.insumo_id === i.id))
      .map((i) => ({
        ...i,
        preco_kg_mn: request.itens.find((item) => item.insumo_id === i.id).preco_kg_mn,
      })),
  };
}
test('price scenarios freeze historical prices, preserve constraints, and do not change silage', () => {
  const original = JSON.stringify(snapshot);
  const corn = buildPriceScenario(snapshot, 'milho');
  expect(corn.request.itens.map((i) => i.preco_kg_mn)).toEqual([0.3, 1.2, 2]);
  const soy = buildPriceScenario(snapshot, 'soja');
  expect(soy.request.itens.map((i) => i.preco_kg_mn)).toEqual([0.3, 1, 1.7]);
  expect(corn.request).toMatchObject({
    lote_id: 9,
    grupo_id: 7,
    consumo_ms_kg: 24,
    sistema: 'tmr',
  });
  expect(corn.request.itens[1].maximo_kg_ms).toBe(40);
  expect(JSON.stringify(snapshot)).toBe(original);
});
test('unavailability removes ingredient and its exclusion reference without invalid inclusion bounds', () => {
  const source = {
    ...snapshot,
    request: { ...snapshot.request, insumos_excluidos_explicitamente: [2] },
  };
  const scenario = buildPriceScenario(source, 'indisponivel', '2');
  expect(scenario.request.itens.map((i) => i.insumo_id)).toEqual([1, 3]);
  expect(scenario.request.insumos_excluidos_explicitamente).toEqual([]);
  expect(() =>
    buildPriceScenario({ ...snapshot, request: { ...snapshot.request, grupo_id: null } }, 'milho'),
  ).toThrow(/grupo de produção/);
});
test('comparison rejects changes in nutrients, group, rules or consumption', () => {
  const { request } = buildPriceScenario(snapshot, 'milho');
  const next = nextSnapshot(request);
  expect(sameScenarioContext(snapshot, next, request)).toBe(true);
  expect(sameScenarioContext(snapshot, { ...next, base_sha256: 'other' }, request)).toBe(false);
  expect(
    sameScenarioContext(
      snapshot,
      { ...next, grupo: { ...next.grupo, numero_animais: 11 } },
      request,
    ),
  ).toBe(false);
  expect(
    sameScenarioContext(snapshot, { ...next, request: { ...request, consumo_ms_kg: 22 } }, request),
  ).toBe(false);
  expect(
    sameScenarioContext(
      snapshot,
      { ...next, insumos: next.insumos.map((i) => ({ ...i, ms_pct: 50 })) },
      request,
    ),
  ).toBe(false);
});
test('simulates locally, shows monthly impact and quantities, and opens the saved result', async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  const onSaved = vi.fn();
  let sent;
  api.mockImplementation(async (path, method, payload) => {
    if (path === '/formular') {
      sent = payload;
      return { session_id: 11 };
    }
    return {
      snapshot: nextSnapshot(sent),
      result: {
        ...result,
        session_id: 11,
        totals: { custo_animal_dia: 21 },
        trace: [
          {
            id: 'PB',
            label: 'Proteína',
            status: 'atendida',
            observed: 17,
            minimum: 16,
            maximum: 20,
          },
        ],
      },
    };
  });
  render(
    <PriceScenarioPanel result={result} snapshot={snapshot} onOpen={onOpen} onSaved={onSaved} />,
  );
  await user.click(screen.getByRole('button', { name: 'Simular cenário' }));
  await user.click(screen.getByRole('button', { name: 'Recalcular dieta neste cenário' }));
  expect(api).toHaveBeenCalledWith('/formular', 'POST', expect.objectContaining({ grupo_id: 7 }));
  expect(api).toHaveBeenCalledWith('/sessoes/11');
  expect(await screen.findByText('R$ 300.00')).toBeTruthy();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(onSaved).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Abrir resultado completo do cenário' }));
  expect(onOpen).toHaveBeenCalledWith(11);
  await user.click(screen.getByRole('button', { name: /Soja 15%/ }));
  expect(screen.queryByText('R$ 300.00')).toBeNull();
});
test('infeasible scenario displays diagnosis without projected savings', async () => {
  const user = userEvent.setup();
  let sent;
  api.mockImplementation(async (path, method, payload) => {
    if (path === '/formular') {
      sent = payload;
      return { session_id: 11 };
    }
    return {
      snapshot: nextSnapshot(sent),
      result: {
        session_id: 11,
        status: 'inviavel',
        totals: null,
        message: 'Sem solução para PB',
        trace: [],
      },
    };
  });
  render(<PriceScenarioPanel result={result} snapshot={snapshot} />);
  await user.click(screen.getByRole('button', { name: 'Simular cenário' }));
  await user.click(screen.getByRole('button', { name: /Um insumo ficou/ }));
  await user.selectOptions(screen.getByLabelText('Insumo indisponível'), '2');
  await user.click(screen.getByRole('button', { name: 'Recalcular dieta neste cenário' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  expect(sent.itens.map((i) => i.insumo_id)).toEqual([1, 3]);
});
test('API failure keeps original diet and reports error', async () => {
  const user = userEvent.setup();
  api.mockRejectedValue(new Error('API indisponível'));
  render(<PriceScenarioPanel result={result} snapshot={snapshot} />);
  await user.click(screen.getByRole('button', { name: 'Simular cenário' }));
  await user.click(screen.getByRole('button', { name: 'Recalcular dieta neste cenário' }));
  expect((await screen.findByRole('alert')).textContent).toBe('API indisponível');
  expect(result.totals.custo_animal_dia).toBe(20);
});

test('retry after detail loading failure reuses the saved scenario session', async () => {
  const user = userEvent.setup();
  let request;
  let attempts = 0;
  api.mockImplementation(async (path, method, payload) => {
    if (path === '/formular') {
      request = payload;
      return { session_id: 11 };
    }
    if (++attempts === 1) throw new Error('Falha ao carregar sessão');
    return { snapshot: nextSnapshot(request), result: { ...result, session_id: 11 } };
  });
  render(<PriceScenarioPanel result={result} snapshot={snapshot} />);
  await user.click(screen.getByRole('button', { name: 'Simular cenário' }));
  await user.click(screen.getByRole('button', { name: 'Recalcular dieta neste cenário' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Falha ao carregar sessão');
  await user.click(screen.getByRole('button', { name: 'Recalcular dieta neste cenário' }));
  expect(await screen.findByText('Milho Moído 20% mais caro · Sessão #11')).toBeTruthy();
  expect(api.mock.calls.filter(([path]) => path === '/formular')).toHaveLength(1);
});
