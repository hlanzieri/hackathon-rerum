// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import RationPreview from './RationPreview';
import LoginPage from './LoginPage';
import NutrientRange from './NutrientRange';
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
test('preview slider selects a frozen Python result without claiming a prescription', () => {
  render(<RationPreview />);
  const initial = screen.getByLabelText('Custo de referência por animal e dia').textContent;
  fireEvent.change(screen.getByRole('slider', { name: 'Leite corrigido · kg/animal/dia' }), {
    target: { value: '40' },
  });
  expect(screen.getByLabelText('Custo de referência por animal e dia').textContent).not.toBe(
    initial,
  );
  expect(screen.getByText(/Resultados pré-calculados em Python/)).toBeTruthy();
});
test('login provides credential entry without demonstration shortcuts', () => {
  render(<LoginPage />);
  expect(screen.getByLabelText('E-mail')).toBeTruthy();
  expect(screen.getByLabelText('Senha')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Demo produtor|Demo consultor/ })).toBeNull();
});
test('audit range exposes missing observation instead of drawing an invented value', () => {
  render(
    <NutrientRange
      rule={{
        id: 'PB01',
        label: 'Proteína bruta',
        minimum: 17,
        maximum: 19,
        observed: null,
        unit: '% MS',
      }}
    />,
  );
  expect(screen.getByText('Valor não informado')).toBeTruthy();
  expect(screen.queryByRole('meter')).toBeNull();
});
