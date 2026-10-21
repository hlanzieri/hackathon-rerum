import React from 'react';
import { download, displayText } from '../api';
export default function KnowledgePage({ base }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Base de conhecimento · v{base.version}</h2>
          <p>Regras IF/THEN, fontes e limites publicados.</p>
        </div>
        <button className="button secondary" onClick={() => download(base, 'akinutri-base.json')}>
          Exportar JSON
        </button>
      </div>
      <p className="notice">{displayText(base.notice)}</p>
      {base.certainty_model && <p>{base.certainty_model.notice}</p>}
      {(base.inference_rules || []).map((rule) => (
        <details className="rule-profile" key={rule.id}>
          <summary>
            {rule.id} · CF {rule.rule_cf} · Prioridade {rule.salience}
          </summary>
          <p>
            IF {rule.conditions.map((c) => `${c.fact} ${c.op} ${String(c.value)}`).join(' AND ')}{' '}
            THEN {rule.assert.fact} = {String(rule.assert.value)}
          </p>
          <p>
            Revisão: {displayText(rule.governance.status)} ·{' '}
            {rule.governance.reviewed_by || 'Revisor não registrado'}
          </p>
          <p>{rule.governance.technical_justification}</p>
          <p>Fonte: {rule.governance.bibliographic_source}</p>
        </details>
      ))}
      {base.profiles.map((profile) => (
        <details className="rule-profile" key={profile.id}>
          <summary>
            <strong>{profile.label}</strong>
            <span>
              {profile.conditions.length} condições · {base.rules.length} regras
            </span>
          </summary>
          <p>
            IF {profile.conditions.map((c) => `${c.fact} ${c.op} ${c.value}`).join(' AND ')} THEN
            aplicar:
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Regra</th>
                  <th scope="col">Nutriente</th>
                  <th scope="col">Mín.</th>
                  <th scope="col">Máx.</th>
                  <th scope="col">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {base.rules.map((rule) => (
                  <tr key={rule.id}>
                    <th scope="row">{rule.id}</th>
                    <td>
                      {rule.label}
                      <small>{rule.basis}</small>
                      {rule.governance && (
                        <small>
                          CF {rule.rule_cf} · {displayText(rule.governance.status)} ·{' '}
                          {rule.governance.reviewed_by || 'Revisão pendente'}
                        </small>
                      )}
                    </td>
                    <td>
                      {rule.scale_by_intake ? 'Consumo alvo' : profile.limits[rule.metric][0]}
                    </td>
                    <td>
                      {rule.scale_by_intake ? 'Consumo alvo' : profile.limits[rule.metric][1]}
                    </td>
                    <td>{rule.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      <p className="audit-note">
        SHA-256: <code>{base.sha256}</code>
      </p>
    </section>
  );
}
