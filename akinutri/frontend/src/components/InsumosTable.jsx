import React from 'react';
import { number, money, displayText } from '../api';

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
            <th scope="col">Origem da composição</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((i) => (
            <tr key={i.id} className={rows[i.id]?.selected ? '' : 'muted-row'}>
              <td>
                <label className="checkbox-target">
                  <input
                    type="checkbox"
                    aria-label={`Usar ${displayText(i.nome)}`}
                    checked={!!rows[i.id]?.selected}
                    onChange={(e) => change(i.id, 'selected', e.target.checked)}
                  />
                </label>
              </td>
              <th scope="row">
                <strong
                  className="ingredient-name block min-w-0 truncate whitespace-nowrap overflow-hidden text-ellipsis"
                  title={displayText(i.nome)}
                >
                  {displayText(i.nome)}
                </strong>
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
                  aria-label={`Preço MN ${displayText(i.nome)}`}
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
                  aria-label={`${mode === 'verificar' ? 'Quantidade MN' : 'Mínimo MS'} ${displayText(i.nome)}`}
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
                  aria-label={`Máximo MS ${displayText(i.nome)}`}
                  disabled={!rows[i.id]?.selected}
                  type="number"
                  min="0"
                  max="40"
                  step="any"
                  value={rows[i.id]?.maximo_kg_ms ?? 40}
                  onChange={(e) => change(i.id, 'maximo_kg_ms', e.target.value)}
                />
              </td>
              <td>
                <select
                  aria-label={`Origem da composição ${displayText(i.nome)}`}
                  disabled={!rows[i.id]?.selected}
                  value={rows[i.id]?.evidencia_composicao?.source ?? 'tabela'}
                  onChange={(e) =>
                    change(i.id, 'evidencia_composicao', {
                      source: e.target.value,
                      cf: { laboratorio: 1, tabela: 0.85, usuario: 0.7 }[e.target.value],
                    })
                  }
                >
                  <option value="tabela">Tabela · 0,85</option>
                  <option value="laboratorio">Laboratório · 1,00</option>
                  <option value="usuario">Campo · 0,70</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
