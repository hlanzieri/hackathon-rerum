import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Leaf,
  RotateCcw,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';

const initialLot = {
  name: 'Lote de lactação · 01',
  breed: 'Holandesa',
  animals: 45,
  weight: 600,
  production: 28,
  state: 'Lactação',
  daysInMilk: 120,
  tmr: true,
  adequateParticle: true,
};

const initialFoods = [
  {
    id: 'silage',
    name: 'Silagem de Milho',
    category: 'Volumoso',
    dryMatter: 35,
    protein: 7.5,
    fiber: 45,
    price: 0.35,
    quantity: 35,
    selected: true,
  },
  {
    id: 'soy',
    name: 'Farelo de Soja',
    category: 'Concentrado proteico',
    dryMatter: 89,
    protein: 46,
    fiber: 14,
    price: 2.4,
    quantity: 1,
    selected: true,
  },
  {
    id: 'corn',
    name: 'Milho Moído Seco',
    category: 'Concentrado energético',
    dryMatter: 88,
    protein: 9,
    fiber: 12,
    price: 1.3,
    quantity: 2,
    selected: true,
  },
  {
    id: 'citrus',
    name: 'Polpa Cítrica',
    category: 'Concentrado energético',
    dryMatter: 89,
    protein: 6.8,
    fiber: 24,
    price: 1.1,
    quantity: 0.5,
    selected: true,
  },
  {
    id: 'mineral',
    name: 'Núcleo Mineral Leite',
    category: 'Mineral',
    dryMatter: 98,
    protein: 0,
    fiber: 0,
    price: 4.5,
    quantity: 0.15,
    selected: true,
  },
];

const initialRules = [
  {
    id: 'NUT-FDN-001',
    name: 'FDN Total',
    status: 'Atendida',
    observed: 26.2,
    limit: 25,
    operator: 'Mínimo',
    source: 'NASEM 2021',
    explanation:
      'A fibra em detergente neutro da dieta está acima do mínimo de referência para o perfil demonstrativo.',
  },
  {
    id: 'NUT-FDN-VOLUMOSO-002',
    name: 'FDN de volumosos',
    status: 'Atendida',
    observed: 19.8,
    limit: 19,
    operator: 'Mínimo',
    source: 'NASEM 2021',
    explanation:
      'A contribuição de FDN proveniente dos volumosos atende ao limite mínimo configurado.',
  },
  {
    id: 'NUT-AMIDO-MAX-004',
    name: 'Amido Total',
    status: 'Violada',
    observed: 32.1,
    limit: 30,
    operator: 'Máximo',
    source: 'Penn State Extension',
    explanation:
      'O amido total está acima do limite demonstrativo. Considere revisar a participação dos concentrados energéticos.',
  },
];

const brl = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const decimal = (value, digits = 1) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value) || 0);

