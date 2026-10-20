import React from 'react';
import { CalendarDays, CircleDollarSign, Leaf } from 'lucide-react';

const phases = {
  bezerril: 'Bezerril',
  recria: 'Recria',
  lactacao: 'Lactação',
  seca: 'Seca',
};

function formatDate(value) {
  if (!value) return 'Em andamento';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function AnimalTimeline({ history }) {
  if (!history?.linha_tempo?.length) {
    return <p className="notice">Ainda não há períodos de grupo registrados para este animal.</p>;
  }

  return (
    <section className="card animal-timeline" aria-labelledby="animal-timeline-heading">
      <div className="section-heading">
        <div>
          <h2 id="animal-timeline-heading">Linha do tempo nutricional</h2>
          <p>Fases, dietas do grupo e custo calculado por dia em cada período registrado.</p>
        </div>
        <div className="animal-timeline__total">
          <span>Custo acumulado</span>
          <strong>{formatMoney(history.custo_diario_acumulado)}</strong>
        </div>
      </div>
      <ol className="animal-timeline__list">
        {history.linha_tempo.map((period, index) => (
          <li
            className="animal-timeline__item"
            key={`${period.grupo_producao.id}-${period.data_inicio}`}
          >
            <span className="animal-timeline__marker" aria-hidden="true" />
            <article className="animal-timeline__entry">
              <div className="animal-timeline__heading">
                <div>
                  <span className="animal-timeline__phase">
                    {phases[period.grupo_producao.fase] || period.grupo_producao.fase}
                  </span>
                  <h3>{period.grupo_producao.nome}</h3>
                </div>
                <span className="animal-timeline__dates">
                  <CalendarDays size={14} aria-hidden="true" />
                  {formatDate(period.data_inicio)} – {formatDate(period.data_fim)}
                </span>
              </div>
              {period.dieta ? (
                <div className="animal-timeline__diet">
                  <div className="animal-timeline__diet-title">
                    <Leaf size={16} aria-hidden="true" />
                    <strong>Dieta ativa · Sessão #{period.dieta.sessao_id}</strong>
                  </div>
                  <ul>
                    {period.dieta.ingredientes.map((ingredient) => (
                      <li key={ingredient.insumo_id}>
                        <span>
                          {ingredient.nome} ·{' '}
                          {Number(ingredient.quantidade_kg_mn).toLocaleString('pt-BR')} kg MN/dia
                        </span>
                        <strong>{formatMoney(ingredient.custo_diario)}/dia</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="animal-timeline__no-diet">Nenhuma dieta registrada neste período.</p>
              )}
              <div className="animal-timeline__cost">
                <span>
                  {period.dias} {period.dias === 1 ? 'dia' : 'dias'} ·{' '}
                  {formatMoney(period.custo_diario)}/dia
                </span>
                <strong>
                  <CircleDollarSign size={15} aria-hidden="true" />
                  Acumulado: {formatMoney(period.custo_acumulado)}
                </strong>
              </div>
            </article>
            {index < history.linha_tempo.length - 1 && (
              <span className="sr-only">Próximo período</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
