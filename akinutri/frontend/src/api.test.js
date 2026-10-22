import { afterEach, expect, test, vi } from 'vitest';
import { api } from './api';
afterEach(() => vi.unstubAllGlobals());
test('unavailable API provides a useful error instead of a JSON parse exception', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new SyntaxError('html');
      },
    }),
  );
  await expect(api('/regras')).rejects.toThrow('API indisponível (HTTP 503).');
});
test('invalid successful response is not accepted as diet data', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('html');
      },
    }),
  );
  await expect(api('/formular', 'POST', {})).rejects.toThrow(
    'A API retornou uma resposta inválida.',
  );
});

test.each([400, 422, 500])(
  'preserves structured HTTP %s errors for the assistant',
  async (status) => {
    const data = { detail: [{ loc: ['body', 'grupo_id'], msg: 'Field required' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status, json: async () => data }),
    );
    await expect(api('/formular', 'POST', {})).rejects.toMatchObject({
      status,
      data,
      message: 'body.grupo_id: Field required',
    });
  },
);
