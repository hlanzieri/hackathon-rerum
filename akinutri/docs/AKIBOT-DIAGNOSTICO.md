# Auditoria e correção do AkiBot — 22/10/2026

## Diagnóstico

A implementação encontrada é `frontend/src/components/AkiBotWizard.jsx`. O `grupo_id` já era enviado nos dois modos. Não há cálculo nutricional local no assistente: consumo estimado, verificação e formulação usam a API local; a otimização usa `scipy.optimize.linprog` com HiGHS.

As lacunas confirmadas foram:

- CF acima do teto da fonte declarada e idade/ordem de parição fracionárias podiam chegar ao Pydantic e gerar 422.
- O cliente HTTP descartava status e corpo estruturado ao lançar erros.
- O assistente encaminhava respostas de insuficiência e inviabilidade diretamente à abertura da sessão, sem explicar o problema no próprio assistente.
- A verificação manual não identificava os insumos ativos responsáveis pelos nutrientes ausentes, embora retornasse `dados_insuficientes`.
- Os preços-sombra tinham folgas e resíduos, mas não um indicador explícito de restrição vinculante.

Não foi reproduzido um incidente de produção nem fornecido um payload real com falha; estes achados decorrem da inspeção e dos testes locais.

## Contrato efetivamente implementado

O fluxo é `POST /api/lotes` com os parâmetros do grupo e do usuário, seguido de `POST /api/formular` ou `POST /api/verificar` com `lote_id`, `grupo_id`, consumo, evidências e `itens` por `insumo_id`. A API valida os DTOs, busca a composição cadastrada e registra o snapshot com lote, grupo, insumos e resultado.

`lote_parametros` e `insumos` não são campos de `InferenciaRequest`/`FormulacaoRequest`: adicioná-los à requisição atual causaria 422 porque o DTO usa `extra="forbid"`. Mantivemos o contrato normalizado existente. `calcio_pct`/`fosforo_pct` são aliases de entrada do cadastro; os nomes canônicos internos são `ca_pct`/`p_pct`. Valores ausentes continuam ausentes; nunca são substituídos por zero.

## Alterações

- `buildInferenceRequest` centraliza a montagem do payload e valida lote, grupo, modo, consumo e teto de CF; a interface também valida campos inteiros e limites do lote.
- Erros HTTP preservam `status` e `data`, mantendo as mensagens de validação do Pydantic.
- `analysisFeedback` apresenta insumo e nutrientes faltantes, ou o conjunto de restrições em conflito devolvido pelo motor. Não inventa um nutriente como causa única de inviabilidade.
- Resultados bloqueados permanecem no assistente e podem ser reenviados após correção; respostas bem-sucedidas mantêm a proteção contra duplicação quando apenas a abertura da sessão falha.
- O estado de processamento anuncia “Calculando otimização via SciPy HiGHS...”.
- `/api/verificar` agora retorna `insumos_incompletos` para os ingredientes com quantidade positiva e composição ausente.
- O solver calcula `binding` com a tolerância numérica da base para cada preço-sombra; o painel apenas exibe o indicador. Custo por animal/dia, inclusão em MS/MN e CF global já eram exibidos pelos painéis de resultado e explicação.

## Validação

- `npm test`: 61 testes passaram; após a extração da montagem do payload, os 9 testes do AkiBot foram repetidos e passaram.
- `npm run build`: passou na versão final do frontend.
- O pytest requer execução fora do sandbox neste Windows: dentro dele, o diretório temporário padrão falhou e o socketpair do asyncio travou. A validação usa diretório temporário dedicado dentro de `.test-runs`.
- O novo teste de verificação com PB/Cálcio/Fósforo ausentes passou com um insumo privado criado pela API.
- Suíte final completa (`pytest -q --tb=short --basetemp=../.test-runs/akibot-20261022-validated`): **138 testes passaram**, 1 aviso de depreciação, em 61,18 s.

Nenhum dado real foi alterado pelos testes; as fixtures usam bancos SQLite temporários. Existe um aviso de depreciação do `BlockingPortal` do Starlette/AnyIO.
