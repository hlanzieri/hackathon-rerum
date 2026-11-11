export const number = (v, digits = 2) =>
  v == null
    ? '—'
    : Number(v).toLocaleString('pt-BR', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
export const money = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
