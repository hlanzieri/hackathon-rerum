import React, { useState } from 'react';
import { ArrowRight, GitCompareArrows, Download } from 'lucide-react';
import { api, number, money, download } from '../api';
import { statusLabel } from './TracoPanel';

export function ComparisonResult({ result, onBatch }) {
  return (
    <div className="comparison-result">
      <div className={`savings-panel ${result.economia_lote_dia < 0 ? 'cost-increase' : ''}`}>
        <div>
          <span>
            {result.economia_lote_dia < 0
              ? 'Custo adicional projetado para o lote'
              : 'Economia projetada para o lote'}
          </span>
          <strong>
            {money(Math.abs(result.economia_periodo))}
            <small> em {result.dias} dias</small>
          </strong>
          <p>
            {money(Math.abs(result.economia_lote_dia))} por dia · {result.quantidade_animais}{' '}
            animais
          </p>
        </div>
        <span className="savings-percent">
          {result.economia_pct == null ? '—' : `${number(result.economia_pct, 1)}%`}
          <small>diferença de custo</small>
        </span>
      </div>
      {!result.equivalencia_nutricional_demo && (
        <p role="status" className="notice">
          A dieta manual não atende a todas as restrições. Esta diferença de custo não comprova
          equivalência nutricional.
        </p>
      )}
      <div className="comparison-columns">
        {[
          ['Dieta atual · manual', result.manual],
          ['Dieta formulada · menor custo', result.formulated],
        ].map(([label, diet]) => (
          <section className="card" key={label}>
            <h3>{label}</h3>
            <p className="muted">
              Sessão #{diet.session_id} · {statusLabel(diet.status)}
            </p>
            <strong className="comparison-price">
              {money(diet.totals.custo_animal_dia)}
              <small>/animal/dia</small>
            </strong>
            <dl className="comparison-values">
              <div>
                <dt>Custo do lote/dia</dt>
                <dd>{money(diet.totals.custo_lote_dia)}</dd>
              </div>
              <div>
                <dt>Consumo MS</dt>
                <dd>{number(diet.totals.ms_kg)} kg</dd>
              </div>
              <div>
                <dt>Proteína bruta</dt>
                <dd>{number(diet.totals.pb_pct)}% MS</dd>
              </div>
              <div>
                <dt>FDN total</dt>
                <dd>{number(diet.totals.fdn_pct)}% MS</dd>
              </div>
              <div>
                <dt>Amido</dt>
                <dd>{number(diet.totals.amido_pct)}% MS</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      <div className="actions">
        <button
          className="button secondary"
          onClick={() => download(result, 'akinutri-comparacao.json')}
        >
          <Download size={16} />
          Exportar comparação
        </button>
        <button className="button primary" onClick={() => onBatch(result.formulated.session_id)}>
          Preparar batida
          <ArrowRight size={16} />
        </button>
      </div>
      <p className="notice">{result.notice}</p>
    </div>
  );
}
export default function ComparisonPage({ history, defaults, onBatch }) {
  const [manual, setManual] = useState(
    defaults.manual || history.find((h) => h.modo === 'verificar')?.id || '',
  );
  const [formulated, setFormulated] = useState(
    defaults.formulated || history.find((h) => h.modo === 'formular')?.id || '',
  );
  const [days, setDays] = useState(30),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function compare(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setError('');
    try {
      setResult(
        await api('/comparar', 'POST', {
          manual_session_id: Number(manual),
          formulated_session_id: Number(formulated),
          dias: Number(days),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const select = (label, value, onChange, mode) => (
    <label>
      {label}
      <select
        required
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setResult(null);
        }}
      >
        <option value="">Selecione uma sessão</option>
        {history
          .filter((h) => h.modo === mode)
          .map((h) => (
            <option key={h.id} value={h.id}>
              #{h.id} · {h.lote} · {statusLabel(h.status)}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <>
      <section className="card">
        <div className="section-heading">
          <div className="step-title">
            <GitCompareArrows size={22} aria-hidden="true" />
            <div>
              <h2>Compare com o mesmo contexto</h2>
              <p>Mesmo lote, preços, consumo, manejo e limites. A API confere essa equivalência.</p>
            </div>
          </div>
        </div>
        <form onSubmit={compare}>
          <fieldset disabled={busy} className="comparison-form">
            {select('Dieta atual · sessão manual', manual, setManual, 'verificar')}
            {select('Dieta formulada · sessão LP', formulated, setFormulated, 'formular')}
            <label>
              Projeção · dias
              <input
                required
                type="number"
                min="1"
                max="366"
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  setResult(null);
                }}
              />
            </label>
            <button className="button primary">{busy ? 'Comparando…' : 'Comparar cenários'}</button>
          </fieldset>
        </form>
        <p className="muted">
          Dica: verifique a dieta atual, mantenha as entradas e mude apenas o objetivo para
          formular. As duas sessões poderão ser comparadas.
        </p>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result ? (
        <ComparisonResult result={result} onBatch={onBatch} />
      ) : (
        <section className="empty-result">
          <GitCompareArrows size={30} aria-hidden="true" />
          <h2>O custo muda. O contexto fica.</h2>
          <p>
            Selecione uma análise manual e uma formulação para comparar custos com rastreabilidade.
          </p>
        </section>
      )}
    </>
  );
}
