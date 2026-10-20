import React, { useCallback, useEffect, useState } from 'react';
import { Archive, CalendarDays, ChevronRight, RefreshCw, UsersRound } from 'lucide-react';
import { api } from '../api';
import AnimalTimeline from './AnimalTimeline';

const phases = [
  ['bezerril', 'Bezerril'],
  ['recria', 'Recria'],
  ['lactacao', 'Lactação'],
  ['seca', 'Seca'],
];

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateLabel(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

function phaseLabel(value) {
  return phases.find(([phase]) => phase === value)?.[1] || value;
}

function Field({ label, children }) {
  return (
    <label className="animal-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AnimaisPage() {
  const [groups, setGroups] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [timeline, setTimeline] = useState(null);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupForm, setGroupForm] = useState({ nome: '', fase: 'bezerril', descricao: '' });
  const [animalForm, setAnimalForm] = useState({
    brinco: '',
    nome: '',
    data_nascimento: '',
    sexo: 'femea',
    grupo_producao_id: '',
    data_inicio_gp: localDate(),
  });
  const [dietForm, setDietForm] = useState({ sessao_id: '', data_inicio: localDate() });
  const [movementForm, setMovementForm] = useState({
    grupo_producao_id: '',
    data_inicio: localDate(),
  });

  const refresh = useCallback(async () => {
    const [nextGroups, nextAnimals, nextSessions] = await Promise.all([
      api('/grupos-producao'),
      api('/animais'),
      api('/sessoes'),
    ]);
    setGroups(nextGroups);
    setAnimals(nextAnimals);
    setSessions(nextSessions.filter((session) => session.modo === 'formular'));
    setSelectedGroupId((current) =>
      nextGroups.some((group) => String(group.id) === current)
        ? current
        : String(nextGroups[0]?.id || ''),
    );
    setSelectedAnimalId((current) =>
      nextAnimals.some((animal) => String(animal.id) === current)
        ? current
        : String(nextAnimals[0]?.id || ''),
    );
  }, []);

  useEffect(() => {
    refresh()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!selectedAnimalId) {
      setTimeline(null);
      return undefined;
    }
    const controller = new AbortController();
    api(`/animais/${selectedAnimalId}/historico-nutricional`, 'GET', undefined, {
      signal: controller.signal,
    })
      .then(setTimeline)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      });
    return () => controller.abort();
  }, [selectedAnimalId, timelineVersion]);

  const selectedGroup = groups.find((group) => String(group.id) === selectedGroupId);
  const selectedAnimal = animals.find((animal) => String(animal.id) === selectedAnimalId);
  const availableSessions = sessions.filter((session) => session.status === 'atende_perfil_demo');

  async function perform(action, successMessage) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await refresh();
      setTimelineVersion((value) => value + 1);
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function createGroup(event) {
    event.preventDefault();
    perform(async () => {
      const created = await api('/grupos-producao', 'POST', groupForm);
      setSelectedGroupId(String(created.id));
      setGroupForm({ nome: '', fase: 'bezerril', descricao: '' });
    }, 'Grupo de produção cadastrado.');
  }

  function createAnimal(event) {
    event.preventDefault();
    perform(async () => {
      const created = await api('/animais', 'POST', {
        ...animalForm,
        grupo_producao_id: Number(animalForm.grupo_producao_id),
      });
      setSelectedAnimalId(String(created.id));
      setAnimalForm((current) => ({
        ...current,
        brinco: '',
        nome: '',
        data_nascimento: '',
      }));
    }, 'Animal cadastrado e associado ao grupo.');
  }

  function assignDiet(event) {
    event.preventDefault();
    if (!selectedGroupId) return;
    perform(
      () =>
        api(`/grupos-producao/${selectedGroupId}/atribuir-dieta`, 'POST', {
          sessao_id: Number(dietForm.sessao_id),
          data_inicio: dietForm.data_inicio,
        }),
      'Dieta registrada como ativa para o grupo.',
    );
  }

  function moveAnimal(event) {
    event.preventDefault();
    if (!selectedAnimalId) return;
    perform(
      () =>
        api(`/animais/${selectedAnimalId}/movimentacoes`, 'POST', {
          grupo_producao_id: Number(movementForm.grupo_producao_id),
          data_inicio: movementForm.data_inicio,
        }),
      'Movimentação registrada no histórico do animal.',
    );
  }

  function archiveAnimal(animal) {
    perform(
      () => api(`/animais/${animal.id}`, 'DELETE'),
      'Animal arquivado; o histórico foi preservado.',
    );
  }

  function archiveGroup(group) {
    perform(
      () => api(`/grupos-producao/${group.id}`, 'DELETE'),
      'Grupo arquivado; o histórico foi preservado.',
    );
  }

  if (loading) {
    return (
      <div className="card loading-state" role="status">
        Carregando grupos e animais...
      </div>
    );
  }

  return (
    <div className="animal-module">
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="animal-notice" role="status">
          {notice}
        </div>
      )}

      <section className="animal-overview-grid" aria-label="Resumo de grupos e animais">
        <article className="card animal-overview-card">
          <span>Grupos ativos</span>
          <strong>{groups.length}</strong>
          <small>Fases de produção configuradas</small>
        </article>
        <article className="card animal-overview-card">
          <span>Animais cadastrados</span>
          <strong>{animals.length}</strong>
          <small>Com histórico de grupo registrado</small>
        </article>
        <article className="card animal-overview-card">
          <span>Formulações prontas</span>
          <strong>{availableSessions.length}</strong>
          <small>Disponíveis para ativar em um GP</small>
        </article>
      </section>

      <section className="animal-forms-grid" aria-label="Cadastros">
        <form className="card animal-form" onSubmit={createGroup}>
          <div className="section-heading">
            <div>
              <h2>Novo grupo de produção</h2>
              <p>Organize os lotes por fase de vida e manejo.</p>
            </div>
            <UsersRound size={20} aria-hidden="true" />
          </div>
          <Field label="Nome do grupo">
            <input
              maxLength={120}
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, nome: event.target.value }))
              }
              required
              value={groupForm.nome}
            />
          </Field>
          <Field label="Fase de produção">
            <select
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, fase: event.target.value }))
              }
              value={groupForm.fase}
            >
              {phases.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Descrição (opcional)">
            <input
              maxLength={500}
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, descricao: event.target.value }))
              }
              value={groupForm.descricao}
            />
          </Field>
          <button className="button primary" disabled={busy} type="submit">
            Cadastrar grupo
          </button>
        </form>

        <form className="card animal-form" onSubmit={createAnimal}>
          <div className="section-heading">
            <div>
              <h2>Novo animal</h2>
              <p>O cadastro inicia o histórico no grupo escolhido.</p>
            </div>
            <UsersRound size={20} aria-hidden="true" />
          </div>
          <div className="animal-field-grid">
            <Field label="Brinco / identificação">
              <input
                maxLength={60}
                onChange={(event) =>
                  setAnimalForm((current) => ({ ...current, brinco: event.target.value }))
                }
                required
                value={animalForm.brinco}
              />
            </Field>
            <Field label="Nome">
              <input
                maxLength={120}
                onChange={(event) =>
                  setAnimalForm((current) => ({ ...current, nome: event.target.value }))
                }
                required
                value={animalForm.nome}
              />
            </Field>
            <Field label="Data de nascimento">
              <input
                max={localDate()}
                onChange={(event) =>
                  setAnimalForm((current) => ({
                    ...current,
                    data_nascimento: event.target.value,
                  }))
                }
                required
                type="date"
                value={animalForm.data_nascimento}
              />
            </Field>
            <Field label="Sexo">
              <select
                onChange={(event) =>
                  setAnimalForm((current) => ({ ...current, sexo: event.target.value }))
                }
                value={animalForm.sexo}
              >
                <option value="femea">Fêmea</option>
                <option value="macho">Macho</option>
              </select>
            </Field>
            <Field label="Grupo inicial">
              <select
                onChange={(event) =>
                  setAnimalForm((current) => ({
                    ...current,
                    grupo_producao_id: event.target.value,
                  }))
                }
                required
                value={animalForm.grupo_producao_id}
              >
                <option value="">Selecione um grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.nome} · {phaseLabel(group.fase)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entrada no grupo">
              <input
                max={localDate()}
                onChange={(event) =>
                  setAnimalForm((current) => ({
                    ...current,
                    data_inicio_gp: event.target.value,
                  }))
                }
                required
                type="date"
                value={animalForm.data_inicio_gp}
              />
            </Field>
          </div>
          <button className="button primary" disabled={busy || !groups.length} type="submit">
            Cadastrar animal
          </button>
          {!groups.length && (
            <p className="animal-inline-help">Cadastre um grupo de produção antes dos animais.</p>
          )}
        </form>
      </section>

      <section className="card animal-groups-section">
        <div className="section-heading">
          <div>
            <h2>Grupos de produção</h2>
            <p>Confira as fases cadastradas e a dieta vigente em cada grupo.</p>
          </div>
          <button
            aria-label="Atualizar grupos e animais"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              refresh()
                .catch((requestError) => setError(requestError.message))
                .finally(() => setBusy(false));
            }}
            type="button"
          >
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
        </div>
        {groups.length ? (
          <div className="animal-groups-grid">
            {groups.map((group) => (
              <article className="animal-group-card" key={group.id}>
                <div>
                  <span className="animal-stage-pill">{phaseLabel(group.fase)}</span>
                  <h3>{group.nome}</h3>
                  <p>
                    {group.dieta_ativa
                      ? `Dieta ativa desde ${dateLabel(group.dieta_data_inicio)} · Sessão #${group.dieta_ativa}`
                      : 'Nenhuma dieta ativa registrada'}
                  </p>
                </div>
                <button
                  aria-label={`Arquivar grupo ${group.nome}`}
                  className="animal-icon-button"
                  disabled={busy}
                  onClick={() => archiveGroup(group)}
                  title="Arquivar grupo"
                  type="button"
                >
                  <Archive size={16} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">Cadastre um grupo para organizar os animais por fase.</p>
        )}
      </section>

      <section className="card animal-list-section">
        <div className="section-heading">
          <div>
            <h2>Animais cadastrados</h2>
            <p>Selecione um animal para consultar e atualizar sua linha do tempo.</p>
          </div>
        </div>
        {animals.length ? (
          <div className="animal-list">
            {animals.map((animal) => (
              <article
                className={`animal-list-card${selectedAnimalId === String(animal.id) ? ' is-selected' : ''}`}
                key={animal.id}
              >
                <button
                  aria-current={selectedAnimalId === String(animal.id) ? 'true' : undefined}
                  className="animal-select"
                  onClick={() => setSelectedAnimalId(String(animal.id))}
                  type="button"
                >
                  <span className="animal-avatar">{animal.nome.slice(0, 1).toUpperCase()}</span>
                  <span className="animal-select__details">
                    <strong>{animal.nome}</strong>
                    <small>
                      {animal.brinco} · {animal.grupo_producao?.nome || 'Sem grupo'}
                    </small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
                <button
                  aria-label={`Arquivar animal ${animal.nome}`}
                  className="animal-icon-button"
                  disabled={busy}
                  onClick={() => archiveAnimal(animal)}
                  title="Arquivar animal"
                  type="button"
                >
                  <Archive size={16} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">Nenhum animal cadastrado ainda.</p>
        )}
      </section>

      {selectedAnimal && (
        <>
          <section className="card animal-detail-card">
            <div className="animal-detail-heading">
              <div>
                <span className="animal-stage-pill">
                  {selectedAnimal.grupo_producao
                    ? phaseLabel(selectedAnimal.grupo_producao.fase)
                    : 'Sem grupo'}
                </span>
                <h2>{selectedAnimal.nome}</h2>
                <p>
                  Brinco {selectedAnimal.brinco} · Nascimento em{' '}
                  {dateLabel(selectedAnimal.data_nascimento)}
                </p>
              </div>
              <span className="animal-current-group">
                Grupo atual: {selectedAnimal.grupo_producao?.nome || 'Não definido'}
              </span>
            </div>
            <form className="animal-transfer-form" onSubmit={moveAnimal}>
              <Field label="Transferir para outro GP">
                <select
                  onChange={(event) =>
                    setMovementForm((current) => ({
                      ...current,
                      grupo_producao_id: event.target.value,
                    }))
                  }
                  required
                  value={movementForm.grupo_producao_id}
                >
                  <option value="">Selecione o novo grupo</option>
                  {groups
                    .filter((group) => group.id !== selectedAnimal.grupo_producao_id)
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.nome} · {phaseLabel(group.fase)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Data de início no novo GP">
                <input
                  max={localDate()}
                  min={selectedAnimal.data_nascimento}
                  onChange={(event) =>
                    setMovementForm((current) => ({
                      ...current,
                      data_inicio: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={movementForm.data_inicio}
                />
              </Field>
              <button
                className="button secondary"
                disabled={busy || !selectedAnimal.grupo_producao_id}
                type="submit"
              >
                Registrar movimentação
              </button>
            </form>
          </section>

          <div className="animal-assign-grid">
            <section className="card animal-assign-card">
              <div className="section-heading">
                <div>
                  <h2>Ativar dieta em um GP</h2>
                  <p>Selecione uma formulação gravada e a data em que passa a valer.</p>
                </div>
                <CalendarDays size={19} aria-hidden="true" />
              </div>
              <form className="animal-assign-form" onSubmit={assignDiet}>
                <Field label="Grupo">
                  <select
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                    required
                    value={selectedGroupId}
                  >
                    <option value="">Selecione um grupo</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Formulação válida">
                  <select
                    onChange={(event) =>
                      setDietForm((current) => ({ ...current, sessao_id: event.target.value }))
                    }
                    required
                    value={dietForm.sessao_id}
                  >
                    <option value="">Selecione uma sessão</option>
                    {availableSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        #{session.id} · {session.lote} · {dateLabel(session.criada_em.slice(0, 10))}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Data de início">
                  <input
                    max={localDate()}
                    onChange={(event) =>
                      setDietForm((current) => ({ ...current, data_inicio: event.target.value }))
                    }
                    required
                    type="date"
                    value={dietForm.data_inicio}
                  />
                </Field>
                <button
                  className="button primary"
                  disabled={busy || !selectedGroupId || !availableSessions.length}
                  type="submit"
                >
                  Definir dieta ativa
                </button>
                {!availableSessions.length && (
                  <p className="animal-inline-help">
                    Formule uma dieta que atenda ao perfil para habilitar a seleção.
                  </p>
                )}
              </form>
            </section>
          </div>

          <AnimalTimeline history={timeline?.animal?.id === selectedAnimal.id ? timeline : null} />
        </>
      )}
      {!animals.length && !groups.length && (
        <div className="notice">
          Cadastre um GP e um animal para começar a registrar o histórico de vida e nutrição.
        </div>
      )}
    </div>
  );
}
