import React, { useState } from 'react';
import { ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import data from '../data/ration-preview.json';
import { money, number } from '../api';
export default function RationPreview() {
  const [milk, setMilk] = useState(35);
  const row = data.scenarios.find((s) => s.milk_corrected_kg_day === milk);
  return (
    <aside className="ration-preview" aria-label="Prévia interativa de uma dieta demonstrativa">
      <div className="preview-toolbar">
        <span>
          <span className="signal-dot" /> LABORATÓRIO DE DIETAS
        </span>
        <SlidersHorizontal size={17} aria-hidden="true" />
      </div>
      <div className="preview-heading">
        <div>
          <small>LOTE DEMONSTRATIVO / 01</small>
          <h2>Holandesas em lactação</h2>
        </div>
        <span className="preview-tag">TMR</span>
      </div>
      <label className="preview-slider-label" htmlFor="preview-production">
        Leite corrigido · kg/animal/dia{' '}
        <output htmlFor="preview-production">
          {milk}
          <small> kg</small>
        </output>
      </label>
      <input
        id="preview-production"
        aria-label="Leite corrigido · kg/animal/dia"
        type="range"
        min="20"
        max="45"
        step="1"
        value={milk}
        onChange={(e) => setMilk(Number(e.target.value))}
        aria-describedby="preview-assumptions"
      />
      <div className="slider-scale">
        <span>20 kg</span>
        <span>Arraste para explorar</span>
        <span>45 kg</span>
      </div>
      <div className="preview-cost">
        <span>CUSTO / ANIMAL / DIA</span>
        <strong aria-label="Custo demonstrativo por animal e dia">
          {money(row.totals.custo_animal_dia)}
        </strong>
        <small>Menor custo no cenário demonstrativo</small>
      </div>
      <dl className="preview-nutrients">
        <div>
          <dt>FDN total</dt>
          <dd>
            {number(row.totals.fdn_pct, 1)}
            <small> % MS</small>
          </dd>
        </div>
        <div>
          <dt>Proteína bruta</dt>
          <dd>
            {number(row.totals.pb_pct, 1)}
            <small> % MS</small>
          </dd>
        </div>
        <div>
          <dt>Consumo de MS</dt>
          <dd>
            {number(row.totals.ms_kg, 1)}
            <small> kg/dia</small>
          </dd>
        </div>
      </dl>
      <div className="preview-ration" aria-label="Composição demonstrativa em kg de matéria seca">
        {row.items.map((item) => (
          <div key={item.name}>
            <span>{item.name.replace(' DEMO', '')}</span>
            <strong>
              {number(item.kg_ms, 2)} <small>kg MS</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="preview-foot">
        <span>
          <span className="signal-dot" /> Regras conferidas · v{data.knowledge_version}
        </span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </div>
      <p id="preview-assumptions" className="preview-disclosure">
        Resultados pré-calculados em Python, sem interpolação. Holandesa, 650 kg, 100 dias em
        lactação, ECC 3, multípara; energia de referência 0,7 Mcal/kg. Perfil fixo de alta produção
        (35 L/dia). Leite corrigido não é leite bruto em litros. Preços sintéticos; não é
        prescrição.
      </p>
    </aside>
  );
}
