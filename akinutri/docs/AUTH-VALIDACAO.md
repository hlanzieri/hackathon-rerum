# Autenticação, seed e revisão visual · 20/10/2026

## Resultado

- 67 testes backend aprovados (suíte completa `backend/tests`).
- 29 testes frontend aprovados (seis arquivos Vitest).
- Build Vite e verificação Prettier aprovados.
- Arquivos Python alterados formatados com Black.
- Um aviso de depreciação da dependência Starlette/AnyIO; sem falha funcional.

## Acesso e isolamento

O login exige credenciais válidas e emite cookie JWT HttpOnly. `/api/auth/me` confirma usuário e expiração; o dashboard aguarda essa confirmação. Uma identidade forjada em sessionStorage não abre o painel. A expiração remove o estado autenticado mesmo com a aba aberta, inclusive sessões de 30 dias. Uma resposta atrasada de uma checagem anterior não desfaz um login mais recente.

Testes negativos verificam ausência de autenticação nas rotas operacionais, senha incorreta, token expirado, replay de cookie após logout, origem externa em operações de escrita e acesso cruzado entre duas contas. As rotas de lote, solver, histórico, relatório de batida, catálogo privado e grupos mantêm o escopo do proprietário. Dados globais de catálogo são somente leitura. Respostas autenticadas não são armazenadas em cache.

As restrições preexistentes de unicidade de nomes de insumos/grupos/brincos continuam globais no esquema atual. Isto pode rejeitar um nome repetido entre contas; não autoriza a leitura ou alteração dos dados de outra conta.

## Seed aplicada

A conta fictícia Carlos/Fazenda Ouro Verde possui três lotes, seis alimentos particulares e três sessões calculadas pelo motor. As sessões #6 e #7 do primeiro lote permitem A/B; #8 corresponde ao Girolando. Os IDs são da instância conferida, não constantes do script.

A execução repetida de `python -m app.seed` preservou os registros e a senha. O login na API em execução retornou 200; foram conferidos os três lotes, três históricos, a integridade das sessões e a comparação A/B.

O catálogo particular mantém Ca/P ausentes e composição desconhecida do núcleo como ausentes, sem inferência nutricional. Os exemplos auditados usam o catálogo sintético completo já existente, identificado nos snapshots. Não há conversão de litros de leite bruto para leite corrigido. Nenhuma faixa científica publicada foi alterada.

Foi feito backup integral antes da migração em `backups/`. Os 85 registros preexistentes de sessões, resultados e traço foram comparados com o backup e preservados integralmente. Permanecem sem proprietário e não são expostos à conta nova. Caminhos relativos do SQLite agora são resolvidos em relação a `backend`, evitando bancos diferentes por pasta de execução. O banco intermediário usado no diagnóstico foi preservado em `backups/seed-intermediate-before-path-fix.db`.

As credenciais geradas estão em `seed-access.local.txt`, ignorado pelo Git; não são incluídas nesta documentação.

## Navegador e apresentação

Foram exercitados: acesso direto ao histórico sem sessão (redireciona ao login); login real; histórico com três registros; abertura da formulação auditada; expansão da regra PB-01; saída por teclado; tentativa de retorno ao histórico após logout (continua bloqueado). O formulário não oferece login rápido ou escolha de persona. A interface não anuncia localhost nem execução local.

Login, histórico e traço expandido foram conferidos em 320, 768, 1024 e 1440 px, sem rolagem horizontal da página. As tabelas mantêm rolagem própria. No mobile, marca e kicker do login ocupam linhas distintas e a barra superior do painel permite quebra de linha. Foram preservados foco por teclado, reduced motion e cleanup de observers/listeners. A revisão é delimitada a essas telas: não equivale a conformidade WCAG completa, CLS zero ou medição de 60 fps.

| Largura | Login | Histórico | Traço PB-01 expandido |
|---|---|---|---|
| 320 px | [captura](evidence/auth/login-320.png) | [captura](evidence/auth/historico-320.png) | [captura](evidence/auth/traco-320.png) |
| 768 px | [captura](evidence/auth/login-768.png) | [captura](evidence/auth/historico-768.png) | [captura](evidence/auth/traco-768.png) |
| 1024 px | [captura](evidence/auth/login-1024.png) | [captura](evidence/auth/historico-1024.png) | [captura](evidence/auth/traco-1024.png) |
| 1440 px | [captura](evidence/auth/login-1440.png) | [captura](evidence/auth/historico-1440.png) | [captura](evidence/auth/traco-1440.png) |

## Comandos

Na raiz `akinutri`, execute `.\start.ps1`. Para popular explicitamente a propriedade fictícia, entre em `backend` e execute `..\.venv\Scripts\python.exe -m app.seed`; uma instalação nova solicita uma senha de pelo menos 8 caracteres. A seed não redefine senhas existentes.

Verificações: na raiz, `.\.venv\Scripts\python.exe -m pytest backend/tests`; em `frontend`, `npm test`, `npm run build` e `npm run format:check`.

Não foi criado commit nesta entrega.
