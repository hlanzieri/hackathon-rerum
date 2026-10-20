export async function api(path, method = 'GET', body, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
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
