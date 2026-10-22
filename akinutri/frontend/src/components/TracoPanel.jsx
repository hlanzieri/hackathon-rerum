import ExplanationPanel from './ExplanationPanel';
import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Download, ChevronDown } from 'lucide-react';
import { number, money, download, displayText } from '../api';
import StatusBadge from './StatusBadge';
import NutrientRange from './NutrientRange';
import PriceScenarioPanel from './PriceScenarioPanel';

export const statusLabel = (status) =>
  ({
    atende_perfil_demo: 'Atende ao perfil de referência',
    otimo: 'Formulação otimizada',
    diagnostico_relaxado: 'Diagnóstico relaxado · não validado',
    restricoes_violadas: 'Restrições não atendidas',
    dados_insuficientes: 'Dados insuficientes',
    inviavel: 'Formulação inviável',
    fora_escopo: 'Fora do escopo dos perfis',
    falha_solver: 'Falha no solucionador',
    falha_pos_verificacao: 'Falha na verificação do resultado',
  })[status] || status;

const missingFields = {
  PB: ['pb_pct', 'Proteína bruta (PB) %'],
  pb_pct: ['pb_pct', 'Proteína bruta (PB) %'],
  FDN: ['fdn_pct', 'FDN %'],
  fdn_pct: ['fdn_pct', 'FDN %'],
  Amido: ['amido_pct', 'Amido %'],
  amido_pct: ['amido_pct', 'Amido %'],
  EL: ['el_mcal_kg', 'Energia líquida (Mcal/kg)'],
  el_mcal_kg: ['el_mcal_kg', 'Energia líquida (Mcal/kg)'],
  Cálcio: ['ca_pct', 'Cálcio %'],
  ca_pct: ['ca_pct', 'Cálcio %'],
  Fósforo: ['p_pct', 'Fósforo %'],
  p_pct: ['p_pct', 'Fósforo %'],
};

