// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntakeEstimator from './IntakeEstimator';
import InsumosTable from './InsumosTable';
import LoteForm from './LoteForm';
import { api } from '../api';
vi.mock('../api', () => ({ api: vi.fn(), number: String, displayText: String }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test('seca sends days until calving and no lactation energy or DEL', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  api.mockResolvedValue({
    cms_kg_dia: 12.21,
    inputs: { estado: 'seca', dias_ate_parto: 45 },
    source_url: null,
    notice: 'Hipótese experimental',
  });
  render(
    <IntakeEstimator
      lote={{ peso_kg: 600, estado: 'seca', dias_ate_parto: 45, ordem_paricao: 3 }}
      raca="Gir Leiteiro"
      onApply={apply}
    />,
  );
  await user.click(screen.getByText(/Sugerir consumo/));
  expect(screen.queryByText('Base da produção corrigida')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Calcular sugestão' }));
  const request = api.mock.calls[0][2];
  expect(request).toMatchObject({ estado: 'seca', dias_lactacao: null, dias_ate_parto: 45 });
  expect(request).not.toHaveProperty('leite_corrigido_kg_dia');
  expect(request).not.toHaveProperty('energia_leite_mcal_dia');
  expect(screen.queryByRole('link', { name: /Fonte e equação NASEM/ })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Aplicar sugestão' }));
  expect(apply).toHaveBeenCalledWith(12.21, { estado: 'seca', dias_ate_parto: 45 });
});

test('ingredient source assigns the requested CF', async () => {
  const change = vi.fn();
  render(
    <InsumosTable
      insumos={[{ id: 1, nome: 'Silagem', ms_pct: 35, preco_kg_mn: 1 }]}
      rows={{ 1: { selected: true } }}
      setRows={change}
      mode="formular"
    />,
  );
  await userEvent
    .setup()
    .selectOptions(screen.getByLabelText('Origem da composição Silagem'), 'usuario');
  expect(change).toHaveBeenCalledWith({
    1: expect.objectContaining({ evidencia_composicao: { source: 'usuario', cf: 0.7 } }),
  });
});

test('young lot requests maintenance and separates milk destination from economic purpose', () => {
  render(
    <LoteForm
      value={{ idade_meses: 30, ordem_paricao: 1, estado: 'lactacao', destinacao: 'leite' }}
      onChange={vi.fn()}
      racas={[]}
      save={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('PB de mantença · kg/animal/dia')).toBeTruthy();
  expect(screen.getByLabelText('EL de mantença · Mcal/animal/dia')).toBeTruthy();
  expect(screen.getByLabelText('Fonte da estimativa de mantença')).toBeTruthy();
  expect(screen.getByLabelText('Destino do leite').value).toBe('leite_fluido');
});
