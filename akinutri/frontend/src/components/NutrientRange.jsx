import React from 'react';
import { number } from '../api';
export default function NutrientRange({ rule }) {
  const { minimum: lo, maximum: hi, observed: value } = rule;
  if (![lo, hi, value].every((v) => typeof v === 'number' && Number.isFinite(v)))
    return <p className="range-missing">Valor não informado</p>;
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 0.001);
  const start = Math.min(lo - span * 0.4, value - span * 0.1);
  const end = Math.max(hi + span * 0.4, value + span * 0.1);
  const pct = (n) => Math.max(0, Math.min(100, ((n - start) / (end - start)) * 100));
  return (
    <div className="audit-range">
      <div className="range-labels">
        <span>MÍN. {number(lo, 2)}</span>
        <strong>
          OBS. {number(value, 3)} {rule.unit}
        </strong>
        <span>MÁX. {number(hi, 2)}</span>
      </div>
      <div
        className="range-track"
        role="img"
        aria-label={`${rule.label}: mínimo ${lo}, observado ${value}, máximo ${hi} ${rule.unit}`}
      >
        <span
          className="range-allowed"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
        />
        <span className="range-pin" style={{ left: `${pct(value)}%` }} />
      </div>
      <p>Faixa da regra · a posição visual não altera a avaliação do motor.</p>
    </div>
  );
}
