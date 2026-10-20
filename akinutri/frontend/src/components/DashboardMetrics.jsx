import React from 'react';
import { ArrowUpRight, Database, Hash, Scale } from 'lucide-react';
import { money, number } from '../api';
export default function DashboardMetrics({ workspace: w }) {
  const metrics = [
    [
      'INSUMOS DISPONÍVEIS',
      w.loading ? '—' : number(w.insumos.length, 0),
      'Composição e custos locais',
      Database,
    ],
    [
      'REGRAS PUBLICADAS',
      w.base ? number(w.base.rules.length, 0) : '—',
      w.base ? `Base v${w.base.version}` : 'Aguardando a base',
      Hash,
    ],
    [
      'ANÁLISES NO HISTÓRICO',
      w.loading ? '—' : number(w.history.length, 0),
      'Até 100 sessões recentes',
      ArrowUpRight,
    ],
    [
      'CUSTO / ANIMAL / DIA',
      w.result?.totals ? money(w.result.totals.custo_animal_dia) : '—',
      w.result
        ? `Sessão #${w.result.session_id} · resultado carregado`
        : 'Execute ou abra uma análise',
      Scale,
    ],
  ];
  return (
    <dl className="dashboard-kpis" aria-label="Indicadores do espaço de trabalho">
      {metrics.map(([label, value, note, Icon]) => (
        <div key={label}>
          <dt>
            {label}
            <Icon size={16} aria-hidden="true" />
          </dt>
          <dd>{value}</dd>
          <small>{note}</small>
        </div>
      ))}
    </dl>
  );
}
