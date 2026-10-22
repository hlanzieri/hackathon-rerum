import React from 'react';
import { Leaf, ArrowUpRight, ShieldCheck, FlaskConical, Activity, Loader2 } from 'lucide-react';
import { number } from '../api';
import LoteForm, { scenarios } from './LoteForm';
import InsumosTable from './InsumosTable';
import IntakeEstimator from './IntakeEstimator';
import TracoPanel from './TracoPanel';

export default function Workspace({ workspace: w, onBatch, onScenarioOpen }) {
  return (
    <>
      <div className="work-summary">
        <div>
          <Activity size={18} aria-hidden="true" />
          <strong>{w.history.length}</strong> análises preservadas
        </div>
        <span>
          {w.insumos.length} insumos · {w.base.rules.length} regras explícitas · base v
          {w.base.version}
        </span>
      </div>
      <div className="demo-strip">
        <FlaskConical size={18} aria-hidden="true" />
        <span>
          <strong>Cenários de referência</strong> · Exemplos fictícios de composição e preços.
        </span>
        <select
          aria-label="Carregar cenário de referência"
          defaultValue=""
          disabled={w.busy}
          onChange={(e) => {
            if (e.target.value !== '') w.scenario(Number(e.target.value));
            e.target.value = '';
          }}
        >
          <option value="">Escolher cenário</option>
          {scenarios.map((s, i) => (
            <option key={i} value={i}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <fieldset disabled={w.busy} className="workspace-fields">
        <legend className="sr-only">Fatos do lote e dados da dieta</legend>
        <section className="card group-context-card" aria-label="Grupo de produção da formulação">
          <label className="existing-label">
            Grupo de produção {w.mode === 'formular' && <span aria-hidden="true">*</span>}
            <select
              required={w.mode === 'formular'}
              value={w.grupoId}
              onChange={(event) => w.selectGrupo(event.target.value)}
            >
              <option value="">Selecione um grupo</option>
              {w.grupos.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.nome} · {group.fase}
                </option>
              ))}
            </select>
          </label>
          {w.grupoSelecionado ? (
            <>
              <div className="group-facts">
                <strong>{w.grupoSelecionado.nome}</strong>
                <span>Fase: {w.grupoSelecionado.fase}</span>
                <span>Animais: {w.grupoSelecionado.numero_animais ?? 'Pendente'}</span>
                <span>DEL médio: {w.grupoSelecionado.del_medio ?? 'Pendente'} dias</span>
                <span>Peso médio: {w.grupoSelecionado.peso_medio_kg ?? 'Pendente'} kg</span>
                <span>
                  Produção média: {w.grupoSelecionado.producao_media_l_dia ?? 'Pendente'} L/dia
                </span>
                <span>ECC médio: {w.grupoSelecionado.ecc_medio ?? 'Pendente'}</span>
              </div>
              {!w.grupoStatsValid && (
                <p className="notice">Complete os parâmetros agregados do grupo em Animais e GP.</p>
              )}
              {w.grupoStatsValid && w.grupoSelecionado.fase !== w.lote.estado && (
                <p className="notice">
                  A fase do grupo precisa ser compatível com o estado do lote selecionado.
                </p>
              )}
            </>
          ) : (
            <p className="save-hint">Cadastre e configure um grupo em Animais e GP.</p>
          )}
        </section>
        <div className="workspace-grid">
          <section className="card lot-card">
            <div className="section-heading">
              <div className="step-title">
                <span className="step-number">01</span>
                <div>
                  <h2>Perfil do lote</h2>
                  <p>Características dos animais.</p>
                </div>
              </div>
              {w.loteId && <span className="saved-pill">Salvo #{w.loteId}</span>}
            </div>
            {w.lotes.length > 0 && (
              <label className="existing-label">
                Lote cadastrado
                <select value={w.loteId ?? ''} onChange={(e) => w.selectLote(e.target.value)}>
                  <option value="">Cadastrar novo lote</option>
                  {w.lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} · #{l.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {w.editing ? (
              <LoteForm
                value={w.lote}
                onChange={(value) => {
                  w.setLote(value);
                  w.setLoteId(null);
                  w.invalidate();
                }}
                racas={w.racas}
                save={w.saveLote}
                busy={w.busy}
              />
            ) : (
              <div className="lot-summary">
                <span className="lot-avatar">
                  <Leaf size={29} aria-hidden="true" />
                </span>
                <h3>{w.lote.nome}</h3>
                <p>
                  {w.racas.find((r) => r.id === w.lote.raca_id)?.nome} ·{' '}
                  {w.lote.estado === 'seca' ? 'Período seco' : 'Em lactação'}
                </p>
                <dl>
                  <div>
                    <dt>Animais</dt>
                    <dd>{w.lote.quantidade}</dd>
                  </div>
                  <div>
                    <dt>Peso médio</dt>
                    <dd>{number(w.lote.peso_kg, 0)} kg</dd>
                  </div>
                  <div>
                    <dt>Produção</dt>
                    <dd>{number(w.lote.producao_l_dia, 1)} L/animal/dia</dd>
                  </div>
                  <div>
                    <dt>{w.lote.estado === 'seca' ? 'Dias até parto' : 'Dias em lactação'}</dt>
                    <dd>{w.lote.dias_ate_parto ?? w.lote.dias_lactacao}</dd>
                  </div>
                </dl>
                <button
                  className="button secondary"
                  onClick={() => {
                    w.setEditing(true);
                    w.setLoteId(null);
                    w.invalidate();
                  }}
                >
                  Editar como novo lote
                </button>
              </div>
            )}
            <div className="lot-tip">
              <ShieldCheck size={17} aria-hidden="true" />
              <p>
                Raça, peso e fase ficam no registro. Os limites nutricionais ainda são perfis
                simplificados e exigem revisão técnica.
              </p>
            </div>
          </section>
          <section className="card diet-card">
            <div className="section-heading">
              <div className="step-title">
                <span className="step-number">02</span>
                <div>
                  <h2>Insumos e objetivo</h2>
                  <p>Informe custos locais e limites de inclusão.</p>
                </div>
              </div>
            </div>
            <div className="segmented" role="group" aria-label="Objetivo da análise">
              <button
                aria-pressed={w.mode === 'formular'}
                className={w.mode === 'formular' ? 'selected' : ''}
                onClick={() => {
                  w.setMode('formular');
                  w.invalidate();
                }}
              >
                Formular menor custo <ArrowUpRight size={15} aria-hidden="true" />
              </button>
              <button
                aria-pressed={w.mode === 'verificar'}
                className={w.mode === 'verificar' ? 'selected' : ''}
                onClick={() => {
                  w.setMode('verificar');
                  w.invalidate();
                }}
              >
                Verificar minha dieta <ShieldCheck size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="intake-row">
              <label>
                Consumo alvo de matéria seca
                <div className="input-unit">
                  <input
                    aria-label="Consumo alvo de matéria seca"
                    required
                    type="number"
                    min="3"
                    max="40"
                    step="any"
                    value={w.intake}
                    onChange={(e) => {
                      w.setIntake(e.target.value);
                      w.invalidate();
                    }}
                  />
                  <span>kg / animal / dia</span>
                </div>
              </label>
              <p>Defina manualmente ou aplique uma sugestão do estimador.</p>
            </div>
            <IntakeEstimator
              key={`${w.loteId}-${w.grupoId}-${w.lote.raca_id}-${w.lote.estado}`}
              lote={
                w.grupoSelecionado
                  ? {
                      ...w.lote,
                      peso_kg: w.grupoSelecionado.peso_medio_kg ?? w.lote.peso_kg,
                      dias_lactacao: w.grupoSelecionado.del_medio ?? w.lote.dias_lactacao,
                      estado: w.grupoSelecionado.fase,
                    }
                  : w.lote
              }
              group={w.grupoSelecionado}
              raca={w.racas.find((r) => r.id === w.lote.raca_id)?.nome || ''}
              onApply={w.applyEstimate}
            />
            <details className="management">
              <summary>Condições do manejo</summary>
              <div>
                <label>
                  Sistema alimentar
                  <select
                    value={w.manejo.sistema}
                    onChange={(e) => {
                      w.setManejo({ ...w.manejo, sistema: e.target.value });
                      w.invalidate();
                    }}
                  >
                    <option value="tmr">TMR · dieta total misturada</option>
                    <option value="outro">Outro sistema</option>
                  </select>
                </label>
                {[
                  ['particula_adequada', 'Partícula do volumoso adequada'],
                  ['milho_seco_predominante', 'Milho seco como principal fonte de amido'],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={w.manejo[key] === null ? 'unknown' : String(w.manejo[key])}
                      onChange={(e) => {
                        w.setManejo({
                          ...w.manejo,
                          [key]: e.target.value === 'unknown' ? null : e.target.value === 'true',
                        });
                        w.invalidate();
                      }}
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                      <option value="unknown">Não informado</option>
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <InsumosTable
              insumos={w.insumos}
              rows={w.rows}
              setRows={(value) => {
                w.setRows(value);
                w.invalidate();
              }}
              mode={w.mode}
            />
            <div className="diet-footer">
              <p>
                MN: matéria natural · MS: matéria seca.
                <br />
                Preços editados valem para esta análise; o catálogo é preservado.
              </p>
              <button
                className="button primary"
                disabled={
                  !w.loteId ||
                  (w.mode === 'formular' && !w.grupoCompativel) ||
                  w.busy ||
                  w.intake === '' ||
                  Number(w.intake) < 3 ||
                  Number(w.intake) > 40
                }
                aria-busy={w.busy}
                onClick={w.run}
              >
                {w.busy
                  ? w.mode === 'formular'
                    ? 'Otimizando via SciPy HiGHS...'
                    : 'Verificando dieta...'
                  : w.mode === 'formular'
                    ? 'Formular dieta'
                    : 'Verificar dieta'}
                {w.busy ? (
                  <Loader2 className="loading-spinner" size={17} aria-hidden="true" />
                ) : (
                  <ArrowUpRight size={17} aria-hidden="true" />
                )}
              </button>
            </div>
            {!w.loteId && <p className="save-hint">Salve ou selecione um lote para executar.</p>}
          </section>
        </div>
      </fieldset>
      <div className="section-heading result-heading">
        <div className="step-title">
          <span className="step-number">03</span>
          <div>
            <h2>Resultado e explicação</h2>
            <p>Cada valor pode ser conferido contra a regra aplicada.</p>
          </div>
        </div>
        {w.result?.status === 'atende_perfil_demo' && (
          <button className="button secondary" onClick={() => onBatch(w.result.session_id)}>
            Preparar batida do vagão
          </button>
        )}
      </div>
      <TracoPanel
        result={w.result}
        snapshot={w.snapshot}
        onScenarioOpen={onScenarioOpen}
        onScenarioSaved={w.refresh}
        onUse={w.result?.totals && w.mode === 'formular' ? w.useFormulated : null}
        onExclude={
          w.mode === 'formular'
            ? (id) => {
                const alreadyExcluded = (w.result?.excluded_ingredients || []).map(
                  (item) => item.insumo_id,
                );
                return w.run({ excludedIds: [...new Set([...alreadyExcluded, id])] });
              }
            : null
        }
        onFill={w.mode === 'formular' ? w.fillMissingIngredient : null}
      />
    </>
  );
}