function StatusBadge({ status }) {
  const styles = {
    Atendida: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    Violada: 'border-rose-300 bg-rose-100 text-rose-800',
    Incompleto: 'border-amber-300 bg-amber-100 text-amber-800',
  };
  const Icon =
    status === 'Atendida' ? CheckCircle2 : status === 'Violada' ? XCircle : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      <Icon size={14} aria-hidden="true" />
      {status}
    </span>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block space-y-1.5 text-sm font-medium text-slate-700 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100';

export default function MainPage() {
  const [lot, setLot] = useState(initialLot);
  const [foods, setFoods] = useState(initialFoods);
  const [manualIntake, setManualIntake] = useState(false);
  const [intake, setIntake] = useState('22.4');
  const [resultMode, setResultMode] = useState('demo');
  const [notice, setNotice] = useState('');

  const totals = useMemo(() => {
    const activeFoods = foods.filter((food) => food.selected);
    return activeFoods.reduce(
      (result, food) => {
        const quantity = Number(food.quantity) || 0;
        result.cost += quantity * (Number(food.price) || 0);
        result.dryMatter += quantity * (food.dryMatter / 100);
        return result;
      },
      { cost: 0, dryMatter: 0 },
    );
  }, [foods]);
  const selectedCount = useMemo(() => foods.filter((food) => food.selected).length, [foods]);

  function updateLot(key, value) {
    setLot((current) => ({ ...current, [key]: value }));
  }

  function updateFood(id, key, value) {
    setFoods((current) =>
      current.map((food) => (food.id === id ? { ...food, [key]: value } : food)),
    );
  }

  function startNewSimulation() {
    setLot({ ...initialLot });
    setFoods(initialFoods.map((food) => ({ ...food })));
    setManualIntake(false);
    setIntake('22.4');
    setResultMode('demo');
    setNotice('Nova simulação iniciada com os dados demonstrativos.');
  }

  function verifyDiet() {
    setResultMode('verified');
    setNotice(
      'Verificação demonstrativa concluída. Os resultados exibidos são mocks e não substituem a análise do motor do sistema.',
    );
  }

  function optimizeDiet() {
    setResultMode('optimized');
    setNotice(
      'Ação demonstrativa: conecte o solver de programação linear para calcular uma formulação otimizada.',
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 text-slate-900 sm:p-6">
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-6 lg:grid-cols-12">
        <header className="col-span-1 flex flex-col justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-12 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#14532D] text-white">
              <Leaf size={27} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">AkiNutri</h1>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                NUTRIÇÃO DE PRECISÃO
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>
              Motor Determinístico Ativo (Base v0.1.0 - SHA-256 Validado)
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="sr-only" htmlFor="lot-selector">
              Lotes cadastrados
            </label>
            <select
              id="lot-selector"
              className={`${fieldClass} min-w-52`}
              value={lot.name}
              onChange={(event) => updateLot('name', event.target.value)}
            >
              <option>Lote de lactação · 01</option>
              <option>Lote de alta produção · 02</option>
              <option>Lote pré-parto · 03</option>
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FileSpreadsheet size={17} aria-hidden="true" />
              Exportar PDF (Vagão)
            </button>
            <button
              type="button"
              onClick={startNewSimulation}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#14532D] px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-900"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Nova Simulação
            </button>
          </div>
        </header>

        <section className="space-y-4 lg:col-span-3" aria-labelledby="lot-heading">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                Parâmetros do lote
              </p>
              <h2 id="lot-heading" className="mt-1 text-lg font-bold text-slate-900">
                Perfil animal
              </h2>
            </div>
            <div className="space-y-4">
              <Field label="Raça">
                <select
                  className={fieldClass}
                  value={lot.breed}
                  onChange={(event) => updateLot('breed', event.target.value)}
                >
                  <option>Holandesa</option>
                  <option>Gir Leiteiro</option>
                  <option>Girolando</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade de animais">
                  <input
                    className={fieldClass}
                    type="number"
                    min="1"
                    value={lot.animals}
                    onChange={(event) => updateLot('animals', event.target.value)}
                  />
                </Field>
                <Field label="Peso médio (kg)">
                  <input
                    className={fieldClass}
                    type="number"
                    min="1"
                    value={lot.weight}
                    onChange={(event) => updateLot('weight', event.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Produção alvo (L/dia)">
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    step="0.1"
                    value={lot.production}
                    onChange={(event) => updateLot('production', event.target.value)}
                  />
                </Field>
                <Field label="Estado produtivo">
                  <select
                    className={fieldClass}
                    value={lot.state}
                    onChange={(event) => updateLot('state', event.target.value)}
                  >
                    <option>Lactação</option>
                    <option>Pré-Parto / Seca</option>
                  </select>
                </Field>
              </div>
              <Field label="Dias em lactação (DEL)">
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  value={lot.daysInMilk}
                  disabled={lot.state !== 'Lactação'}
                  onChange={(event) => updateLot('daysInMilk', event.target.value)}
                />
              </Field>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                  <input
                    className="mt-0.5 accent-[#14532D]"
                    type="checkbox"
                    checked={lot.tmr}
                    onChange={(event) => updateLot('tmr', event.target.checked)}
                  />
                  <span>Sistema TMR (Dieta Total Misturada)</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                  <input
                    className="mt-0.5 accent-[#14532D]"
                    type="checkbox"
                    checked={lot.adequateParticle}
                    onChange={(event) => updateLot('adequateParticle', event.target.checked)}
                  />
                  <span>Partícula de Volumoso Adequada</span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-300 bg-[#FEF3C7] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#92400E]">
              <Calculator size={19} aria-hidden="true" />
              <h3 className="font-bold">Estimativa NASEM 2021</h3>
            </div>
            <p className="mt-3 text-sm text-amber-900">Consumo de matéria seca (CMS)</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className="flex items-baseline gap-1">
                {manualIntake ? (
                  <input
                    aria-label="Ajustar consumo estimado em kg de matéria seca por dia"
                    className="w-24 rounded-md border border-amber-400 bg-white px-2 py-1 text-xl font-bold text-[#92400E]"
                    type="number"
                    min="0"
                    step="0.1"
                    value={intake}
                    onChange={(event) => setIntake(event.target.value)}
                  />
                ) : (
                  <strong className="text-2xl text-[#92400E]">{decimal(intake)}</strong>
                )}
                <span className="text-sm font-medium text-amber-900">kg MS/dia</span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#92400E] hover:bg-white"
                onClick={() => setManualIntake((current) => !current)}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                {manualIntake ? 'Concluir ajuste' : 'Ajustar manualmente'}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-800">
              Valor de referência demonstrativo · confirme o cálculo para este lote.
            </p>
          </div>
        </section>

        <section className="min-w-0 space-y-4 lg:col-span-5" aria-labelledby="foods-heading">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Insumos e formulação
                </p>
                <h2 id="foods-heading" className="mt-1 text-lg font-bold text-slate-900">
                  Alimentos da dieta
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {selectedCount} selecionados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                <caption className="sr-only">
                  Composição dos insumos, preço e quantidade atual da dieta por animal ao dia
                </caption>
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-3">
                      Usar
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Insumo
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      MS %
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      PB %
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      FDN %
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Preço R$/kg MN
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Dieta atual (kg MN)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {foods.map((food) => (
                    <tr
                      key={food.id}
                      className={food.selected ? 'text-slate-700' : 'bg-slate-50 text-slate-400'}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${food.name}`}
                          checked={food.selected}
                          onChange={(event) =>
                            updateFood(food.id, 'selected', event.target.checked)
                          }
                          className="h-4 w-4 accent-[#14532D]"
                        />
                      </td>
                      <th scope="row" className="px-3 py-3 font-medium">
                        <span className="block whitespace-nowrap font-semibold">{food.name}</span>
                        <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          {food.category}
                        </span>
                      </th>
                      <td className="px-2 py-3 text-right">{decimal(food.dryMatter, 0)}%</td>
                      <td className="px-2 py-3 text-right">{decimal(food.protein)}%</td>
                      <td className="px-2 py-3 text-right">{decimal(food.fiber, 0)}%</td>
                      <td className="px-2 py-3">
                        <input
                          aria-label={`Preço R$ por kg MN de ${food.name}`}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right text-xs disabled:bg-slate-100"
                          type="number"
                          min="0"
                          step="0.01"
                          value={food.price}
                          disabled={!food.selected}
                          onChange={(event) => updateFood(food.id, 'price', event.target.value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Dieta atual em kg MN de ${food.name}`}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right text-xs disabled:bg-slate-100"
                          type="number"
                          min="0"
                          step="0.1"
                          value={food.quantity}
                          disabled={!food.selected}
                          onChange={(event) => updateFood(food.id, 'quantity', event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th scope="row" colSpan="5" className="px-3 py-3 text-right">
                      Total da dieta atual
                    </th>
                    <td className="px-2 py-3 text-right">{brl(totals.cost)}</td>
                    <td className="px-3 py-3 text-right">{decimal(totals.dryMatter)} kg MS</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row">
              <button
                type="button"
                onClick={verifyDiet}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#14532D] px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900"
              >
                <Activity size={17} aria-hidden="true" />
                Verificar Dieta Atual
              </button>
              <button
                type="button"
                onClick={optimizeDiet}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                Formular Menor Custo (Otimizar LP)
              </button>
            </div>
            {notice && (
              <p
                role="status"
                className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600"
              >
                {notice}
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-4" aria-labelledby="results-heading">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Resultado demonstrativo
                </p>
                <h2 id="results-heading" className="mt-1 text-lg font-bold text-slate-900">
                  Resumo da dieta
                </h2>
              </div>
              {resultMode !== 'demo' && (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-[#0F766E]">
                  {resultMode === 'verified' ? 'Verificação' : 'Otimização'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Custo / Animal / Dia</p>
                <strong className="mt-1 block text-xl font-bold text-[#14532D]">
                  {brl(18.45)}
                </strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Custo Lote / Dia</p>
                <strong className="mt-1 block text-xl font-bold text-[#14532D]">
                  {brl(830.25)}
                </strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Consumo Total MS</p>
                <strong className="mt-1 block text-xl font-bold text-[#14532D]">
                  22,8 <span className="text-sm font-medium">kg/dia</span>
                </strong>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              KPIs de exemplo; lote com {lot.animals || 0} animais. Os valores não são recalculados
              pelo solver nesta página demonstrativa.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                Auditoria de regras
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Traço de inferência</h3>
              <p className="mt-1 text-xs text-slate-500">IF / THEN · limites e justificativas</p>
            </div>
            <div className="space-y-3">
              {initialRules.map((rule) => {
                const percent = Math.min((rule.observed / rule.limit) * 100, 100);
                const passes =
                  rule.operator === 'Mínimo'
                    ? rule.observed >= rule.limit
                    : rule.observed <= rule.limit;
                const status =
                  resultMode === 'demo' ? rule.status : passes ? 'Atendida' : 'Violada';
                return (
                  <details
                    key={rule.id}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
                    open={rule.id === 'NUT-AMIDO-MAX-004'}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800">
                          {rule.id}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{rule.name}</span>
                      </span>
                      <StatusBadge status={status} />
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-slate-400 transition group-open:rotate-180"
                      />
                    </summary>
                    <div className="border-t border-slate-100 px-3 pb-3 pt-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{rule.operator}</span>
                        <span className="font-semibold text-slate-800">
                          {rule.name}: {decimal(rule.observed)}%{' '}
                          <span className="font-normal text-slate-500">
                            (limite: {decimal(rule.limit)}%)
                          </span>
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="img"
                        aria-label={`${rule.name}: ${decimal(rule.observed)}%, limite ${decimal(rule.limit)}%`}
                      >
                        <div
                          className={`h-full rounded-full ${
                            status === 'Atendida' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {rule.explanation}
                      </p>
                      <p className="mt-2 text-[11px] font-medium text-slate-500">
                        Fonte: {rule.source}
                      </p>
                    </div>
                  </details>
                );
              })}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Regras e resultados são exemplos para visualização; valide-os na base nutricional
              conectada antes de orientar o manejo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download size={16} aria-hidden="true" />
            Imprimir / salvar resultados
          </button>
        </aside>
      </div>
    </main>
  );
}
