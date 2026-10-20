// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Footer from './Footer';

afterEach(cleanup);

test('institutional footer shows the loaded knowledge-base audit values', () => {
  render(
    <Footer
      base={{
        version: '0.1.0',
        sha256: '0123456789abcdef',
      }}
    />,
  );

  expect(screen.getByText('v0.1.0 (base_v0.1.0.json)')).toBeTruthy();
  expect(screen.getByText('SHA-256: 0123456789abcdef')).toBeTruthy();
  expect(screen.getByText('Base carregada e identificada')).toBeTruthy();
});

test('system links open existing local routes and documentation', () => {
  render(<Footer base={null} />);

  expect(screen.getByRole('link', { name: /Documentação da API/ }).getAttribute('href')).toBe(
    '/docs',
  );
  expect(
    screen
      .getByRole('link', { name: /Visualizar JSON da Base de Conhecimento/ })
      .getAttribute('href'),
  ).toBe('/dashboard/regras');
  expect(screen.getByRole('link', { name: /Roteiro de Apresentação/ }).getAttribute('href')).toBe(
    'https://github.com/hlanzieri/hackathon-rerum/blob/main/akinutri/docs/APRESENTACAO.md',
  );
});
