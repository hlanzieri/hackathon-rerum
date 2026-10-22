import React from 'react';

export const scenarios = [
  {
    label: 'Holandesa · alta produção',
    intake: 24,
    lote: {
      nome: 'Holandesas — alta produção',
      raca_id: 1,
      quantidade: 40,
      peso_kg: 650,
      idade_meses: 48,
      ordem_paricao: 3,
      estado: 'lactacao',
      destinacao: 'leite',
      producao_l_dia: 35,
      dias_lactacao: 100,
      dias_ate_parto: null,
    },
  },
  {
    label: 'Gir · meio de lactação',
    intake: 16,
    lote: {
      nome: 'Gir — meio de lactação',
      raca_id: 2,
      quantidade: 25,
      peso_kg: 450,
      idade_meses: 60,
      ordem_paricao: 3,
      estado: 'lactacao',
      destinacao: 'leite',
      producao_l_dia: 15,
      dias_lactacao: 150,
      dias_ate_parto: null,
    },
  },
  {
    label: 'Lote · período seco',
    intake: 12,
    lote: {
      nome: 'Vacas secas — distante do parto',
      raca_id: 3,
      quantidade: 15,
      peso_kg: 550,
      idade_meses: 48,
      ordem_paricao: 2,
      estado: 'seca',
      destinacao: 'reproducao',
      producao_l_dia: 0,
      dias_lactacao: null,
      dias_ate_parto: 45,
    },
  },
];

export default function LoteForm({ value, onChange, racas, save, busy }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const num = (label, key, min, max, step = 1) => (
    <label>
      {label}
      <input
        required
        type="number"
        min={min}
        max={max}
        step={step}
        value={value[key] ?? ''}
        onChange={(e) => set(key, e.target.value === '' ? '' : Number(e.target.value))}
      />
    </label>
  );
  return (
    <form onSubmit={save} className="lote-form">
      <div className="form-grid">
        <label className="span2">
          Nome do lote
          <input
            required
            maxLength="120"
            value={value.nome}
            onChange={(e) => set('nome', e.target.value)}
          />
        </label>
        <label>
          Raça
          <select value={value.raca_id} onChange={(e) => set('raca_id', Number(e.target.value))}>
            {racas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
        {num('Animais no lote', 'quantidade', 1, 100000)}
        {num('Peso médio · kg', 'peso_kg', 200, 1000, 0.1)}
        {num('Idade média · meses', 'idade_meses', 18, 240)}
        {num('Ordem de parição', 'ordem_paricao', 1, 15)}
        <label>
          Estado produtivo
          <select
            value={value.estado}
            onChange={(e) =>
              onChange({
                ...value,
                estado: e.target.value,
                producao_l_dia: e.target.value === 'seca' ? 0 : 15,
                dias_lactacao: e.target.value === 'seca' ? null : 100,
                dias_ate_parto: e.target.value === 'seca' ? 45 : null,
              })
            }
          >
            <option value="lactacao">Em lactação</option>
            <option value="seca">Período seco</option>
          </select>
        </label>
        {num(
          'Produção · L/animal/dia',
          'producao_l_dia',
          value.estado === 'seca' ? 0 : 0.1,
          value.estado === 'seca' ? 0 : 80,
          0.1,
        )}
        {value.estado === 'lactacao'
          ? num('Dias em lactação', 'dias_lactacao', 1, 700)
          : num('Dias até o parto', 'dias_ate_parto', 1, 100)}
        <label className="span2">
          Destinação econômica
          <select value={value.destinacao} onChange={(e) => set('destinacao', e.target.value)}>
            <option value="leite">Produção de leite</option>
            <option value="reproducao">Reprodução</option>
            <option value="dupla_aptidao">Dupla aptidão</option>
          </select>
        </label>
        <label className="span2">
          Destino do leite
          <select
            value={value.destinacao_economica ?? 'leite_fluido'}
            onChange={(e) => set('destinacao_economica', e.target.value)}
          >
            <option value="leite_fluido">Leite fluido</option>
            <option value="queijo_artesanal">Queijo artesanal · perfil experimental</option>
          </select>
        </label>
        {(Number(value.idade_meses) <= 36 || Number(value.ordem_paricao) === 1) && (
          <>
            <p className="span2 notice">
              Reserva experimental de crescimento: 10% sobre a mantença informada, sem duplicação
              por idade e parição. Valores devem corresponder aos animais analisados; não garantem
              escore corporal.
            </p>
            {num('PB de mantença · kg/animal/dia', 'mantenca_pb_kg_dia', 0.001, 5, 'any')}
            {num('EL de mantença · Mcal/animal/dia', 'mantenca_el_mcal_dia', 0.001, 40, 'any')}
            <label className="span2">
              Fonte da estimativa de mantença
              <input
                required
                maxLength="500"
                value={value.fonte_mantenca ?? ''}
                onChange={(e) => set('fonte_mantenca', e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <button className="button secondary" disabled={busy}>
        Salvar lote e continuar
      </button>
    </form>
  );
}
