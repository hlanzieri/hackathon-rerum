import React, { useEffect, useRef, useState } from 'react';
import { api, number } from '../api';
import { scenarios } from './LoteForm';
import './AkiBotWizard.css';

const labels = [
  '🐄 Vacas em Lactação - Alta Produção (35 L/dia)',
  '🐄 Vacas em Lactação - Média Produção (15 L/dia)',
  '🌾 Vacas Secas / Pré-Parto',
];
const titles = [
  'Perfil do lote',
  'Consumo de matéria seca',
  'Insumos da fazenda',
  'Objetivo do cálculo',
  'Resumo',
];
const validNumber = (value, min, max = Infinity) =>
  value != null &&
  value !== '' &&
  Number.isFinite(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;
const standard = (name) => /silagem.*milho|farelo.*soja|milho.*mo[ií]do/i.test(name);
const nutrientKeys = ['ms_pct', 'pb_pct', 'fdn_pct', 'amido_pct', 'el_mcal_kg', 'ca_pct', 'p_pct'];
export function defaultLactationIds(ingredients) {
  return [/silagem.*milho/i, /farelo.*soja/i, /milho.*mo[ií]do/i].flatMap((pattern) => {
    const candidates = ingredients
      .filter((i) => pattern.test(i.nome))
      .sort(
        (a, b) =>
          nutrientKeys.filter((key) => a[key] == null).length -
          nutrientKeys.filter((key) => b[key] == null).length,
      );
    return candidates.length ? [candidates[0].id] : [];
  });
}

export default function AkiBotWizard({ workspace: w, onComplete }) {
  const panel = useRef(null);
  const savedLote = useRef(null);
  const submitted = useRef(null);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(null);
  const [intake, setIntake] = useState('');
  const [manual, setManual] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      w.insumos.map((i) => [
        i.id,
        { selected: false, preco_kg_mn: i.preco_kg_mn, quantidade_kg_mn: '' },
      ]),
    ),
  );
  const [mode, setMode] = useState('formular');
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    panel.current.querySelector('h3')?.focus();
  }, [step]);
  const scenario = scenarios[profile];
  const selected = w.insumos.filter((i) => rows[i.id]?.selected);
  const groups = w.grupos.filter(
    (g) =>
      g.ativo !== false &&
      g.fase === scenario?.lote.estado &&
      validNumber(g.numero_animais, 1) &&
      validNumber(g.peso_medio_kg, 200, 1000) &&
      validNumber(g.del_medio, g.fase === 'lactacao' ? 1 : 0) &&
      validNumber(
        g.producao_media_l_dia,
        g.fase === 'lactacao' ? 0.01 : 0,
        g.fase === 'seca' ? 0 : 80,
      ) &&
      validNumber(g.ecc_medio, 1, 5) &&
      validNumber(g.fracao_multiparas, 0, 1),
  );
  const group = groups.find((g) => String(g.id) === groupId);
  const update = (id, key, value) =>
    setRows((old) => ({ ...old, [id]: { ...old[id], [key]: value } }));
  function includeMinerals() {
    setRows((old) =>
      Object.fromEntries(
        w.insumos.map((i) => [
          i.id,
          {
            ...old[i.id],
            selected:
              old[i.id]?.selected ||
              (i.categoria === 'mineral' && nutrientKeys.every((key) => i[key] != null)),
          },
        ]),
      ),
    );
  }
  const ingredientsValid =
    selected.length > 0 &&
    selected.length <= 50 &&
    selected.every((i) => validNumber(rows[i.id].preco_kg_mn, 0, 10000));
  const quantitiesValid =
    selected.some((i) => Number(rows[i.id].quantidade_kg_mn) > 0) &&
    selected.every((i) => validNumber(rows[i.id].quantidade_kg_mn, 0, 200));
  const canAdvance = [
    profile !== null,
    validNumber(intake, 3, 40),
    ingredientsValid,
    mode === 'formular' ? Boolean(group) : quantitiesValid,
    true,
  ][step];
  async function suggest() {
    setGroupId('');
    setBusy(true);
    setError('');
    try {
      const result = await api('/estimar-cms', 'POST', {
        peso_kg: scenario.lote.peso_kg,
        dias_lactacao: scenario.lote.dias_lactacao || 1,
        estado: scenario.lote.estado,
        raca: w.racas.find((r) => r.id === scenario.lote.raca_id)?.nome || 'Não informada',
        escore_corporal: 3,
        fracao_multiparas: 1,
        leite_corrigido_kg_dia: scenario.lote.producao_l_dia || 1,
        energia_referencia_mcal_kg: 0.7,
      });
      if (!validNumber(result.cms_kg_dia ?? '', 3, 40))
        throw new Error(
          result.message ||
            'Estimativa indisponível para este perfil. Ajuste o consumo manualmente.',
        );
      setIntake(result.cms_kg_dia);
      setEstimate(result.inputs);
      setManual(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function process() {
    if (
      busy ||
      !ingredientsValid ||
      !validNumber(intake, 3, 40) ||
      (mode === 'formular' ? !group : !quantitiesValid)
    )
      return;
    setBusy(true);
    setError('');
    try {
      if (!savedLote.current) savedLote.current = await api('/lotes', 'POST', scenario.lote);
      const request = {
        lote_id: savedLote.current.id,
        ...(mode === 'formular' ? { grupo_id: Number(groupId) } : {}),
        consumo_ms_kg: Number(intake),
        sistema: 'tmr',
        particula_adequada: true,
        milho_seco_predominante: true,
        estimativa_cms: estimate,
        itens: selected.map((i) => ({
          insumo_id: i.id,
          preco_kg_mn: Number(rows[i.id].preco_kg_mn),
          quantidade_kg_mn: mode === 'verificar' ? Number(rows[i.id].quantidade_kg_mn) : 0,
          minimo_kg_ms: 0,
          maximo_kg_ms: i.categoria === 'mineral' ? 0.5 : 40,
        })),
      };
      const signature = JSON.stringify({ mode, request });
      const response =
        submitted.current?.signature === signature
          ? submitted.current.response
          : await api(`/${mode}`, 'POST', request);
      submitted.current = { signature, response };
      await onComplete(response.session_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function selectGroup(id) {
    setGroupId(id);
    if (!id) {
      if (estimate && groupId) {
        setEstimate(null);
        setManual(true);
      }
      return;
    }
    if (!estimate) return;
    const selectedGroup = groups.find((g) => String(g.id) === id);
    setBusy(true);
    setError('');
    try {
      const result = await api('/estimar-cms', 'POST', {
        ...estimate,
        peso_kg: selectedGroup.peso_medio_kg,
        dias_lactacao: Math.max(1, Math.trunc(selectedGroup.del_medio)),
        estado: selectedGroup.fase,
        escore_corporal: selectedGroup.ecc_medio,
        fracao_multiparas: selectedGroup.fracao_multiparas,
      });
      if (!validNumber(result.cms_kg_dia ?? '', 3, 40))
        throw new Error(result.message || 'CMS indisponível para o grupo.');
      setIntake(result.cms_kg_dia);
      setEstimate(result.inputs);
    } catch (e) {
      setGroupId('');
      setError(`${e.message} Volte ao passo de consumo para ajustar manualmente.`);
    } finally {
      setBusy(false);
    }
  }
  const choice = (label, active, action) => (
    <button type="button" className="aki-choice" aria-pressed={active} onClick={action}>
      {active && <span aria-hidden="true">✓ </span>}
      {label}
    </button>
  );
  return (
    <section ref={panel} className="aki-wizard" aria-labelledby="aki-title">
      <header>
        <h2 id="aki-title">AkiBot · Assistente guiado</h2>
        <span className="aki-step-count">Passo {step + 1} de 5</span>
      </header>
      <p>Selecione as opções do seu lote e prepare a análise nutricional.</p>
      <progress aria-label="Progresso do assistente" value={step + 1} max="5" />
      <h3 tabIndex="-1">{titles[step]}</h3>
      <fieldset disabled={busy}>
        {step === 0 && (
          <>
            {labels.map((label, index) => (
              <React.Fragment key={label}>
                {choice(label, profile === index, () => {
                  setProfile(index);
                  setIntake(scenarios[index].intake);
                  setEstimate(null);
                  setManual(false);
                  setGroupId('');
                  savedLote.current = null;
                  submitted.current = null;
                  setError('');
                })}
              </React.Fragment>
            ))}
            {scenario && (
              <p>
                {scenario.lote.peso_kg} kg · DEL {scenario.lote.dias_lactacao ?? 'não se aplica'} ·{' '}
                {scenario.lote.producao_l_dia} L/dia
              </p>
            )}
            {profile === 2 && (
              <p>
                Perfil seco distante do parto (45 dias). O motor atual não cobre pré-parto próximo.
              </p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <p>Sugestão do perfil: {scenario.intake} kg MS/animal/dia.</p>
            <p>
              O cálculo NASEM usa ECC 3, 100% multíparas e hipótese de leite corrigido de{' '}
              {scenario.lote.producao_l_dia} kg/dia a 0,7 Mcal/kg para lactação. Esses valores são
              pressupostos do perfil.
            </p>
            {choice('Usar Sugestão Automática NASEM 2021', Boolean(estimate), suggest)}
            {choice('Ajustar Consumo Manualmente', manual, () => {
              setManual(true);
              setEstimate(null);
            })}
            {manual ? (
              <label>
                CMS · kg MS/animal/dia
                <input
                  type="number"
                  min="3"
                  max="40"
                  step="any"
                  value={intake}
                  onChange={(e) => setIntake(e.target.value)}
                />
              </label>
            ) : (
              <p>
                CMS: {number(intake)} kg MS/animal/dia {estimate ? '(NASEM)' : '(padrão do perfil)'}
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setRows((old) =>
                  Object.fromEntries(
                    w.insumos.map((i) => [
                      i.id,
                      { ...old[i.id], selected: defaultLactationIds(w.insumos).includes(i.id) },
                    ]),
                  ),
                )
              }
            >
              Usar Insumos Padrão de Lactação
            </button>
            {!w.insumos.some((i) => standard(i.nome)) && (
              <p>Insumos padrão ausentes. Selecione os disponíveis na biblioteca.</p>
            )}
            <p>
              O atalho escolhe um insumo por tipo, priorizando composição completa. Confira os
              minerais necessários para atender às restrições do motor.
            </p>
            <button type="button" className="button secondary" onClick={includeMinerals}>
              Incluir minerais com composição completa
            </button>
            {w.insumos.map((i) => (
              <div className="aki-ingredient" key={i.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={rows[i.id].selected}
                    onChange={(e) => update(i.id, 'selected', e.target.checked)}
                  />
                  {i.nome}
                </label>
                <label>
                  Preço de {i.nome} · R$/kg MN
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={rows[i.id].preco_kg_mn}
                    onChange={(e) => update(i.id, 'preco_kg_mn', e.target.value)}
                  />
                </label>
              </div>
            ))}
          </>
        )}
        {step === 3 && (
          <>
            {choice('⚡ Formular Dieta de Menor Custo (Otimizador LP)', mode === 'formular', () =>
              setMode('formular'),
            )}
            {choice('🔍 Verificar Balanço da Dieta Atual', mode === 'verificar', () => {
              setMode('verificar');
              if (groupId && estimate) {
                setEstimate(null);
                setManual(true);
              }
            })}
            {mode === 'formular' ? (
              <>
                <label>
                  Grupo de produção
                  <select value={groupId} onChange={(e) => selectGroup(e.target.value)}>
                    <option value="">Selecione um grupo compatível</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  O motor usa os parâmetros reais do grupo na formulação. Configure grupos em
                  Animais e GP se necessário.
                </p>
                {group && (
                  <p>
                    {group.peso_medio_kg} kg · DEL {group.del_medio} · {group.producao_media_l_dia}{' '}
                    L/dia
                  </p>
                )}
              </>
            ) : (
              <>
                {selected.map((i) => (
                  <label key={i.id}>
                    Quantidade de {i.nome} · kg MN/animal/dia
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="any"
                      value={rows[i.id].quantidade_kg_mn}
                      onChange={(e) => update(i.id, 'quantidade_kg_mn', e.target.value)}
                    />
                  </label>
                ))}
                <p>Informe a dieta atual; ao menos uma quantidade deve ser maior que zero.</p>
              </>
            )}
          </>
        )}
        {step === 4 && (
          <>
            <p>
              <strong>{labels[profile]}</strong>
            </p>
            <p>
              {scenario.lote.peso_kg} kg · DEL {scenario.lote.dias_lactacao ?? 'não se aplica'} ·{' '}
              {scenario.lote.producao_l_dia} L/dia
            </p>
            <p>
              CMS: {number(intake)} kg MS/animal/dia ·{' '}
              {estimate ? 'NASEM 2021' : manual ? 'Manual' : 'Padrão do perfil'}
            </p>
            <p>
              {mode === 'formular'
                ? `Menor custo · Grupo: ${group?.nome} (${group?.peso_medio_kg} kg, DEL ${group?.del_medio}, ${group?.producao_media_l_dia} L/dia)`
                : 'Balanço da dieta atual'}
            </p>
            <ul>
              {selected.map((i) => (
                <li key={i.id}>
                  {i.nome}: R$ {number(rows[i.id].preco_kg_mn)} /kg MN
                  {mode === 'verificar' && ` · ${rows[i.id].quantidade_kg_mn} kg MN/dia`}
                </li>
              ))}
            </ul>
            <p>Será registrado um lote com o perfil selecionado. Preços valem para esta análise.</p>
          </>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <footer>
        <button
          type="button"
          className="button secondary"
          disabled={busy || step === 0}
          onClick={() => {
            setStep((s) => s - 1);
            setError('');
          }}
        >
          Voltar
        </button>
        {step < 4 ? (
          <button
            type="button"
            className="button primary"
            disabled={busy || !canAdvance}
            onClick={() => {
              setStep((s) => s + 1);
              setError('');
            }}
          >
            Avançar
          </button>
        ) : (
          <button type="button" className="button primary" disabled={busy} onClick={process}>
            {busy ? 'Processando…' : '🚀 Processar Análise Nutricional'}
          </button>
        )}
      </footer>
    </section>
  );
}
