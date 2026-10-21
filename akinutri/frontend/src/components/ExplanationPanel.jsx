import React, { useState } from 'react';
import { api, number } from '../api';

export function QuestionWhy({ fact, label = 'Por que esta informação?' }) {
  const [answer, setAnswer] = useState(null);
  return (
    <div>
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          try {
            setAnswer(
              (await api(`/explicacao/por-que-pergunta?fato=${encodeURIComponent(fact)}`)).message,
            );
          } catch (error) {
            setAnswer(error.message);
          }
        }}
      >
        {label}
      </button>
      {answer && <p role="status">{answer}</p>}
    </div>
  );
}

export default function ExplanationPanel({ result }) {
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState('');
  if (!result.reasoning) return null;
  async function load(kind) {
    setError('');
    setAnswer(null);
    try {
      setAnswer(await api(`/explicacao/${kind}?sessao_id=${result.session_id}`));
    } catch (failure) {
      setError(failure.message);
    }
  }
  return (
    <section aria-label="Explicação ativa da inferência">
      <h3>Por quê e como?</h3>
      <p>
        Suporte global (CF):{' '}
        {result.global_cf == null ? 'Não aplicável' : number(result.global_cf, 3)}
      </p>
      <p>{result.reasoning.certainty_notice}</p>
      <div className="missing-actions">
        <button type="button" className="button secondary" onClick={() => load('por-que-perfil')}>
          Por que este perfil?
        </button>
        <button type="button" className="button secondary" onClick={() => load('como-concluiu')}>
          Como concluiu?
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => load('gargalo-formulacao')}
        >
          O que impediu a formulação?
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {answer && (
        <div role="status">
          {answer.message && <p>{answer.message}</p>}
          {answer.steps?.map((step, index) => (
            <p key={index}>
              Rodada {step.round} · {step.rule_id}:{' '}
              {Object.entries(step.premises)
                .map(
                  ([key, value]) => `${key} = ${String(value.value)} (CF ${number(value.cf, 3)})`,
                )
                .join('; ')}{' '}
              → {step.conclusion} = {String(step.value)} (CF {number(step.cf, 3)})
            </p>
          ))}
          {answer.conflicts?.length > 0 && (
            <p>Decisão bloqueada por conflito. Revise os fatos e as regras indicadas abaixo.</p>
          )}
          {answer.bottleneck && (
            <ul>
              {answer.bottleneck.constraints.map((entry) => (
                <li key={entry.id}>{entry.id}</li>
              ))}
            </ul>
          )}
          <details>
            <summary>Conferir fatos, condições, regras e restrições</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {JSON.stringify(answer, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
