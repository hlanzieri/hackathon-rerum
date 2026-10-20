# URLs reais, Bearer e seed · 20/10/2026

- Backend: 81 testes aprovados; frontend: 32 testes aprovados.
- Build Vite e Prettier aprovados. Um aviso de depreciação de Starlette/AnyIO permanece sem falha funcional.
- A navegação usa a History API com links nativos. Rotas públicas: `/`, `/sobre`, `/login`, `/register`. Rotas operacionais: `/dashboard` e seus módulos `comparacao`, `batida`, `insumos`, `regras`, `historico`, `resultado`, `animais`.
- Links antigos como `/#login` são convertidos uma vez para a URL real; não há listener de roteamento por hash.
- O catch-all do FastAPI entrega `index.html` na navegação. APIs inexistentes mantêm JSON 404, assets ausentes retornam 404 e arquivos fora de `dist` não são servidos pelo fallback.
- O `AuthGuard` monta o dashboard somente após `/api/auth/me` validar o JWT. Sem token ou com token rejeitado, o destino é `/login`; o caminho anterior é restaurado após autenticar. Botões voltar/avançar e recarga do navegador usam URLs reais.
- Login/cadastro retornam `access_token` e `token_type=bearer`. O frontend guarda o JWT em sessionStorage; com “Manter conectado”, em localStorage. Requisições autenticadas enviam `Authorization: Bearer <token>`. O cookie HttpOnly anterior foi mantido por compatibilidade de API; um cabeçalho inválido nunca usa o cookie como fallback.
- Assinatura, validade, proprietário e revogação continuam verificados no backend. Expiração e logout limpam o token no navegador. O cadastro comum continua exigindo senha de pelo menos 8 caracteres.
- A seed está disponível por `python -m app.seed` em `backend` usando o ambiente virtual. Conta padrão: `carlos@fazendaouroverde.com.br` / `senha123`. A opção `--reset-password` redefine explicitamente apenas a conta fictícia da seed e revoga seus tokens. Foi aplicada nesta instância após backup do banco.
- Foram preservados os três lotes, seis alimentos particulares e três análises da seed. As composições e preços fornecidos continuam ilustrativos; nutrientes ausentes não foram inventados. Não se apresenta o cenário como registros reais de uma fazenda.
- A apresentação substitui os rótulos antigos por “referência” / “ilustrativo” e “Motor Determinístico Ativo”, com identificação AkiNutri Enterprise v0.2. Os dados originais publicados, exports e hashes não são reescritos. Não se afirma “sessão encriptada” em HTTP nem precisão científica além do escopo implementado.

Os motores nutricionais, faixas científicas, regras versionadas, cálculos LP e snapshots históricos não foram refatorados nesta revisão.

## Conferência da instância em execução

O navegador abriu `/dashboard/historico` sem token e foi redirecionado para `/login`. O login com a conta padrão retornou ao histórico solicitado. A recarga manteve a rota real e confirmou novamente a sessão. Foram navegados os módulos de comparação, batida, insumos, regras e formulação; seus textos renderizados não continham localhost, demo, POC local ou “explorar sem preencher”. Depois de sair, acessar `/dashboard` voltou ao login, inclusive após recarregar.

A API em execução aceitou Bearer sem cookies, retornou três lotes e três sessões da conta, manteve APIs/assets inexistentes como 404 e preservou os snapshots/resultados/traços integralmente na comparação com o backup anterior a esta revisão.

Capturas: [histórico](evidence/clean-routes/historico.png) e [login](evidence/clean-routes/login.png).
