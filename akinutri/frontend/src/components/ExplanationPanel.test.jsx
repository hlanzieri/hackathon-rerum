// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExplanationPanel, { QuestionWhy } from './ExplanationPanel';
import { api } from '../api';
vi.mock('../api', () => ({ api: vi.fn(), number: (value) => String(value) }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
test('question explanation requests its exact fact and displays the answer', async () => {
  api.mockResolvedValue({ message: 'A regra FDN-01 depende desta informação.' });
  render(<QuestionWhy fact="particula_adequada" />);
  await userEvent.click(screen.getByRole('button'));
  expect(api).toHaveBeenCalledWith('/explicacao/por-que-pergunta?fato=particula_adequada');
  expect((await screen.findByRole('status')).textContent).toContain('FDN-01');
});
test('active explanation displays provenance, CF and the requested session', async () => {
  api.mockResolvedValue({
    steps: [
      {
        round: 2,
        rule_id: 'R-02',
        premises: { phase: { value: 'transition', cf: 0.75 } },
        conclusion: 'risk',
        value: 'high',
        cf: 0.7125,
      },
    ],
  });
  render(
    <ExplanationPanel
      result={{
        session_id: 42,
        global_cf: 0.7125,
        reasoning: { certainty_notice: 'CF não é probabilidade' },
      }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Como concluiu?' }));
  expect(api).toHaveBeenCalledWith('/explicacao/como-concluiu?sessao_id=42');
  expect((await screen.findByRole('status')).textContent).toContain('R-02');
  expect(screen.getByText('CF não é probabilidade')).toBeTruthy();
});
test('explanation failure is visible and does not show stale reasoning', async () => {
  api.mockRejectedValue(new Error('Sessão não encontrada'));
  render(<ExplanationPanel result={{ session_id: 1, reasoning: {} }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Por que este perfil?' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Sessão não encontrada');
});
