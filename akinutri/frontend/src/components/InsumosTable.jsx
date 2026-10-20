import React from 'react';
import { number, money } from '../api';

export default function InsumosTable({ insumos, rows, setRows, mode }) {
  function change(id, key, value) {
    setRows({ ...rows, [id]: { ...rows[id], [key]: value } });
  }
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Insumos e limites da dieta"
      tabIndex="0"
    >
      <table>
        <caption className="sr-only">
          Preços em matéria natural e limites de inclusão em matéria seca por animal/dia
        </caption>
        <thead>
          <tr>
            <th scope="col">Usar</th>
            <th scope="col">Insumo alimentar</th>
            <th scope="col">MS / MN</th>
            <th scope="col">R$ / kg MN</th>
            <th scope="col">{mode === 'verificar' ? 'kg MN / dia' : 'Mín. kg MS'}</th>
            <th scope="col">Máx. kg MS</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((i) => (
            <tr key={i.id} className={rows[i.id]?.selected ? '' : 'muted-row'}>
              <td>
                <label className="checkbox-target">
                  <input
                    type="checkbox"
                    aria-label={`Usar ${i.nome}`}
                    checked={!!rows[i.id]?.selected}
                    onChange={(e) => change(i.id, 'selected', e.target.checked)}
                  />
                </label>
              </td>
              <th scope="row">
                <strong>{i.nome}</strong>
                <small>{i.categoria}</small>
              </th>
              <td>
                <div
                  className="drymatter-meter"
                  aria-label={`${number(i.ms_pct, 0)}% de matéria seca`}
                >
                  <span style={{ width: `${i.ms_pct}%` }} />
                </div>
                <small>{number(i.ms_pct, 0)}% MS</small>
              </td>
              <td>
                <input
                  aria-label={`Preço MN ${i.nome}`}
                  type="number"
                  min="0"
                  max="10000"
                  step="any"
                  required
                  disabled={!rows[i.id]?.selected}
                  value={rows[i.id]?.preco_kg_mn ?? i.preco_kg_mn}
                  onChange={(e) => change(i.id, 'preco_kg_mn', e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`${mode === 'verificar' ? 'Quantidade MN' : 'Mínimo MS'} ${i.nome}`}
                  disabled={!rows[i.id]?.selected}
                  type="number"
                  min="0"
                  max={mode === 'verificar' ? 200 : 40}
                  step="any"
                  value={
                    rows[i.id]?.[mode === 'verificar' ? 'quantidade_kg_mn' : 'minimo_kg_ms'] ?? 0
                  }
                  onChange={(e) =>
                    change(
                      i.id,
                      mode === 'verificar' ? 'quantidade_kg_mn' : 'minimo_kg_ms',
                      e.target.value,
                    )
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`Máximo MS ${i.nome}`}
                  disabled={!rows[i.id]?.selected}
                  type="number"
                  min="0"
                  max="40"
                  step="any"
                  value={rows[i.id]?.maximo_kg_ms ?? 40}
                  onChange={(e) => change(i.id, 'maximo_kg_ms', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
