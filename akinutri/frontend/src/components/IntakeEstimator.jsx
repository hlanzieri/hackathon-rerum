import React, { useState } from 'react';
import { Calculator, ArrowDownToLine } from 'lucide-react';
import { api, number } from '../api';
export default function IntakeEstimator({ lote, raca, onApply }) {
  const [ecc, setEcc] = useState(3),
    [parity, setParity] = useState(lote.ordem_paricao === 1 ? 0 : 1),
    [milk, setMilk] = useState('');
  const [mode, setMode] = useState('corrected'),
    [reference, setReference] = useState(0.7),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function estimate(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(
        await api('/estimar-cms', 'POST', {
          peso_kg: lote.peso_kg,
          dias_lactacao: lote.dias_lactacao || 1,
          estado: lote.estado,
          raca,
          escore_corporal: Number(ecc),
          fracao_multiparas: Number(parity),
          ...(mode === 'corrected'
            ? {
                leite_corrigido_kg_dia: Number(milk),
                energia_referencia_mcal_kg: Number(reference),
              }
            : { energia_leite_mcal_dia: Number(milk) }),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="intake-estimator">
      <summary>
        <Calculator size={17} aria-hidden="true" />
        Sugerir consumo · NASEM 2021<span>Opcional</span>
      </summary>
      <p>
        Equação 2-1 para Holandesas em lactação. Leite bruto em litros não é leite corrigido. ECC e
        paridade abaixo são valores editáveis.
      </p>
      <form onSubmit={estimate}>
        <div className="form-grid">
          <label>
            ECC · escala 1–5
            <input
              required
              type="number"
              min="1"
              max="5"
              step=".1"
              value={ecc}
              onChange={(e) => {
                setEcc(e.target.value);
                setResult(null);
              }}
            />
          </label>
          <label>
            Fração de multíparas · 0–1
            <input
              required
              type="number"
              min="0"
              max="1"
              step=".01"
              value={parity}
              onChange={(e) => {
                setParity(e.target.value);
                setResult(null);
              }}
            />
          </label>
          <label className="span2">
            Base da produção corrigida
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setMilk('');
                setResult(null);
              }}
            >
              <option value="corrected">Leite corrigido para energia · kg/dia</option>
              <option value="energy">Energia diária do leite · Mcal/dia</option>
            </select>
          </label>
          <label>
            {mode === 'corrected' ? 'Leite corrigido · kg/dia' : 'Energia do leite · Mcal/dia'}
            <input
              required
              type="number"
              min=".01"
              max="100"
              step="any"
              placeholder="Informe o valor…"
              value={milk}
              onChange={(e) => {
                setMilk(e.target.value);
                setResult(null);
              }}
            />
          </label>
          {mode === 'corrected' && (
            <label>
              Energia de referência · Mcal/kg
              <input
                required
                type="number"
                min=".01"
                max="2"
                step=".01"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value);
                  setResult(null);
                }}
              />
            </label>
          )}
        </div>
        <button className="button secondary" disabled={busy}>
          {busy ? 'Calculando…' : 'Calcular sugestão'}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite" className="estimate-answer">
          {result.cms_kg_dia != null ? (
            <>
              <strong>
                {number(result.cms_kg_dia)} <small>kg MS/animal/dia</small>
              </strong>
              <button
                type="button"
                className="button primary"
                onClick={() => onApply(result.cms_kg_dia, result.inputs)}
                disabled={result.cms_kg_dia < 3 || result.cms_kg_dia > 40}
              >
                <ArrowDownToLine size={16} />
                Aplicar sugestão
              </button>
              <p>Aplicar altera o consumo alvo; você pode ajustá-lo manualmente depois.</p>
            </>
          ) : (
            <p>{result.message}</p>
          )}
          <p>{result.notice}</p>
          <a href={result.source_url} target="_blank" rel="noreferrer">
            Fonte e equação NASEM ↗
          </a>
        </div>
      )}
    </details>
  );
}
