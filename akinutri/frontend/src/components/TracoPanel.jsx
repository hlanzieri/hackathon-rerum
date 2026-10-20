import React from 'react';
import { CheckCircle2, AlertTriangle, Download, ChevronDown } from 'lucide-react';
import { number, money, download } from '../api';
import StatusBadge from './StatusBadge';
import NutrientRange from './NutrientRange';

export const statusLabel = (status) =>
  ({
    atende_perfil_demo: 'Atende ao perfil demonstrativo',
    restricoes_violadas: 'Restrições não atendidas',
    dados_insuficientes: 'Dados insuficientes',
    inviavel: 'Formulação inviável',
    fora_escopo: 'Fora do escopo dos perfis',
    falha_solver: 'Falha no solucionador',
    falha_pos_verificacao: 'Falha na verificação do resultado',
  })[status] || status;

export default function TracoPanel({ result, snapshot, onUse }) {
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
  const good = result.status === 'atende_perfil_demo';
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
                      <td>{i.nome}</td>
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
              {t.label}
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
            <NutrientRange rule={t} />
            <p>
              <b>{t.id}</b> · IF {t.label} ∈ [{number(t.minimum, 3)}; {number(t.maximum, 3)}]{' '}
              {t.unit}, THEN restrição atendida; caso contrário, violada.
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
      {!result.totals && <p className="notice">{result.message}</p>}
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
                {i.nome} · {number(i.kg_ms, 3)} kg MS
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
      <p className="audit-note">
        SHA-256 da base: <code>{result.knowledge_sha256}</code>
      </p>
      <p className="notice">{result.notice}</p>
    </section>
  );
}
