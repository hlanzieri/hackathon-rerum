import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, number } from '../api';
import { scenarios } from './LoteForm';
import './AkiBotWizard.css';
import { QuestionWhy } from './ExplanationPanel';

const titles = [
  'Grupo de produção',
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
const validInteger = (value, min, max) =>
  validNumber(value, min, max) && Number.isInteger(Number(value));
const cfCeiling = { tabela: 0.85, laboratorio: 1, usuario: 0.7 };
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

// The API resolves the persisted lot and composition by ID (DTO extra="forbid").
export function buildInferenceRequest({
  loteId,
  groupId,
  intake,
  particle,
  dryCorn,
  compositionSource,
  compositionCf,
  estimate,
  selected,
  rows,
  mode,
}) {
  if (!validInteger(loteId, 1, Infinity) || !validInteger(groupId, 1, Infinity))
    throw new Error('Selecione um lote e um grupo válidos.');
  if (
    !['formular', 'verificar'].includes(mode) ||
    !validNumber(intake, 3, 40) ||
    !Object.hasOwn(cfCeiling, compositionSource) ||
    !validNumber(compositionCf, -1, cfCeiling[compositionSource])
  )
    throw new Error('Revise consumo, objetivo, origem e CF da composição.');
  return {
    lote_id: loteId,
    grupo_id: Number(groupId),
    consumo_ms_kg: Number(intake),
    sistema: 'tmr',
    particula_adequada: particle,
    milho_seco_predominante: dryCorn,
    evidence: { composicao: { source: compositionSource, cf: Number(compositionCf) } },
    estimativa_cms: estimate,
    itens: selected.map((i) => ({
      insumo_id: i.id,
      preco_kg_mn: Number(rows[i.id].preco_kg_mn),
      quantidade_kg_mn: mode === 'verificar' ? Number(rows[i.id].quantidade_kg_mn) : 0,
      minimo_kg_ms: 0,
      maximo_kg_ms: i.categoria === 'mineral' ? 0.5 : 40,
    })),
  };
}

// Only explains backend facts; no nutritional inference or local optimization.
export function analysisFeedback(result) {
  if (result.status === 'dados_insuficientes') {
    const pending = result.insumos_incompletos?.length
      ? result.insumos_incompletos
      : result.missing_composition || [];
    if (pending.length)
      return pending
        .map(
          (item) =>
            `Não foi possível rodar a análise porque o insumo ${item.nome} está sem os dados de ${(item.nutrientes_faltantes || item.nutrientes || []).join('/')} cadastrados. Deseja atualizar o cadastro do insumo ou removê-lo da simulação?`,
        )
        .join(' ');
    return (
      result.mensagem ||
      result.message ||
      'Dados insuficientes. Revise os parâmetros e a origem da composição.'
    );
  }
  if (['inviavel', 'falha_solver'].includes(result.status)) {
    const constraints = result.bottleneck?.constraints || [];
    return constraints.length
      ? `Não foi possível encontrar uma combinação viável para a meta de produção informada. Restrições em conflito identificadas pelo motor: ${constraints.map((c) => c.id).join(', ')}. Revise os limites do lote ou os insumos disponíveis. ${result.bottleneck.message || ''}`
      : result.mensagem ||
          result.message ||
          'O solver não concluiu a otimização. Tente novamente ou revise os dados informados.';
  }
  return null;
}

export default function AkiBotWizard({ workspace: w, onComplete }) {
  const panel = useRef(null);
  const savedLote = useRef(null);
  const submitted = useRef(null);
  const [step, setStep] = useState(0);
  const [compositionSource, setCompositionSource] = useState('tabela');
  const [compositionCf, setCompositionCf] = useState(0.85);
  const [milkDestination, setMilkDestination] = useState('leite_fluido');
  const [age, setAge] = useState(48);
  const [calvingOrder, setCalvingOrder] = useState(3);
  const [maintenancePb, setMaintenancePb] = useState('');
  const [maintenanceEnergy, setMaintenanceEnergy] = useState('');
  const [maintenanceSource, setMaintenanceSource] = useState('');
  const growing = Number(age) <= 36 || Number(calvingOrder) === 1;
  const [particle, setParticle] = useState(true);
  const [dryCorn, setDryCorn] = useState(true);
  const [profile, setProfile] = useState(null);
  const [breedId, setBreedId] = useState(w.racas[0]?.id);
  const [daysToCalving, setDaysToCalving] = useState(45);
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
  const selected = w.insumos.filter((i) => rows[i.id]?.selected);
  const groups = w.grupos.filter(
    (g) =>
      g.ativo !== false &&
      ['lactacao', 'seca'].includes(g.fase) &&
      validInteger(g.numero_animais, 1, 100000) &&
      validNumber(g.peso_medio_kg, 200, 1000) &&
      validNumber(g.del_medio, g.fase === 'lactacao' ? 1 : 0, 700) &&
      validNumber(
        g.producao_media_l_dia,
        g.fase === 'lactacao' ? 0.01 : 0,
        g.fase === 'seca' ? 0 : 80,
      ) &&
      validNumber(g.ecc_medio, 1, 5) &&
      validNumber(g.fracao_multiparas, 0, 1),
  );
  const group = groups.find((g) => String(g.id) === groupId);
  const template = scenarios[profile];
  const scenario =
    template && group
      ? {
          ...template,
          lote: {
            ...template.lote,
            destinacao_economica: milkDestination,
            idade_meses: Number(age),
            ordem_paricao: Number(calvingOrder),
            mantenca_pb_kg_dia: growing && maintenancePb !== '' ? Number(maintenancePb) : null,
            mantenca_el_mcal_dia:
              growing && maintenanceEnergy !== '' ? Number(maintenanceEnergy) : null,
            fonte_mantenca: growing ? maintenanceSource || null : null,
            raca_id: Number(breedId),
            dias_ate_parto: group.fase === 'seca' ? Number(daysToCalving) : null,
            nome: group.nome,
            quantidade: group.numero_animais,
            estado: group.fase,
            peso_kg: group.peso_medio_kg,
            dias_lactacao: group.fase === 'lactacao' ? Math.trunc(group.del_medio) : null,
            producao_l_dia: group.producao_media_l_dia,
          },
        }
      : template;

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
    Boolean(group) &&
      validInteger(age, 18, 240) &&
      validInteger(calvingOrder, 1, 15) &&
      (!growing ||
        (validNumber(maintenancePb, 0.001, 5) &&
          validNumber(maintenanceEnergy, 0.001, 40) &&
          maintenanceSource.trim().length > 0)) &&
      profile !== null &&
      Boolean(breedId) &&
      (group.fase !== 'seca' || validInteger(daysToCalving, 1, 100)),
    validNumber(intake, 3, 40),
    ingredientsValid && validNumber(compositionCf, -1, cfCeiling[compositionSource]),
    mode === 'formular' ? Boolean(group) : quantitiesValid,
    true,
  ][step];
  async function suggest() {
    setBusy(true);
    setError('');
    try {
      const result = await api('/estimar-cms', 'POST', {
        peso_kg: scenario.lote.peso_kg,
        dias_lactacao: scenario.lote.estado === 'seca' ? null : scenario.lote.dias_lactacao,
        dias_ate_parto: scenario.lote.estado === 'seca' ? scenario.lote.dias_ate_parto : null,
        estado: scenario.lote.estado,
        raca: w.racas.find((r) => r.id === Number(scenario.lote.raca_id))?.nome || 'Não informada',
        escore_corporal: group.ecc_medio,
        fracao_multiparas: group.fracao_multiparas,
        ...(scenario.lote.estado === 'seca'
          ? {}
          : {
              leite_corrigido_kg_dia: scenario.lote.producao_l_dia,
              energia_referencia_mcal_kg: 0.7,
            }),
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
      setError(
        analysisFeedback(
          e.data?.detail && typeof e.data.detail === 'object' ? e.data.detail : e.data || {},
        ) || e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function process() {
    if (
      busy ||
      !group ||
      !ingredientsValid ||
      !validNumber(compositionCf, -1, cfCeiling[compositionSource]) ||
      !validNumber(intake, 3, 40) ||
      (mode === 'formular' ? !group : !quantitiesValid)
    )
      return;
    setBusy(true);
    setError('');
    try {
      if (!validInteger(age, 18, 240) || !validInteger(calvingOrder, 1, 15))
        throw new Error('Idade e ordem de parição devem ser números inteiros válidos.');
      if (!savedLote.current) savedLote.current = await api('/lotes', 'POST', scenario.lote);
      const request = buildInferenceRequest({
        loteId: savedLote.current.id,
        groupId,
        intake,
        particle,
        dryCorn,
        compositionSource,
        compositionCf,
        estimate,
        selected,
        rows,
        mode,
      });
      const signature = JSON.stringify({ mode, request });
      const response =
        submitted.current?.signature === signature
          ? submitted.current.response
          : await api(`/${mode}`, 'POST', request);
      const feedback = analysisFeedback(response);
      if (feedback) {
        setError(feedback);
        return;
      }
      submitted.current = { signature, response };
      if (!Number.isInteger(response.session_id) || response.session_id <= 0)
        throw new Error('A API não retornou uma sessão válida para a análise.');
      await onComplete(response.session_id);
    } catch (e) {
      setError(
        analysisFeedback(
          e.data?.detail && typeof e.data.detail === 'object' ? e.data.detail : e.data || {},
        ) || e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  function selectGroup(id) {
    setGroupId(id);
    const selectedGroup = groups.find((g) => String(g.id) === id);
    const index = selectedGroup?.fase === 'seca' ? 2 : 0;
    setProfile(selectedGroup ? index : null);
    setIntake('');
    setManual(true);
    setEstimate(null);
    savedLote.current = null;
    submitted.current = null;
    setError('');
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
      <p>
        Selecione o grupo e responda aos passos. A dieta é calculada exclusivamente pelo backend
        SciPy/HiGHS.
      </p>
      <progress aria-label="Progresso do assistente" value={step + 1} max="5" />
      <h3 tabIndex="-1">{titles[step]}</h3>
      {step === 1 && (
        <>
          <QuestionWhy fact="dias_ate_parto" />
          <QuestionWhy
            fact="particula_adequada"
            label="Por que confirmar o tamanho de partícula?"
          />
        </>
      )}
      <fieldset disabled={busy || (step > 0 && !group)}>
        {step === 1 && (
          <div>
            <label>
              <input
                type="checkbox"
                checked={particle}
                onChange={(e) => setParticle(e.target.checked)}
              />
              Tamanho de partícula adequado (hipótese inicial da demonstração)
            </label>
            <label>
              <input
                type="checkbox"
                checked={dryCorn}
                onChange={(e) => setDryCorn(e.target.checked)}
              />
              Milho seco predominante (hipótese inicial da demonstração)
            </label>
          </div>
        )}
        {step === 2 && (
          <div>
            <label>
              Origem declarada da composição
              <select
                value={compositionSource}
                onChange={(e) => {
                  setCompositionSource(e.target.value);
                  setCompositionCf({ tabela: 0.85, laboratorio: 1, usuario: 0.7 }[e.target.value]);
                }}
              >
                <option value="tabela">Tabela de referência · CF inicial 0,85</option>
                <option value="laboratorio">Análise laboratorial · CF inicial 1</option>
                <option value="usuario">Estimativa de campo · CF inicial 0,70</option>
              </select>
            </label>
            <label>
              CF da composição
              <input
                type="number"
                min="-1"
                max="1"
                step="0.05"
                required
                value={compositionCf}
                onChange={(e) => setCompositionCf(e.target.value)}
              />
            </label>
            <p>
              Peso didático aplicado ao conjunto dos insumos. A origem é declarada; CF não é
              probabilidade nem certificação de análise.
            </p>
          </div>
        )}
        {step === 0 && (
          <>
            <p>Olá! Escolha o grupo de produção para iniciar a conversa.</p>
            <label>
              Idade média · meses
              <input
                type="number"
                min="18"
                max="240"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value);
                  savedLote.current = null;
                }}
              />
            </label>
            <label>
              Ordem de parição
              <input
                type="number"
                min="1"
                max="15"
                value={calvingOrder}
                onChange={(e) => {
                  setCalvingOrder(e.target.value);
                  savedLote.current = null;
                }}
              />
            </label>
            {growing && (
              <>
                <p>
                  Reserva experimental: 10% da mantença técnica informada, convertidos para a
                  densidade da dieta.
                </p>
                <label>
                  PB de mantença · kg/animal/dia
                  <input
                    type="number"
                    min="0.001"
                    max="5"
                    step="any"
                    value={maintenancePb}
                    onChange={(e) => {
                      setMaintenancePb(e.target.value);
                      savedLote.current = null;
                    }}
                  />
                </label>
                <label>
                  EL de mantença · Mcal/animal/dia
                  <input
                    type="number"
                    min="0.001"
                    max="40"
                    step="any"
                    value={maintenanceEnergy}
                    onChange={(e) => {
                      setMaintenanceEnergy(e.target.value);
                      savedLote.current = null;
                    }}
                  />
                </label>
                <label>
                  Fonte da estimativa de mantença
                  <input
                    maxLength="500"
                    value={maintenanceSource}
                    onChange={(e) => {
                      setMaintenanceSource(e.target.value);
                      savedLote.current = null;
                    }}
                  />
                </label>
              </>
            )}
            <label>
              Destino do leite
              <select
                value={milkDestination}
                onChange={(e) => {
                  setMilkDestination(e.target.value);
                  savedLote.current = null;
                  submitted.current = null;
                }}
              >
                <option value="leite_fluido">Leite fluido</option>
                <option value="queijo_artesanal">Queijo artesanal · experimental</option>
              </select>
            </label>
            <label>
              Grupo de produção
              <select value={groupId} onChange={(e) => selectGroup(e.target.value)}>
                <option value="">Selecione um grupo</option>
                {w.grupos
                  .filter((g) => g.ativo !== false)
                  .map((g) => (
                    <option
                      key={g.id}
                      value={g.id}
                      disabled={!groups.some((valid) => valid.id === g.id)}
                    >
                      {g.nome} · {g.fase}
                      {!groups.some((valid) => valid.id === g.id)
                        ? ' · parâmetros pendentes ou fase fora do escopo'
                        : ''}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              <a href="/dashboard/animais">Cadastrar ou completar grupo</a>
            </p>
            {group && (
              <p>
                {group.numero_animais} animais · {group.peso_medio_kg} kg · DEL {group.del_medio} ·{' '}
                {group.producao_media_l_dia} L/dia
              </p>
            )}
            {group && (
              <label>
                Raça do lote
                <select
                  value={breedId}
                  onChange={(e) => {
                    setBreedId(e.target.value);
                    setEstimate(null);
                    savedLote.current = null;
                    submitted.current = null;
                  }}
                >
                  {w.racas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {group?.fase === 'seca' && (
              <label>
                Dias até o parto
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={daysToCalving}
                  onChange={(e) => {
                    setDaysToCalving(e.target.value);
                    savedLote.current = null;
                    submitted.current = null;
                  }}
                />
              </label>
            )}
            {profile === 2 && (
              <p>
                O motor atual cobre período seco distante do parto; pré-parto próximo será
                identificado como fora do escopo.
              </p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <p>Informe o consumo ou solicite uma estimativa para os dados do grupo.</p>
            <p>
              O cálculo NASEM usa ECC {group.ecc_medio}, fração de multíparas{' '}
              {group.fracao_multiparas} e hipótese explícita de leite corrigido de{' '}
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
                <p>Grupo selecionado: {group?.nome}. Para trocar, volte ao primeiro passo.</p>
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
              <strong>{group?.nome}</strong>
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
            <p>
              Será registrado um lote com os dados do grupo selecionado. Preços valem para esta
              análise.
            </p>
          </>
        )}
      </fieldset>
      {busy && (
        <p role="status" aria-live="polite">
          {step === 4
            ? 'Calculando otimização via SciPy HiGHS...'
            : 'Consultando estimativa de consumo na API...'}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {error.includes('cadastrados') && (
        <p>
          <a href="/dashboard/insumos">Atualizar cadastro dos insumos</a> ou volte ao passo de
          insumos para removê-los da simulação.
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
            {busy && <Loader2 className="loading-spinner" size={17} aria-hidden="true" />}
            {busy ? 'Otimizando via SciPy HiGHS...' : '🚀 Processar Análise Nutricional'}
          </button>
        )}
      </footer>
    </section>
  );
}
