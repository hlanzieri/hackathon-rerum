import React, { useState } from 'react';
import { api, number, money, displayText } from '../api';
import Modal from './Modal';

const blank = {
  nome: '',
  categoria: 'volumoso',
  ms_pct: 35,
  pb_pct: null,
  fdn_pct: null,
  amido_pct: null,
  el_mcal_kg: null,
  ca_pct: null,
  p_pct: null,
  preco_kg_mn: 0,
  fonte: '',
};
const fields = [
  ['ms_pct', 'MS · % MN', 100],
  ['pb_pct', 'PB · % MS', 100],
  ['fdn_pct', 'FDN · % MS', 100],
  ['amido_pct', 'Amido · % MS', 100],
  ['el_mcal_kg', 'EL · Mcal/kg MS', 5],
  ['ca_pct', 'Ca · % MS', 100],
  ['p_pct', 'P · % MS', 100],
  ['preco_kg_mn', 'Preço · R$/kg MN', 10000],
];
export default function Catalogo({ insumos, reload }) {
  const [edit, setEdit] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { id, ...body } = edit;
      await api(id ? `/insumos/${id}` : '/insumos', id ? 'PUT' : 'POST', body);
      await reload();
      setEdit(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Biblioteca de insumos</h2>
          <p>Composição na matéria seca; preços na matéria natural.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError('');
            setEdit({ ...blank });
          }}
        >
          + Novo insumo
        </button>
      </div>
      <p className="notice">
        Os insumos de referência têm composição e preços ilustrativos. Substitua por análises
        bromatológicas e cotações locais.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>MS</th>
              <th>PB</th>
              <th>FDN</th>
              <th>Amido</th>
              <th>EL</th>
              <th>Ca</th>
              <th>P</th>
              <th>R$/kg MN</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong
                    className="ingredient-name block min-w-0 truncate whitespace-nowrap overflow-hidden text-ellipsis"
                    title={displayText(i.nome)}
                  >
                    {displayText(i.nome)}
                  </strong>
                  <small>{i.categoria}</small>
                </td>
                {['ms_pct', 'pb_pct', 'fdn_pct', 'amido_pct', 'el_mcal_kg', 'ca_pct', 'p_pct'].map(
                  (k) => (
                    <td key={k}>{number(i[k])}</td>
                  ),
                )}
                <td>{money(i.preco_kg_mn)}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => {
                      setError('');
                      setEdit({ ...i });
                    }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal titleId="catalog-title" onClose={() => setEdit(null)} busy={busy}>
          <h2 id="catalog-title">{edit.id ? 'Editar insumo' : 'Novo insumo'}</h2>
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="span2">
                Nome
                <input
                  required
                  value={edit.nome}
                  onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                />
              </label>
              <label className="span2">
                Categoria
                <select
                  value={edit.categoria}
                  onChange={(e) => setEdit({ ...edit, categoria: e.target.value })}
                >
                  <option value="volumoso">Volumoso</option>
                  <option value="concentrado">Concentrado</option>
                  <option value="concentrado_energetico">Concentrado energético</option>
                  <option value="concentrado_proteico">Concentrado proteico</option>
                  <option value="mineral">Mineral</option>
                </select>
              </label>
              {fields.map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    step="any"
                    min={key === 'ms_pct' ? 0.001 : 0}
                    max={max}
                    required={['ms_pct', 'preco_kg_mn'].includes(key)}
                    value={edit[key] ?? ''}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        [key]: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <label className="span2">
                Fonte / data da análise
                <input
                  required
                  maxLength="500"
                  value={edit.fonte}
                  onChange={(e) => setEdit({ ...edit, fonte: e.target.value })}
                />
              </label>
            </div>
            <p className="muted">Campo nutricional vazio significa desconhecido.</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                className="button secondary"
                onClick={() => setEdit(null)}
              >
                Cancelar
              </button>
              <button disabled={busy} className="button primary">
                {busy ? 'Salvando…' : 'Salvar insumo'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
