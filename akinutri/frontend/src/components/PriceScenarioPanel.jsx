import React, { useRef, useState } from 'react';
import { api, money, number } from '../api';
import './PriceScenarioPanel.css';

const corn = (name) => /milho/i.test(name) && !/silagem/i.test(name);
const soy = (name) => /soja/i.test(name);
const validDiet = (result) =>
  result?.totals && ['otimo', 'atende_perfil_demo'].includes(result.status);
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );

export function buildPriceScenario(snapshot, kind, ingredientId) {
  if (!snapshot?.request?.grupo_id)
    throw new Error('Formule uma dieta com grupo de produção para simular cenários.');
  const ingredients = snapshot.insumos || [];
  const target = ingredients.find((i) =>
    kind === 'indisponivel'
      ? String(i.id) === String(ingredientId)
      : kind === 'milho'
        ? corn(i.nome)
        : soy(i.nome),
  );
  if (!target) throw new Error('Selecione um insumo disponível nesta análise.');
  const source = snapshot.request;
  const multiplier = kind === 'milho' ? 1.2 : kind === 'soja' ? 0.85 : 1;
  const itens = source.itens
    .filter((i) => kind !== 'indisponivel' || i.insumo_id !== target.id)
    .map((item) => {
      const ingredient = ingredients.find((i) => i.id === item.insumo_id);
      const price = Number(item.preco_kg_mn ?? ingredient?.preco_kg_mn);
      const nextPrice = price * (item.insumo_id === target.id ? multiplier : 1);
      if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > 10000)
        throw new Error('Preço do cenário fora da faixa permitida.');
      return { ...item, preco_kg_mn: nextPrice };
    });
  if (!itens.length) throw new Error('Mantenha ao menos um insumo para formular.');
  const excluded = (source.insumos_excluidos_explicitamente || []).filter((id) =>
    itens.some((i) => i.insumo_id === id),
  );
  return {
    target,
    label:
      kind === 'milho'
        ? `${target.nome} 20% mais caro`
        : kind === 'soja'
          ? `${target.nome} 15% mais barata`
          : `${target.nome} indisponível`,
    request: { ...source, itens, insumos_excluidos_explicitamente: excluded },
  };
}

// Check that the server used the same facts and composition before projecting a cost difference.
export function sameScenarioContext(before, after, request) {
  if (stable(after?.request) !== stable(request)) return false;
  if (
    !after ||
    before.base_sha256 !== after.base_sha256 ||
    before.engine_version !== after.engine_version ||
    stable(before.lote) !== stable(after.lote) ||
    stable(before.grupo) !== stable(after.grupo)
  )
    return false;
  return request.itens.every((item) => {
    const original = before.insumos.find((i) => i.id === item.insumo_id);
    const current = after.insumos?.find((i) => i.id === item.insumo_id);
    if (!original || !current) return false;
    const { preco_kg_mn: oldPrice, ...oldComposition } = original;
    const { preco_kg_mn: currentPrice, ...newComposition } = current;
    return (
      stable(oldComposition) === stable(newComposition) &&
      Math.abs(currentPrice - item.preco_kg_mn) < 1e-8
    );
  });
}

