// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TracoPanel from './TracoPanel';
import InsumosTable from './InsumosTable';
import Catalogo from './Catalogo';
import { ComparisonResult } from './ComparisonPage';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import AnimaisPage from './AnimaisPage';
import AnimalTimeline from './AnimalTimeline';
import App from '../App';
import { API_BASE_URL, apiUrl } from '../api';

afterEach(cleanup);
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
test('frontend API is restricted to the local backend', () => {
  expect(API_BASE_URL).toBe('http://localhost:8000');
  expect(apiUrl('/health')).toBe('http://localhost:8000/api/health');
});
test('animal timeline renders GP phase, diet ingredients, and accumulated cost', () => {
  render(
    <AnimalTimeline
      history={{
        custo_diario_acumulado: 8.5,
        linha_tempo: [
          {
            data_inicio: '2026-10-01',
            data_fim: '2026-10-02',
            dias: 2,
            custo_diario: 4.25,
            custo_periodo: 8.5,
            custo_acumulado: 8.5,
            grupo_producao: { id: 1, nome: 'Recria 1', fase: 'recria' },
            dieta: {
              sessao_id: 7,
              ingredientes: [
                {
                  insumo_id: 1,
                  nome: 'Silagem de milho',
                  quantidade_kg_mn: 10,
                  custo_diario: 4.25,
                },
              ],
            },
          },
        ],
      }}
    />,
  );
  expect(screen.getByText('Recria')).toBeTruthy();
  expect(screen.getByText('Dieta ativa · Sessão #7')).toBeTruthy();
  expect(screen.getByText(/Silagem de milho/)).toBeTruthy();
  expect(screen.getAllByText(/R\$\s?8,50/).length).toBeGreaterThan(0);
});
test('animal and group screen offers lifecycle registration and GP diet controls', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url) => {
      const payload = String(url).includes('/grupos-producao')
        ? []
        : String(url).includes('/animais')
          ? []
          : [];
      return { ok: true, status: 200, json: async () => payload };
    }),
  );
  render(<AnimaisPage />);
  expect(await screen.findByRole('heading', { name: 'Novo grupo de produção' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Novo animal' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Grupos de produção' })).toBeTruthy();
});
test('animais path opens the lifecycle module from app navigation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).endsWith('/auth/me')
          ? { user: { id: 1, name: 'Pessoa', email: 'pessoa@example.com', role: 'produtor' } }
          : String(url).endsWith('/regras')
            ? { version: '0.1.0', sha256: 'test', rules: [] }
            : [],
    })),
  );
  sessionStorage.setItem('akinutri.access_token.v1', 'issued-token');
  window.history.replaceState(null, '', '/dashboard/animais');
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Novo grupo de produção' }, { timeout: 5000 }),
  ).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Animais e GP' }).getAttribute('aria-current')).toBe(
    'page',
  );
  window.history.replaceState(null, '', '/');
});
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
test('missing composition lists nutrients and exposes audited exclusion and fill actions', async () => {
  const user = userEvent.setup();
  const onExclude = vi.fn();
  const onFill = vi.fn();
  render(
    <TracoPanel
      result={{
        ...result,
        insumos_incompletos: [
          {
            insumo_id: 12,
            nome: 'Mistura mineral referência',
            nutrientes_faltantes: ['PB', 'FDN'],
          },
        ],
        mensagem: 'Composição nutricional incompleta em insumos selecionados.',
      }}
      onExclude={onExclude}
      onFill={onFill}
    />,
  );
  expect(screen.getByText('Mistura mineral referência')).toBeTruthy();
  expect(screen.getByText('Faltam: PB, FDN')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Excluir da Formulação (Auditado)' }));
  expect(onExclude).toHaveBeenCalledWith(12);
  await user.click(screen.getByRole('button', { name: 'Preencher Dados' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  await user.type(screen.getByRole('spinbutton', { name: 'Proteína bruta (PB) %' }), '18');
  await user.type(screen.getByRole('spinbutton', { name: 'FDN %' }), '32');
  await user.click(screen.getByRole('button', { name: 'Salvar e reformular' }));
  expect(onFill).toHaveBeenCalledWith(12, { pb_pct: 18, fdn_pct: 32 });
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
test('login submits credentials and redirects after success', async () => {
  const user = userEvent.setup();
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      access_token: 'signed-token',
      token_type: 'bearer',
      user: { id: 1, email: 'pessoa@exemplo.com', name: 'Pessoa' },
    }),
  });
  vi.stubGlobal('fetch', fetch);
  window.history.replaceState(null, '', '/login');
  render(<LoginPage />);
  await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
  await user.type(screen.getByLabelText('Senha'), 'senha-segura');
  await user.click(screen.getByLabelText('Manter conectado'));
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        email: 'pessoa@exemplo.com',
        password: 'senha-segura',
        remember: true,
      }),
    }),
  );
  expect(window.location.pathname).toBe('/dashboard');
});
test('login password visibility can be toggled', async () => {
  const user = userEvent.setup();
  render(<LoginPage />);
  const password = screen.getByLabelText('Senha');
  expect(password.type).toBe('password');
  await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
  expect(password.type).toBe('text');
  await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));
  expect(password.type).toBe('password');
});
test('login hash opens the page without starting the workspace', async () => {
  window.history.replaceState(null, '', '/login');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  window.history.replaceState(null, '', '/');
});
test('register path opens the account creation page', async () => {
  window.history.replaceState(null, '', '/register');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Crie sua conta' })).toBeTruthy();
  window.history.replaceState(null, '', '/');
});
test('login shows API errors and disables submission while loading', async () => {
  const user = userEvent.setup();
  let resolveResponse;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    ),
  );
  render(<LoginPage />);
  await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
  await user.type(screen.getByLabelText('Senha'), 'senha-incorreta');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(screen.getByRole('button', { name: 'Entrando...' }).disabled).toBe(true);
  resolveResponse({
    ok: false,
    json: async () => ({ detail: 'E-mail ou senha inválidos.' }),
  });
  expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha inválidos.');
  expect(screen.getByRole('button', { name: 'Entrar' }).disabled).toBe(false);
});
test('register checks matching passwords before sending a request', async () => {
  const user = userEvent.setup();
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<RegisterPage />);
  await user.type(screen.getByLabelText('Nome'), 'Pessoa');
  await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
  await user.type(screen.getByLabelText('Senha', { selector: 'input' }), 'senha-segura-123');
  await user.type(screen.getByLabelText('Confirmar senha'), 'senha-diferente-123');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('As senhas não coincidem.');
});
test('register sends account fields and redirects after success', async () => {
  const user = userEvent.setup();
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      access_token: 'signed-token',
      token_type: 'bearer',
      user: { id: 1, email: 'pessoa@exemplo.com', name: 'Pessoa' },
    }),
  });
  vi.stubGlobal('fetch', fetch);
  window.location.hash = '';
  render(<RegisterPage />);
  await user.type(screen.getByLabelText('Nome'), 'Pessoa');
  await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
  await user.type(screen.getByLabelText('Senha', { selector: 'input' }), 'senha-segura-123');
  await user.type(screen.getByLabelText('Confirmar senha'), 'senha-segura-123');
  await user.selectOptions(screen.getByLabelText('Perfil'), 'zootecnista');
  await user.type(screen.getByLabelText('Nome da fazenda'), 'Fazenda Teste');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/auth/register',
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        nome: 'Pessoa',
        email: 'pessoa@exemplo.com',
        senha: 'senha-segura-123',
        cargo: 'zootecnista',
        fazenda_nome: 'Fazenda Teste',
      }),
    }),
  );
  expect(window.location.pathname).toBe('/dashboard');
});
