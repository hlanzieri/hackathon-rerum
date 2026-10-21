import React, { useState } from 'react';
import { Truck, Printer, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { api, number, download, displayText } from '../api';
export default function MixingPage({ history, initialSession }) {
  const [session, setSession] = useState(
    initialSession || history.find((h) => h.status === 'atende_perfil_demo')?.id || '',
  );
  const [batches, setBatches] = useState(1),
    [capacity, setCapacity] = useState(''),
    [scaleResolution, setScaleResolution] = useState(1),
    [report, setReport] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function generate(event, order) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      setReport(
        await api(`/sessoes/${session}/batida`, 'POST', {
          batidas_dia: Number(batches),
          resolucao_balanca_kg: Number(scaleResolution),
          ...(capacity !== '' ? { capacidade_kg: Number(capacity) } : {}),
          ...(order ? { ordem_insumos: order } : {}),
        }),
      );
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setBusy(false);
    }
  }
  function move(index, step) {
    const ids = report.items.map((i) => i.insumo_id);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    generate(null, ids);
  }
  return (
    <>
      <section className="card no-print">
        <div className="section-heading">
          <div className="step-title">
            <Truck size={24} aria-hidden="true" />
            <div>
              <h2>Da dieta ao carregamento</h2>
              <p>Quantidades por lote em matéria natural, divididas igualmente entre as batidas.</p>
            </div>
          </div>
        </div>
        <form onSubmit={generate}>
          <fieldset disabled={busy} className="mixing-form">
            <label>
              Dieta de referência
              <select
                required
                value={session}
                onChange={(e) => {
                  setSession(e.target.value);
                  setReport(null);
                }}
              >
                <option value="">Selecione uma sessão</option>
                {history
                  .filter((h) => h.status === 'atende_perfil_demo')
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      #{h.id} · {h.lote}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Batidas por dia
              <input
                required
                type="number"
                min="1"
                max="24"
                value={batches}
                onChange={(e) => {
                  setBatches(e.target.value);
                  setReport(null);
                }}
              />
            </label>
            <label>
              Capacidade do vagão · kg MN
              <input
                type="number"
                min=".01"
                max="1000000"
                step="any"
                placeholder="Opcional…"
                value={capacity}
                onChange={(e) => {
                  setCapacity(e.target.value);
                  setReport(null);
                }}
              />
            </label>
            <label>
              Resolução da balança · kg
              <input
                required
                type="number"
                min=".001"
                max="1000"
                step="any"
                value={scaleResolution}
                onChange={(e) => {
                  setScaleResolution(e.target.value);
                  setReport(null);
                }}
              />
            </label>
            <button className="button primary">{busy ? 'Calculando…' : 'Gerar relatório'}</button>
          </fieldset>
        </form>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {report && (
        <section className="card mixing-report">
          <header className="mixing-heading">
            <div>
              <p className="page-eyebrow">AKINUTRI · FICHA DE CARREGAMENTO</p>
              <h2>{report.lote}</h2>
              <p>
                Sessão #{report.session_id} · {report.animais} animais · {report.batidas_dia}{' '}
                batida(s)/dia · balança de {number(report.resolucao_balanca_kg, 3)} kg
              </p>
            </div>
            <div className="actions no-print">
              <button
                className="button secondary"
                onClick={() => download(report, 'akinutri-batida.json')}
              >
                <Download size={16} />
                JSON exato
              </button>
              <button className="button primary" onClick={() => window.print()}>
                <Printer size={16} />
                Imprimir
              </button>
            </div>
          </header>
          <div className="batch-total">
            <span>Carregar por batida</span>
            <strong>
              {number(report.total_kg_mn_batida, 3)} <small>kg MN</small>
            </strong>
            <p>Total diário do lote: {number(report.total_kg_mn_dia, 3)} kg MN</p>
          </div>
          <p className="notice">
            {report.order_source === 'definida_pelo_operador'
              ? 'Sequência definida pelo operador.'
              : 'Sequência inicial por cadastro: confirme a ordem técnica e use as setas para reorganizar.'}
          </p>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Ordem de carregamento por batida</caption>
              <thead>
                <tr>
                  <th scope="col">Ordem</th>
                  <th scope="col">Insumo</th>
                  <th scope="col">kg MN / batida</th>
                  <th scope="col">kg MN / dia</th>
                  <th className="no-print" scope="col">
                    Reordenar
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item, index) => (
                  <tr key={item.insumo_id}>
                    <td>{index + 1}</td>
                    <th scope="row">{displayText(item.nome)}</th>
                    <td className="batch-weight">{number(item.kg_mn_batida, 3)}</td>
                    <td>{number(item.kg_mn_dia, 3)}</td>
                    <td className="no-print">
                      <button
                        className="icon-button"
                        aria-label={`Subir ${displayText(item.nome)}`}
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={18} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Descer ${displayText(item.nome)}`}
                        disabled={busy || index === report.items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="notice">{displayText(report.notice)}</p>
          <p className="muted">
            Exibição com três casas decimais. JSON contém a precisão integral do cálculo.
          </p>
        </section>
      )}
    </>
  );
}
