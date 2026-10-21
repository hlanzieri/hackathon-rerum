import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { scenarios } from '../components/LoteForm';

export function initialRows(data) {
  return Object.fromEntries(
    data.map((i, n) => [
      i.id,
      {
        selected: true,
        quantidade_kg_mn: [35, 2, 4, 5, 0, 0.2, 0.1][n] ?? 0,
        preco_kg_mn: i.preco_kg_mn,
        minimo_kg_ms: 0,
        maximo_kg_ms: i.categoria === 'mineral' ? 0.5 : 40,
      },
    ]),
  );
}
export default function useWorkspace() {
  const [data, setData] = useState({
    insumos: [],
    racas: [],
    lotes: [],
    grupos: [],
    base: null,
    history: [],
  });
  const [lote, setLote] = useState({ ...scenarios[0].lote }),
    [loteId, setLoteId] = useState(null),
    [editing, setEditing] = useState(true);
  const [intake, setIntake] = useState(24),
    [rows, setRows] = useState({}),
    [mode, setMode] = useState('formular');
  const [result, setResult] = useState(null),
    [snapshot, setSnapshot] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [manejo, setManejo] = useState({
    sistema: 'tmr',
    particula_adequada: true,
    milho_seco_predominante: true,
  });
  const [lastSessions, setLastSessions] = useState({ manual: null, formulated: null });
  const [grupoId, setGrupoId] = useState('');
  const [estimateInputs, setEstimateInputs] = useState(null);
  const invalidate = useCallback(() => {
    setResult(null);
    setSnapshot(null);
    setError('');
  }, []);
  const refresh = useCallback(async (signal) => {
    const [insumos, racas, lotes, grupos, base, history] = await Promise.all(
      ['/insumos', '/racas', '/lotes', '/grupos-producao', '/regras', '/sessoes'].map((path) =>
        api(path, 'GET', undefined, { signal }),
      ),
    );
    if (signal?.aborted) return;
    setData({ insumos, racas, lotes, grupos, base, history });
    setRows((old) =>
      Object.keys(old).length
        ? Object.fromEntries(
            insumos.map((i) => [
              i.id,
              old[i.id] || {
                selected: false,
                quantidade_kg_mn: 0,
                preco_kg_mn: i.preco_kg_mn,
                minimo_kg_ms: 0,
                maximo_kg_ms: i.categoria === 'mineral' ? 0.5 : 40,
              },
            ]),
          )
        : initialRows(insumos),
    );
  }, []);
  const grupoSelecionado = data.grupos.find((group) => String(group.id) === String(grupoId));
  const grupoStatsValid = Boolean(
    grupoSelecionado &&
      grupoSelecionado.numero_animais > 0 &&
      grupoSelecionado.del_medio >= 0 &&
      grupoSelecionado.peso_medio_kg > 0 &&
      grupoSelecionado.producao_media_l_dia >= 0 &&
      grupoSelecionado.ecc_medio >= 1 &&
      grupoSelecionado.fracao_multiparas >= 0 &&
      grupoSelecionado.fracao_multiparas <= 1,
  );
  const grupoCompativel = Boolean(
    grupoStatsValid &&
      grupoSelecionado.fase === lote.estado &&
      ['lactacao', 'seca'].includes(grupoSelecionado.fase),
  );
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal)
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Não foi possível conectar à API. ' + e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  async function retry() {
    setLoading(true);
    setError('');
    try {
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  function scenario(index) {
    setEstimateInputs(null);
    const scenario = scenarios[index];
    setLote({ ...scenario.lote });
    setIntake(scenario.intake);
    setLoteId(null);
    setEditing(true);
    setRows(initialRows(data.insumos));
    setManejo({ sistema: 'tmr', particula_adequada: true, milho_seco_predominante: true });
    invalidate();
  }
  function selectLote(id) {
    setEstimateInputs(null);
    const found = data.lotes.find((l) => l.id === Number(id));
    if (found) {
      const { id, ...value } = found;
      setLote(value);
      setLoteId(id);
      setEditing(false);
    } else {
      setLoteId(null);
      setEditing(true);
    }
    invalidate();
  }
  async function saveLote(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await api('/lotes', 'POST', lote);
      setLoteId(saved.id);
      setData((old) => ({ ...old, lotes: [saved, ...old.lotes] }));
      setEditing(false);
      invalidate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function run(options = {}) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const items = data.insumos
        .filter((i) => rows[i.id]?.selected)
        .map((i) => {
          const row = rows[i.id];
          const keys = ['quantidade_kg_mn', 'minimo_kg_ms', 'maximo_kg_ms', 'preco_kg_mn'];
          if (keys.some((key) => row[key] === '' || !Number.isFinite(Number(row[key]))))
            throw new Error(`Preencha os valores de ${i.nome}; campo vazio não significa zero.`);
          return {
            insumo_id: i.id,
            ...Object.fromEntries(keys.map((key) => [key, Number(row[key])])),
          };
        });
      if (!items.length) throw new Error('Selecione ao menos um insumo.');
      if (mode === 'formular' && !grupoCompativel) {
        throw new Error(
          grupoSelecionado
            ? 'O grupo precisa ter parâmetros completos e fase compatível com o lote.'
            : 'Selecione um grupo de produção válido antes de formular.',
        );
      }
      const response = await api(`/${mode}`, 'POST', {
        lote_id: loteId,
        ...(grupoCompativel ? { grupo_id: Number(grupoId) } : {}),
        consumo_ms_kg: Number(intake),
        ...manejo,
        itens: items,
        estimativa_cms: estimateInputs,
        insumos_excluidos_explicitamente: options.excludedIds || [],
      });
      const [session, history] = await Promise.all([
        api(`/sessoes/${response.session_id}`),
        api('/sessoes'),
      ]);
      setResult(response);
      setSnapshot(session.snapshot);
      setData((old) => ({ ...old, history }));
      setLastSessions((old) => ({
        ...old,
        [mode === 'verificar' ? 'manual' : 'formulated']: response.session_id,
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function fillMissingIngredient(ingredientId, values) {
    const ingredient = data.insumos.find((item) => item.id === ingredientId);
    if (!ingredient) throw new Error('Insumo não encontrado no catálogo.');
    await api(`/insumos/${ingredientId}`, 'PUT', { ...ingredient, ...values });
    await refresh();
    return run();
  }
  async function openSession(id) {
    setBusy(true);
    setError('');
    try {
      const session = await api(`/sessoes/${id}`);
      setResult(session.result);
      setSnapshot(session.snapshot);
      setGrupoId(String(session.snapshot?.grupo?.id || ''));
      const saved = session.snapshot.request;
      const { id: savedLotId, ...savedLot } = session.snapshot.lote;
      setLote(savedLot);
      setLoteId(saved.lote_id);
      setEditing(false);
      setMode(session.modo);
      setIntake(saved.consumo_ms_kg);
      setEstimateInputs(saved.estimativa_cms ?? null);
      setManejo({
        sistema: saved.sistema,
        particula_adequada: saved.particula_adequada,
        milho_seco_predominante: saved.milho_seco_predominante,
      });
      const savedItems = new Map(saved.itens.map((item) => [item.insumo_id, item]));
      const savedIngredients = new Map(
        session.snapshot.insumos.map((ingredient) => [ingredient.id, ingredient]),
      );
      const calculatedItems = new Map(
        (session.result.items || []).map((item) => [item.insumo_id, item]),
      );
      setRows(
        Object.fromEntries(
          data.insumos.map((ingredient) => {
            const savedItem = savedItems.get(ingredient.id);
            const savedIngredient = savedIngredients.get(ingredient.id);
            const calculatedItem = calculatedItems.get(ingredient.id);
            return [
              ingredient.id,
              {
                selected: Boolean(savedItem),
                quantidade_kg_mn:
                  calculatedItem?.quantidade_kg_mn ?? savedItem?.quantidade_kg_mn ?? 0,
                preco_kg_mn:
                  savedItem?.preco_kg_mn ??
                  savedIngredient?.preco_kg_mn ??
                  ingredient.preco_kg_mn,
                minimo_kg_ms: savedItem?.minimo_kg_ms ?? 0,
                maximo_kg_ms:
                  savedItem?.maximo_kg_ms ??
                  (ingredient.categoria === 'mineral' ? 0.5 : 40),
              },
            ];
          }),
        ),
      );
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function useFormulated() {
    setRows((old) => {
      const next = { ...old };
      for (const item of result.items)
        next[item.insumo_id] = {
          ...next[item.insumo_id],
          selected: true,
          quantidade_kg_mn: item.quantidade_kg_mn,
        };
      return next;
    });
    setMode('verificar');
    invalidate();
  }
  return {
    ...data,
    grupoId,
    grupoSelecionado,
    grupoStatsValid,
    grupoCompativel,
    selectGrupo: (id) => {
      setGrupoId(String(id || ''));
      setEstimateInputs(null);
      invalidate();
    },
    lote,
    setLote: (value) => {
      setLote(value);
      setEstimateInputs(null);
    },
    loteId,
    setLoteId,
    editing,
    setEditing,
    intake,
    setIntake: (value) => {
      setIntake(value);
      setEstimateInputs(null);
    },
    applyEstimate: (value, inputs) => {
      setIntake(value);
      setEstimateInputs(inputs);
      invalidate();
    },
    rows,
    setRows,
    mode,
    setMode,
    result,
    snapshot,
    busy,
    error,
    setError,
    loading,
    manejo,
    setManejo,
    lastSessions,
    invalidate,
    refresh,
    retry,
    scenario,
    selectLote,
    saveLote,
    run,
    fillMissingIngredient,
    openSession,
    useFormulated,
  };
}
