# Navegação e autenticação do AkiNutri

O `App.jsx` e `navigation.js` coordenam rotas reais pela History API; o `AuthGuard` impede a montagem de módulos sem sessão confirmada. O `App.jsx` coordena as rotas e `hooks/useAuth.js` confirma a sessão com `/api/auth/me`. O dashboard só monta `useWorkspace` após a confirmação do servidor. Login e cadastro enviam as credenciais ao backend; o JWT permanece em cookie HttpOnly, sem armazenamento de tokens ou senhas em JavaScript. A sessão antiga do navegador é descartada.

| Rota | Destino |
|---|---|
| `/`, `/sobre`, raiz | Página institucional pública |
| `/login`, `/login` | Login por credenciais |
| `/register`, `/register` | Cadastro com senha de pelo menos 8 caracteres |
| `/dashboard`, `/dashboard` | Formulação e verificação protegidas |
| `/dashboard/comparacao`, `/dashboard/batida` | Comparação A/B e relatório de mistura |
| `/dashboard/insumos`, `/dashboard/regras` | Biblioteca e regras versionadas |
| `/dashboard/historico`, `/dashboard/resultado` | Histórico e traço auditável |
| `/dashboard/animais` | Animais e grupos de produção |

Links operacionais sem sessão levam ao login; após autenticar, o destino original é restaurado. Ao recarregar, o servidor confirma novamente a sessão. Erros 401 desmontam o dashboard, e a expiração informada pelo servidor também encerra o acesso enquanto a aba permanece aberta, inclusive com “Manter conectado”. Sair revoga os tokens no servidor antes de limpar a identidade da interface. Falhas de logout são apresentadas sem alegar que a sessão terminou.

A identidade e a propriedade exibidas vêm do usuário autenticado. A interface não exibe atalhos “Demo produtor”, “Demo consultor”, “Explorar sem preencher”, nem informações sobre localhost ou execução local. Dados científicos e exemplos continuam identificados como demonstrativos quando aplicável.

O navegador envia o JWT no cabeçalho Authorization, e o backend valida assinatura, expiração e revogação. O build usa a mesma origem da página; no desenvolvimento, a origem é configurada por `VITE_API_BASE_URL`. Módulos secundários usam lazy/Suspense; requisições independentes do workspace permanecem em paralelo. O arquivo legado `src/pages/MainPage.jsx` não participa do roteamento.

Acessibilidade: rótulos explícitos, controles nativos, botão de mostrar senha, estados de carregamento/erro, skip links no painel e foco nos módulos. A paleta, a densidade e os números tabulares seguem `.interface-design/system.md`. Reduced motion e cleanup de observers/listeners existentes são preservados. Não se afirma certificação WCAG completa, CLS zero ou 60 fps.

A revisão anterior está em `AUTH-VALIDACAO.md`. A continuação com URLs reais e Bearer está em `ROTAS-AUTH.md`.