export default function PriceScenarioPanel({ result, snapshot, onOpen, onSaved }) {
  const submitted = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState('milho');
  const [ingredientId, setIngredientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState(null);
  if (!validDiet(result) || !snapshot?.request) return null;
  const ingredients = snapshot.insumos || [];
  const canSimulate = Boolean(snapshot.request.grupo_id);
  const change = (value) => {
    setKind(value);
    setAnswer(null);
    setError('');
  };
  async function simulate() {
    if (busy) return;
    setBusy(true);
    setError('');
    setAnswer(null);
    try {
      const scenario = buildPriceScenario(snapshot, kind, ingredientId);
      const signature = stable(scenario.request);
      const next =
        submitted.current?.signature === signature
          ? submitted.current.response
          : await api('/formular', 'POST', scenario.request);
      submitted.current = { signature, response: next };
      const session = await api(`/sessoes/${next.session_id}`);
      setAnswer({
        ...scenario,
        result: session.result,
        snapshot: session.snapshot,
        comparable: sameScenarioContext(snapshot, session.snapshot, scenario.request),
      });
      if (onSaved) Promise.resolve(onSaved()).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const next = answer?.result;
  const count = Number(snapshot.grupo?.numero_animais ?? snapshot.lote?.quantidade);
  const comparable = answer?.comparable && validDiet(next) && Number.isFinite(count) && count > 0;
  const difference = comparable
    ? next.totals.custo_animal_dia - result.totals.custo_animal_dia
    : null;
  const choices = [
    ['milho', '🌽 Milho 20% mais caro', !ingredients.some((i) => corn(i.nome))],
    ['soja', '🌱 Soja 15% mais barata', !ingredients.some((i) => soy(i.nome))],
    ['indisponivel', '🚫 Um insumo ficou indisponível', ingredients.length < 2],
  ];
  return (
    <section className="card price-scenario" aria-labelledby={`price-title-${result.session_id}`}>
      <div className="section-heading">
        <div>
          <h2 id={`price-title-${result.session_id}`}>E se o preço mudar?</h2>
          <p>Veja como a dieta e o custo do grupo respondem a um novo cenário.</p>
        </div>
        <button
          type="button"
          className="button secondary"
          aria-expanded={expanded}
          aria-controls={`price-options-${result.session_id}`}
          disabled={busy}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Recolher cenários' : 'Simular cenário'}
        </button>
      </div>
      {expanded && (
        <div id={`price-options-${result.session_id}`}>
          {!canSimulate ? (
            <p className="notice">
              Formule uma dieta com um grupo de produção para habilitar os cenários.
            </p>
          ) : (
            <>
              <fieldset disabled={busy}>
                <legend>Escolha uma mudança</legend>
                <div className="price-scenario-options">
                  {choices.map(([value, label, unavailable]) => (
                    <button
                      key={value}
                      type="button"
                      className="button secondary"
                      aria-pressed={kind === value}
                      disabled={unavailable}
                      onClick={() => change(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {kind === 'indisponivel' && (
                  <label>
                    Insumo indisponível
                    <select
                      value={ingredientId}
                      onChange={(e) => {
                        setIngredientId(e.target.value);
                        setAnswer(null);
                        setError('');
                      }}
                    >
                      <option value="">Selecione um insumo</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="button primary"
                  disabled={
                    choices.find((c) => c[0] === kind)?.[2] ||
                    (kind === 'indisponivel' && !ingredientId)
                  }
                  onClick={simulate}
                >
                  {busy ? 'Recalculando…' : 'Recalcular dieta neste cenário'}
                </button>
              </fieldset>
              <p className="muted">
                Usa os insumos, preços e limites da sessão #{result.session_id}. A nova análise fica
                registrada no histórico. O catálogo de preços não é alterado.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {busy && <p role="status">Executando o otimizador local…</p>}
          {answer && (
            <div aria-live="polite">
              <h3>
                {answer.label} · Sessão #{next.session_id}
              </h3>
              {!comparable && (
                <p className="notice" role="status">
                  {!validDiet(next)
                    ? 'O motor não encontrou uma dieta validada neste cenário. Não há projeção de economia.'
                    : 'O cadastro do lote, grupo, insumos ou base mudou desde a análise original. Compare o traço; a projeção financeira foi omitida.'}{' '}
                  {next.message}
                </p>
              )}
              {comparable && (
                <>
                  <div className="price-scenario-totals">
                    <p>
                      Dieta anterior
                      <strong>
                        {money(result.totals.custo_animal_dia)}
                        <small>/animal/dia</small>
                      </strong>
                    </p>
                    <p>
                      Nova dieta
                      <strong>
                        {money(next.totals.custo_animal_dia)}
                        <small>/animal/dia</small>
                      </strong>
                    </p>
                    <p>
                      {difference > 0
                        ? 'Custo adicional em 30 dias'
                        : difference < 0
                          ? 'Redução de custo em 30 dias'
                          : 'Sem diferença de custo'}
                      <strong>{money(Math.abs(difference * count * 30))}</strong>
                      <small>
                        {count} animais · {money(Math.abs(difference))}/animal/dia de diferença
                      </small>
                    </p>
                  </div>
                  <p>
                    A diferença combina a mudança de preço e a adaptação da dieta. Projeção para 30
                    dias com o mesmo número de animais e consumo.
                  </p>
                  {kind === 'indisponivel' && (
                    <p>
                      <strong>{answer.target.nome}</strong> foi removido do cardápio, incluindo os
                      limites de inclusão desse insumo.
                    </p>
                  )}
                  <div className="table-scroll">
                    <table>
                      <caption>Mudanças na dieta · kg de matéria natural/animal/dia</caption>
                      <thead>
                        <tr>
                          <th scope="col">Insumo</th>
                          <th scope="col">Anterior</th>
                          <th scope="col">Nova dieta</th>
                          <th scope="col">Variação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingredients.map((i) => {
                          const previous =
                            result.items?.find((item) => item.insumo_id === i.id)
                              ?.quantidade_kg_mn ?? 0;
                          const current =
                            next.items?.find((item) => item.insumo_id === i.id)?.quantidade_kg_mn ??
                            0;
                          return (
                            <tr key={i.id}>
                              <th scope="row">{i.nome}</th>
                              <td>{number(previous)}</td>
                              <td>{number(current)}</td>
                              <td>
                                {current - previous > 0 ? '+' : ''}
                                {number(current - previous)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    O otimizador redistribui os insumos disponíveis para buscar o menor custo dentro
                    das restrições nutricionais. Confira abaixo as regras verificadas.
                  </p>
                </>
              )}
              <details>
                <summary>Traço de inferência do cenário</summary>
                <p>{next.message}</p>
                <ul>
                  {(next.trace || []).map((rule, index) => (
                    <li key={`${rule.id}-${index}`}>
                      {rule.label || rule.id}: {rule.status} · Observado: {number(rule.observed)}{' '}
                      {rule.unit} · Limites: {number(rule.minimum)} a {number(rule.maximum)}
                    </li>
                  ))}
                </ul>
                {!(next.trace || []).length && (
                  <p>
                    Sem traço nutricional. Consulte o resultado completo para o diagnóstico do
                    motor.
                  </p>
                )}
              </details>
              {onOpen && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => onOpen(next.session_id)}
                >
                  Abrir resultado completo do cenário
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
