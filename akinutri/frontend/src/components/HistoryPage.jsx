import React from 'react';
import { statusLabel } from './TracoPanel';
export default function HistoryPage({ history, busy, onOpen }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Histórico de análises</h2>
          <p>Até 100 sessões recentes. Abrir uma sessão verifica os hashes e recalcula o traço.</p>
        </div>
      </div>
      {!history.length ? (
        <p className="notice">Execute uma análise para iniciar o histórico.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Sessão</th>
                <th scope="col">Lote</th>
                <th scope="col">Data</th>
                <th scope="col">Operação</th>
                <th scope="col">Resultado</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <th scope="row">#{h.id}</th>
                  <td>{h.lote}</td>
                  <td>{new Date(h.criada_em).toLocaleString('pt-BR')}</td>
                  <td>{h.modo === 'formular' ? 'Formulação LP' : 'Verificação'}</td>
                  <td>{statusLabel(h.status)}</td>
                  <td>
                    <button disabled={busy} className="text-button" onClick={() => onOpen(h.id)}>
                      Consultar #{h.id} ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
