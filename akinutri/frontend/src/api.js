export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const apiOrigin = new URL(API_BASE_URL);
if (
  apiOrigin.protocol !== 'http:' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(apiOrigin.hostname)
) {
  throw new Error('A API do AkiNutri deve apontar para localhost ou loopback via HTTP.');
}

export const apiUrl = (path) => `${API_BASE_URL}/api${path}`;

export async function api(path, method = 'GET', body, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
<<<<<<< HEAD
  if (response.status === 204) return null;
  const data = await response.json();
=======
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? 'A API retornou uma resposta inválida.'
        : `API indisponível (HTTP ${response.status}).`,
    );
  }
>>>>>>> 69cc92da86f2c3b0c89ecee41bd8e5faed79aef4
  if (!response.ok)
    throw new Error(
      Array.isArray(data?.detail)
        ? data.detail
            .map(
              (d) =>
                `${Array.isArray(d.loc) ? d.loc.join('.') : 'Dados'}: ${d.msg || 'Valor inválido'}`,
            )
            .join('; ')
        : typeof data?.detail === 'string'
          ? data.detail
          : `Erro na API (HTTP ${response.status}).`,
    );
  return data;
}
export const number = (v, digits = 2) =>
  v == null
    ? '—'
    : Number(v).toLocaleString('pt-BR', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
export const money = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function download(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
