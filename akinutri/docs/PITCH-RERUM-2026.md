# Preparação do pitch RERUM 2026

## Golden seed executado

Comando a partir de `backend`: `../.venv/Scripts/python.exe seed_apresentacao.py`.
Em uma instalação Python com as dependências ativadas: `python seed_apresentacao.py`.

O script foi executado duas vezes no SQLite configurado em `backend/akinutri.db`:

- Conta ID 1: Dr. Carlos Eduardo de Moraes, `carlos@fazendaouroverde.com.br`, cargo zootecnista, Fazenda Ouro Verde. Senha bcrypt conferida com a credencial solicitada.
- Quatro lotes e quatro grupos, totalizando 115 animais. Os IDs foram preservados nas duas execuções.
- Alta lactação: 45 animais, 650 kg, DEL 120, 35,5 L/dia, ordem 2, TMR ativado.
- Baixa lactação: 25 animais, 600 kg, DEL 220, 15 L/dia, ordem 3, TMR ativado.
- Secas: 15 animais, 700 kg, DEL 0, produção zero, TMR desativado, 45 dias até o parto como pressuposto explícito do cadastro.
- Recria: 30 animais, 350 kg, DEL 0, produção zero, TMR desativado; cadastro permitido e análise bloqueada pelo escopo atual.
- Cinco insumos privados: quatro composições completas e Feno de Teste com Ca/P ausentes. Conferência campo a campo com a tabela enviada pelo usuário.

Cada execução cria um backup SQLite consistente em `backups/pre-golden-seed-*.db` antes da alteração. A limpeza dos insumos tem filtro explícito por usuário. Lotes/grupos necessários são reutilizados; extras sem referências são removidos. Referências de auditoria são preservadas. Os quatro snapshots anteriores dessa conta continuam intactos. O catálogo compartilhado permanece disponível e não é apagado.

## Origem dos números

`INSUMOS_SEED_OFICIAL` contém os valores exatos fornecidos pelo usuário, com sua atribuição a NASEM 2021/CQAL Embrapa registrada no campo `fonte`. A atribuição bibliográfica por item não foi certificada nesta revisão. O artigo Rehagro é referência conceitual, sem tabela quantitativa dos quatro produtos: https://rehagro.com.br/blog/nasem-2021-exigencias-nutricionais-de-bovinos-leiteiros/ . O nome do núcleo não comprova efeito aniônico sem composição iônica/DCAD.

É possível substituir os quatro alimentos completos com `--composicoes arquivo.json`. A lista é validada pelo Pydantic antes de modificar dados. Valores zero legítimos do núcleo são mantidos; nutrientes desconhecidos não são preenchidos com zero.

## Blindagem do contrato e solver

- `itens` continua sendo o contrato canônico; `insumos_ids` é aceito como alternativa, sem permitir ambos na mesma requisição.
- Seleção vazia nos endpoints de inferência retorna HTTP 400 com `code: DADOS_INSUFICIENTES` e mensagem de seleção obrigatória.
- Quantidades e limites de inclusão ficam limitados a 500. Zero permanece válido para formulação sem ração prévia, mínimos opcionais e indisponibilidade explícita, funcionalidades existentes testadas.
- Otimização usa `method="highs"`, `time_limit=3.0`, `presolve=True`, preservando as tolerâncias numéricas anteriores.
- Status numérico 1 retorna HTTP 408; status 2 devolve inviabilidade e diagnóstico de restrições; exceções inesperadas da execução/diagnóstico são tratadas e registradas no backend.
- Sucesso mantém os estados públicos existentes `otimo`/`atende_perfil_demo`, necessários à auditoria, aos relatórios e à UI. Não foi introduzido um estado incompatível `sucesso`.
- O diagnóstico de inviabilidade tem orçamento próprio de até 3 s, além do limite da otimização principal.

## Interface do pitch

A barra lateral mostra somente Painel do Lote, AkiBot, Batida do Vagão, Insumos e Base de conhecimento. Rotas de histórico, comparação, resultado e gestão de animais continuam disponíveis por URL e pelos fluxos existentes, sem links na barra lateral.

Botões de formulação exibem spinner e “Otimizando via SciPy HiGHS...” durante processamento. O botão e os demais controles ficam desabilitados. Não foram encontradas chamadas nativas `alert()` no código React/JS de `src`; os erros já usam notificações em página.

## Validação final

- Golden seed: duas execuções bem-sucedidas, mesmas identidades de lotes/grupos e cinco insumos privados.
- SQLite: `PRAGMA quick_check` = `ok`; `PRAGMA foreign_key_check` sem violações.
- Prévia somente em memória com os dados gravados: alta lactação com CMS 24 kg MS/dia e baixa com CMS 18 kg MS/dia retornaram `otimo`; adicionar o feno incompleto retornou `dados_insuficientes`.
- Secas com TMR desativado e recria permanecem fora do escopo. Para demonstrar otimização no pitch, usar os lotes em lactação; não ativar suporte nutricional inexistente.
- `pytest -q --tb=short --basetemp=../.test-runs/pitch-20261022-full`: **144 passed**, 1 aviso de depreciação do Starlette/AnyIO.
- `npm test`: **61 passed**, 11 arquivos. Após corrigir o uso de `act` nos testes de navegação, os sete testes desse arquivo foram repetidos sem aquele aviso.
- `npm run build`: aprovado.
- O pytest neste Windows foi executado fora do sandbox para permitir os sockets locais do TestClient.
- A dependência Passlib 1.7.4 emite um aviso não fatal ao consultar metadados do bcrypt 4.3.0. Hash e verificação de senha foram testados e funcionam; a dependência não foi trocada nesta revisão.
