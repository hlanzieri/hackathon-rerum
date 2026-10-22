import { readToken } from './authToken';
export const API_BASE_URL =
  import.meta.env.PROD && typeof window !== 'undefined'
    ? window.location.origin
    : import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const apiOrigin = new URL(API_BASE_URL);
if (
  apiOrigin.protocol !== 'http:' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(apiOrigin.hostname)
) {
  throw new Error('A API do AkiNutri deve apontar para localhost ou loopback via HTTP.');
}

export const apiUrl = (path) => `${API_BASE_URL}/api${path}`;

export async function api(path, method = 'GET', body, options = {}) {
  const token = readToken();
  const response = await fetch(apiUrl(path), {
    ...options,
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (
    response.status === 401 &&
    !['/auth/me', '/auth/login', '/auth/register'].includes(path) &&
    typeof window !== 'undefined'
  ) {
    window.dispatchEvent(new Event('akinutri:unauthorized'));
  }
  if (response.status === 204) return null;
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
  if (!response.ok) {
    const error = new Error(
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
    error.status = response.status;
    error.data = data;
    throw error;
  }
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

// Presentation only: published scientific payloads, exports and audit hashes remain intact.
export const displayText = (value) =>
  String(value ?? '')
    .replace(/\bDEMO\b/g, 'referência')
    .replace(/\bdemonstrativ[oa]s?\b/gi, 'de referência')
    .replace(/demonstração|demonstracao/gi, 'exemplo didático')
    .replace(/sintétic[oa]s?|sintetic[oa]s?/gi, 'ilustrativos');
