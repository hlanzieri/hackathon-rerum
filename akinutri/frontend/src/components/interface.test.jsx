// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TracoPanel from './TracoPanel';
import InsumosTable from './InsumosTable';
import Catalogo from './Catalogo';
import { ComparisonResult } from './ComparisonPage';

afterEach(cleanup);
test('negative savings is presented as additional cost', () => {
  const diet = {
    session_id: 1,
    status: 'atende_perfil_demo',
    totals: {
      custo_animal_dia: 20,
      custo_lote_dia: 400,
      ms_kg: 20,
      pb_pct: 17,
      fdn_pct: 30,
      amido_pct: 25,
    },
  };
  render(
    <ComparisonResult
      result={{
        manual: diet,
        formulated: diet,
        economia_lote_dia: -10,
        economia_periodo: -300,
        economia_pct: -2.5,
        dias: 30,
        quantidade_animais: 20,
        equivalencia_nutricional_demo: true,
      }}
      onBatch={() => {}}
    />,
  );
  expect(screen.getByText('Custo adicional projetado para o lote')).toBeTruthy();
});
const result = {
  status: 'dados_insuficientes',
  session_id: 1,
  knowledge_version: '0.1.0',
  knowledge_sha256: 'abc',
  profile_trace: [],
  trace: [
    {
      id: 'PB-01',
      label: 'Proteína bruta',
      unit: '% MS',
      observed: null,
      minimum: 17,
      maximum: 19,
      status: 'dados_insuficientes',
    },
  ],
  items: [],
};
test('unknown nutrient has an explicit readable state badge', () => {
  render(<TracoPanel result={result} />);
  expect(screen.getAllByText('Dados Insuficientes').length).toBeGreaterThan(0);
});
test('each ingredient price is editable without altering the catalog', async () => {
  const user = userEvent.setup();
  const changes = [];
  const ingredient = {
    id: 1,
    nome: 'Silagem',
    categoria: 'volumoso',
    ms_pct: 35,
    preco_kg_mn: 0.32,
  };
  render(
    <InsumosTable
      insumos={[ingredient]}
      rows={{ 1: { selected: true, preco_kg_mn: 0.32, minimo_kg_ms: 0, maximo_kg_ms: 40 } }}
      setRows={(value) => changes.push(value)}
      mode="formular"
    />,
  );
  const price = screen.getByRole('spinbutton', { name: 'Preço MN Silagem' });
  await user.clear(price);
  await user.type(price, '1');
  expect(changes.length).toBeGreaterThan(0);
  expect(ingredient.preco_kg_mn).toBe(0.32);
});
test('catalog dialog supports Escape and restores focus', async () => {
  const user = userEvent.setup();
  render(<Catalogo insumos={[]} reload={async () => {}} />);
  const trigger = screen.getByRole('button', { name: /Novo insumo/ });
  await user.click(trigger);
  expect(screen.getByRole('dialog')).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