export default function TracoPanel({
  result,
  snapshot,
  onUse,
  onExclude,
  onFill,
  onScenarioOpen,
  onScenarioSaved,
}) {
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  if (!result)
    return (
      <section className="empty-result">
        <div className="empty-icon">↗</div>
        <h3>Uma decisão que você pode conferir.</h3>
        <p>
          Execute a análise para visualizar o balanço nutricional, o custo e a explicação de cada
          regra.
        </p>
        <div className="empty-steps">
          <span>01 · Fatos do lote</span>
          <span>02 · Regras explícitas</span>
          <span>03 · Resultado auditável</span>
        </div>
      </section>
    );
  const good = ['otimo', 'atende_perfil_demo'].includes(result.status);
  const pendingIngredients = result.insumos_incompletos || result.missing_composition || [];
  const excludedIds = (result.excluded_ingredients || []).map((item) => item.insumo_id);
  async function submitMissing(event) {
    event.preventDefault();
    setActionBusy(true);
    setActionError('');
    try {
      await onFill(editingIngredient.insumo_id, fieldValues);
      setEditingIngredient(null);
      setFieldValues({});
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusy(false);
    }
  }
  async function excludeIngredient(id) {
    setActionBusy(true);
    setActionError('');
    try {
      await onExclude?.(id);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusy(false);
    }
  }
  return (
    <section className="result-section">
      <h2 className="sr-only">Balanço nutricional e traço da sessão</h2>
      <div className={`result-banner ${good ? 'good' : 'warning'}`}>
        {good ? <CheckCircle2 /> : <AlertTriangle />}
        <div>
          <strong>{statusLabel(result.status)}</strong>
          <p>
            {result.profile_label || 'Confira as condições de aplicação abaixo.'} · Sessão #
            {result.session_id}
          </p>
        </div>
        <button
          className="icon-button"
          title="Exportar sessão JSON"
          aria-label="Exportar sessão JSON"
          onClick={() =>
            download({ result, snapshot }, `akinutri-sessao-${result.session_id}.json`)
          }
        >
          <Download size={19} />
        </button>
      </div>
      {result.status === 'dados_insuficientes' && pendingIngredients.length > 0 && (
        <section
          className="notice missing-composition"
          aria-label="Pendências de composição nutricional"
        >
          <h3>Dados nutricionais pendentes</h3>
          <p>
            {result.mensagem ||
              result.message ||
              'Complete os dados ou exclua o insumo explicitamente.'}
          </p>
          <ul>
            {pendingIngredients.map((item) => {
              const missing = item.nutrientes_faltantes || item.nutrientes || [];
              return (
                <li key={item.insumo_id}>
                  <strong>{displayText(item.nome)}</strong>
                  <span>Faltam: {missing.join(', ')}</span>
                  <div className="missing-actions">
                    <button
                      className="button secondary"
                      disabled={actionBusy || !onExclude || excludedIds.includes(item.insumo_id)}
                      onClick={() => excludeIngredient(item.insumo_id)}
                    >
                      Excluir da Formulação (Auditado)
                    </button>
                    <button
                      className="button secondary"
                      disabled={actionBusy || !onFill}
                      onClick={() => {
                        setEditingIngredient(item);
                        setFieldValues(
                          Object.fromEntries(
                            missing.map((nutrient) => [missingFields[nutrient]?.[0], '']),
                          ),
                        );
                      }}
                    >
                      Preencher Dados
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {actionError && <p role="alert">{actionError}</p>}
        </section>
      )}
      {editingIngredient && (
        <div className="dialog-backdrop">
          <form
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-data-title"
            onSubmit={submitMissing}
          >
            <h3 id="missing-data-title">
              Completar composição · {displayText(editingIngredient.nome)}
            </h3>
            {(editingIngredient.nutrientes_faltantes || editingIngredient.nutrientes || []).map(
              (nutrient) => {
                const field = missingFields[nutrient];
                if (!field) return null;
                return (
                  <label key={nutrient}>
                    {field[1]}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={fieldValues[field[0]] ?? ''}
                      onChange={(event) =>
                        setFieldValues((old) => ({
                          ...old,
                          [field[0]]: event.target.value === '' ? '' : Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                );
              },
            )}
            {actionError && <p role="alert">{actionError}</p>}
            <div className="missing-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditingIngredient(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="button primary" disabled={actionBusy}>
                {actionBusy ? 'Salvando…' : 'Salvar e reformular'}
              </button>
            </div>
          </form>
        </div>
      )}
      {result.totals && (
        <>
          <div className="result-metrics">
            <div>
              <small>Custo por animal / dia</small>
              <strong>{money(result.totals.custo_animal_dia)}</strong>
            </div>
            <div>
              <small>Custo do lote / dia</small>
              <strong>{money(result.totals.custo_lote_dia)}</strong>
            </div>
            <div>
              <small>Consumo de matéria seca</small>
              <strong>
                {number(result.totals.ms_kg)} <em>kg/dia</em>
              </strong>
            </div>
          </div>
          <div className="section-heading">
            <div>
              <h3>Composição da dieta</h3>
              <p>Quantidades por animal, por dia.</p>
            </div>
            {onUse && (
              <button className="button secondary" onClick={onUse}>
                Usar na verificação
              </button>
            )}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>kg matéria natural</th>
                  <th>kg matéria seca</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {result.items
                  .filter((i) => i.quantidade_kg_ms > 0.00001)
                  .map((i) => (
                    <tr key={i.insumo_id}>
                      <td>{displayText(i.nome)}</td>
                      <td>{number(i.quantidade_kg_mn, 3)}</td>
                      <td>{number(i.quantidade_kg_ms, 3)}</td>
                      <td>{money(i.custo)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="section-heading">
        <div>
          <h3>Traço de inferência</h3>
          <p>IF / THEN · valores, limites e origem das regras.</p>
        </div>
        <span className="version-pill">Base v{result.knowledge_version}</span>
      </div>
      {result.trace.map((t) => (
        <details className={`trace-row audit-${t.status}`} key={t.id}>
          <summary>
            <strong>
              <code className="audit-rule-id">{t.id}</code>
              {displayText(t.label)}
              <small className="range-preview">
                [{number(t.minimum)}; {number(t.maximum)}] {t.unit}
              </small>
            </strong>
            <span className="trace-value">
              {number(t.observed, 3)} <small>{t.unit}</small>
            </span>
            <StatusBadge status={t.status} />
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="trace-detail">
            <NutrientRange rule={{ ...t, label: displayText(t.label) }} />
            <p>
              <b>{t.id}</b> · IF {displayText(t.label)} ∈ [{number(t.minimum, 3)};{' '}
              {number(t.maximum, 3)}] {t.unit}, THEN restrição atendida; caso contrário, violada.
            </p>
            <p>
              Observado: {number(t.observed, 6)}. {t.basis}
            </p>
            {t.source_url?.startsWith('https://') ? (
              <a href={t.source_url} target="_blank" rel="noreferrer">
                Consultar referência ↗
              </a>
            ) : (
              <p>Origem: hipótese do MVP ou parâmetro informado.</p>
            )}
          </div>
        </details>
      ))}
      {result.exclusion_trace?.length > 0 && (
        <details className="profile-details" open>
          <summary>Exclusões explícitas auditadas</summary>
          <ul>
            {result.exclusion_trace.map((entry) => (
              <li key={entry.insumo_id}>
                {displayText(entry.nome)} · {entry.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!result.totals && <p className="notice">{displayText(result.message)}</p>}
      {result.optimization_trace && (
        <details className="profile-details">
          <summary>Por que estes insumos? · Explicação da otimização</summary>
          <p>
            Escolha conjunta de menor custo para todas as restrições. Valores marginais são locais
            ao modelo e não representam recomendação isolada.
          </p>
          {result.optimization_trace.map((i) => (
            <div key={i.insumo_id}>
              <h4>
                {displayText(i.nome)} · {number(i.kg_ms, 3)} kg MS
              </h4>
              <p>{i.reason}</p>
              <p>
                Preço: {money(i.custo_kg_ms)}/kg MS. Variação marginal ao elevar a inclusão mínima:{' '}
                {money(i.marginal_minimo_brl_kg_ms)}/kg MS.
              </p>
            </div>
          ))}
        </details>
      )}
      {result.shadow_prices && (
        <details className="profile-details">
          <summary>Preços sombra · Restrições do modelo</summary>
          <p>{result.shadow_prices.notice}</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Restrição</th>
                  <th scope="col">Folga / resíduo</th>
                  <th scope="col">Marginal R$ / unidade RHS</th>
                </tr>
              </thead>
              <tbody>
                {[...result.shadow_prices.equalities, ...result.shadow_prices.inequalities].map(
                  (row) => (
                    <tr key={row.constraint_id}>
                      <th scope="row">{row.constraint_id}</th>
                      <td>{number(row.slack ?? row.residual, 6)}</td>
                      <td>{number(row.marginal_brl_per_rhs_unit, 6)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <details className="profile-details">
        <summary>Condições de seleção do perfil</summary>
        {result.profile_trace.map((p) => (
          <div key={p.profile_id}>
            <h4>{p.profile_id}</h4>
            {p.conditions.map((c, i) => (
              <p key={i}>
                {c.fact}: {String(c.observed ?? 'não informado')} {c.op} {String(c.value)} →{' '}
                <StatusBadge status={c.status} />
              </p>
            ))}
          </div>
        ))}
      </details>
      <ExplanationPanel key={`explanation-${result.session_id}`} result={result} />
      <p className="audit-note">
        SHA-256 da base: <code>{result.knowledge_sha256}</code>
      </p>
      <p className="notice">{displayText(result.notice)}</p>
      <PriceScenarioPanel
        key={`scenario-${result.session_id}`}
        result={result}
        snapshot={snapshot}
        onOpen={onScenarioOpen}
        onSaved={onScenarioSaved}
      />
    </section>
  );
}
