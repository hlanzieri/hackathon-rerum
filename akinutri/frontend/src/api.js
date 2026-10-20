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
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(data.detail)
        ? data.detail.map((d) => `${d.loc.join('.')}: ${d.msg}`).join('; ')
        : data.detail || 'Erro na API.',
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
