# Navegação e sessão do AkiNutri

`App.jsx` coordena o hash da URL e a sessão. `components/MainPage.jsx` é a página institucional ativa; `components/LoginPage.jsx` coleta o perfil e valida o formulário; `components/DashboardShell.jsx` conserva os módulos operacionais e é o único ponto que monta `useWorkspace`. O arquivo preexistente `src/pages/MainPage.jsx` foi preservado, mas não participa do roteamento ativo.

| Hash | Destino |
|---|---|
| vazio, `#home`, desconhecido | Apresentação pública |
| `#sobre` | Apresentação com foco na seção de método |
| `#login` | Acesso demonstrativo |
| `#dashboard`, `#workspace` | Formulação/verificação |
| `#comparacao` | Comparação A/B |
| `#batida` | Relatório do vagão |
| `#insumos` | Biblioteca de insumos |
| `#regras` | Base versionada |
| `#historico` | Sessões auditadas |
| `#resultado` | Resultado carregado ou orientação para selecionar uma sessão |

As rotas operacionais exigem sessão **na interface**. Um link direto sem sessão abre o login e retorna ao destino depois de entrar. Recarregar conserva a identidade nesta aba; a dieta em edição não é persistida pelo frontend. Resultados salvos podem ser recuperados no histórico. Abrir a página pública desmonta o workspace; sair ou trocar perfil também limpa seu estado em memória.

## Limite da autenticação

Esta etapa implementa acesso demonstrativo client-side, não autenticação de produção. Qualquer e-mail válido e uma senha fictícia de 8 a 128 caracteres permitem entrar. A senha não é armazenada nem enviada. O `sessionStorage` contém apenas versão, e-mail normalizado, perfil e prazo de até oito horas. Sessão inválida, expirada ou com perfil desconhecido é descartada. O temporizador, o retorno à aba e a navegação conferem sua validade. Armazenamento indisponível produz mensagem no formulário.

Produtor e consultor têm os mesmos módulos. O perfil identifica a sessão visual; não é evidência de autorização para o backend nem compõe o registro científico. A API permanece local e sem autenticação. Uma próxima etapa de autenticação real requer verificação de credenciais, sessão de servidor e autorização em cada endpoint.

## Acessibilidade e desempenho

- Controles nativos, grupo de perfil com `fieldset`/`legend`, rótulos explícitos e navegação por teclado.
- Erros associados ao campo por `aria-describedby` e `aria-invalid`, anúncio de estado e foco no primeiro erro.
- Skip links, foco no título ao mudar de módulo e foco na seção para `#sobre`.
- Páginas e módulos secundários carregados por `lazy`/`Suspense`; nenhum fetch operacional nas páginas públicas.
- Error boundary oferece recarga em caso de falha de renderização/importação; falhas da API mantêm mensagem e tentativa de reconexão.
- Transições finitas por opacity/transform. Pulso do rodapé limitado a três ciclos, pausado fora da tela/aba oculta, com cleanup de observer e listener. Reduced motion preservado.
- Os cálculos nutricionais continuam exclusivamente no backend determinístico.

## Execução e verificações

Na pasta `frontend`: `npm ci`, `npm run build`, `npm test`, `npm run format:check`. Na raiz `akinutri`: `./start.ps1`; abrir `http://127.0.0.1:8000/#home`. Alternativa para uma porta ocupada: na pasta `backend`, `../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001`.

Testes cobrem ausência de fetch público, link protegido, validação do login, retorno ao histórico, perfil consultor, falha de API, logout, sessão corrompida/expirada e respostas HTTP inválidas, além das regressões anteriores da interface e do rodapé.

Verificação em 20/10/2026: 17 testes frontend e 37 backend aprovados; build de produção e Prettier aprovados. Landing, login e workspace conferidos em 320/768/1024/1440 px sem overflow horizontal da página. Login inválido direcionou foco ao e-mail; saída por teclado e abertura da sessão histórica #5 funcionaram. `#sobre` direcionou foco à seção de método. O navegador estava em reduced motion; não se afirma medição de FPS das animações normais ou certificação WCAG completa. A entrada JS medida pelo Vite foi 190,32 kB (60,71 kB gzip estimado), com dashboard e páginas em chunks separados.

Skills aplicadas conforme [registro existente](SKILLS.md): Interface Design no painel, Addy/Vercel na composição e carregamento, Superpowers nos testes que falharam antes das novas implementações, MengTo na verificação de motion e cleanup. WarpGrep não estava conectado; busca local feita com `rg`.
