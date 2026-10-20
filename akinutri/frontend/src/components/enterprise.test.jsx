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
  const initial = screen.getByLabelText('Custo demonstrativo por animal e dia').textContent;
  fireEvent.change(screen.getByRole('slider', { name: 'Leite corrigido · kg/animal/dia' }), {
    target: { value: '40' },
  });
  expect(screen.getByLabelText('Custo demonstrativo por animal e dia').textContent).not.toBe(
    initial,
  );
  expect(screen.getByText(/Resultados pré-calculados em Python/)).toBeTruthy();
});
test('quick demo enters selected persona without personal credentials', () => {
  let session;
  render(
    <LoginPage
      onLogin={(value) => {
        session = value;
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Demo consultor' }));
  expect(session.role).toBe('consultor');
  expect(session.email).toBe('consultor@demo.akinutri.local');
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
