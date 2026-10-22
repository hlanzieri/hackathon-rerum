# AkiNutri · Nutrição explicável para pecuária leiteira

POC local do Hackathon UFJF 2026, Tema T2. React/Vite + FastAPI + SQLite/SQLAlchemy + SciPy/HiGHS. Regras nutricionais explícitas em JSON; nenhum cálculo ou decisão depende de LLM.

## Instalar e executar em outro computador

Execute os comandos a partir da pasta **`akinutri`**, que contém este README, `backend`, `frontend` e os scripts `start.ps1`/`start.sh`. Se o repositório completo foi clonado, entre primeiro em `hackathon-rerum/akinutri`. Caminhos com espaços funcionam quando passados entre aspas.

### 1. Pré-requisitos e arquivos a transferir

- Python **3.12, 64 bits**, com `pip` e `venv`.
- Node.js **22**, com npm no `PATH`.
- Internet para a primeira instalação das dependências Python/npm. Depois da instalação e do build, a execução é local.
- Uma cópia completa do código, incluindo `frontend/package-lock.json`, `backend/rules`, `.env.example` e `frontend/.env.example`. Ao preparar um ZIP, inclua os arquivos de exemplo que começam com ponto.

**Não copie `.venv` ou `node_modules` de outro computador**: recrie-os com os comandos abaixo. Para uma demonstração nova, também não é necessário copiar `.env`, banco, backups ou arquivos de credenciais da máquina original. Gere um segredo próprio na nova instalação. Se quiser transportar o histórico existente, consulte “Transferir um banco existente” abaixo.

A aplicação escuta somente em loopback: **http://localhost:8000** para interface e API; **http://localhost:5173** apenas no desenvolvimento com Vite. Cada computador executa sua própria instalação. O MVP não oferece acesso por IP da rede, hospedagem pública ou banco remoto. Mantenha as portas padrão para seguir estes comandos e use o mesmo hostname durante o login.

### 2. Instalação no Windows — PowerShell

Confira as versões; se algum comando não existir, instale o requisito e abra um novo terminal antes de continuar:

```powershell
py -3.12 --version
node --version
npm --version
```

Na pasta `akinutri`, crie o ambiente e instale as dependências. Não é necessário ativar a `.venv`:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m pip check
```

Crie as configurações locais sem sobrescrever arquivos existentes. O último comando troca somente o marcador `CHANGE_ME` por um segredo aleatório de 64 caracteres hexadecimais, sem exibi-lo no terminal:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
if (-not (Test-Path -LiteralPath frontend\.env.local)) { Copy-Item frontend\.env.example frontend\.env.local }
.\.venv\Scripts\python.exe -c "from pathlib import Path; import secrets; p=Path('.env'); p.write_text(p.read_text(encoding='utf-8-sig').replace('AKINUTRI_JWT_SECRET=CHANGE_ME', 'AKINUTRI_JWT_SECRET='+secrets.token_hex(32)), encoding='utf-8')"
```

Em uma instalação nova, o `.env` resultante deve manter `AKINUTRI_HOST=localhost`, `AKINUTRI_PORT=8000`, `AKINUTRI_DATABASE_URL=sqlite:///./akinutri.db` e `AKINUTRI_COOKIE_SECURE=false`. O segredo JWT precisa ter ao menos 32 bytes; não deixe `CHANGE_ME`. Variáveis já definidas no terminal têm precedência sobre o arquivo `.env`.

Instale o frontend usando o lockfile e gere a versão de apresentação:

```powershell
Push-Location frontend
npm ci
npm run build
Pop-Location
```

Não avance se um comando de instalação/build falhar. O build deve criar `frontend/dist/index.html` e copiar os arquivos locais do Swagger para `frontend/public/vendor`.

### 3. Golden seed da apresentação — Windows

Com o servidor parado, execute a partir de `akinutri`:

```powershell
Push-Location backend
..\.venv\Scripts\python.exe seed_apresentacao.py
Pop-Location
```

Não é necessário iniciar a API antes: o script cria o SQLite, as tabelas, as raças e a base de regras necessárias. Usa `backend/akinutri.db` por padrão; se `AKINUTRI_DATABASE_URL` apontar para outro arquivo local, esse será o banco alterado. **Esta seed não é executada automaticamente no startup.**

O comando imprime um JSON com `usuario_id`, `grupos`, `lotes`, `insumos_privados` e o caminho de `backup`. A conta é:

| Campo | Valor |
|---|---|
| E-mail | `carlos@fazendaouroverde.com.br` |
| Senha da demonstração | `senha123` |
| Nome | Dr. Carlos Eduardo de Moraes |
| Cargo / fazenda | Zootecnista / Fazenda Ouro Verde |

São preparados **4 lotes/grupos e 5 insumos privados**, totalizando **115 animais**: alta lactação (45), baixa lactação (25), secas (15) e recria (30). Secas e recria ficam com TMR desativado. Os cinco alimentos da demonstração têm composição completa; o Feno de Teste usa Ca 0,40%, P 0,20%, PB 12%, FDN 70% e amido 0,0%. A origem/atribuição informada fica registrada em `fonte`.

O script pode ser repetido: reutiliza lotes/grupos, substitui os insumos privados dessa conta e mantém snapshots auditados e dados das outras contas. Se a senha dessa conta diferir de `senha123`, redefine-a para a credencial de demonstração e revoga suas sessões de login. **Não execute esta seed sobre uma conta de uso real que deva manter seus cadastros atuais.** Antes de modificar um banco existente, cria backup consistente em `backups/pre-golden-seed-*.db`. O catálogo compartilhado não é removido: a tela de insumos poderá mostrar mais de cinco entradas.

Para fornecer uma tabela alternativa, use `seed_apresentacao.py --composicoes "caminho/arquivo.json"`. O JSON deve conter os quatro alimentos completos, com os nomes esperados e campos do cadastro; o script valida a lista antes de alterar dados. O feno de teste é criado separadamente. Veja [o script](backend/seed_apresentacao.py) e [o relatório do pitch](docs/PITCH-RERUM-2026.md).

### 4. Inicialização e conferência — Windows

Volte à pasta `akinutri` e execute:

```powershell
.\start.ps1
```

Mantenha o terminal aberto. Abra **http://localhost:8000/login**, entre com a conta acima e confira os grupos no **AkiBot**. Swagger: **http://localhost:8000/docs**. O build React e o Swagger são servidos pela própria API; não precisa executar `npm run dev` durante a apresentação. `Ctrl+C` encerra o servidor.

Se o PowerShell bloquear arquivos `.ps1`, use diretamente o Python, sem alterar a política de execução:

```powershell
Push-Location backend
..\.venv\Scripts\python.exe -m app
# Ctrl+C para encerrar; depois:
Pop-Location
```

Após instalar tudo uma vez, nas próximas utilizações basta executar `start.ps1`. Repita `npm run build` quando mudar o frontend. Repita a seed somente quando quiser restaurar os dados da conta da apresentação.

### Linux/macOS — instalação, seed e inicialização

Confira `python3.12 --version`, `node --version` e `npm --version`. Na pasta `akinutri`, execute na ordem:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m pip check

test -f .env || cp .env.example .env
test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
.venv/bin/python -c "from pathlib import Path; import secrets; p=Path('.env'); p.write_text(p.read_text(encoding='utf-8-sig').replace('AKINUTRI_JWT_SECRET=CHANGE_ME', 'AKINUTRI_JWT_SECRET='+secrets.token_hex(32)), encoding='utf-8')"

(cd frontend && npm ci && npm run build)
(cd backend && ../.venv/bin/python seed_apresentacao.py)
bash ./start.sh
```

Interrompa a sequência se qualquer etapa falhar. Abra **http://localhost:8000/login**. Não é preciso usar `sudo` nem ativar a `.venv`; `bash ./start.sh` também evita depender do bit de execução do arquivo. Se a distribuição não incluir o módulo `venv`, instale o suporte correspondente ao Python 3.12 antes de criar o ambiente. Esses comandos são equivalentes aos do Windows; a validação desta revisão foi feita no Windows, sem afirmar teste em todos os sistemas operacionais.

### Validação desta revisão

Foi conferido o fluxo em **Windows, Python 3.12.14 e Node 22.13.0**, com dependências já instaladas e **um SQLite temporário novo**: duas execuções da golden seed, login, quatro grupos/115 animais, formulação de alta lactação, bloqueio do feno incompleto, rotas da SPA e assets locais do Swagger. `pip check` não encontrou dependências quebradas. Os blocos PowerShell abaixo foram verificados pelo parser do PowerShell. Isso não substitui executar o checklist no computador de destino, especialmente após uma instalação nova de dependências.

### Checklist antes do pitch

1. Faça o login pela interface. `/api/health` é protegido: sem sessão, HTTP 401 é esperado e não significa que o servidor caiu.
2. No AkiBot, confira os quatro grupos e escolha **Lote 1 - Alta Lactação**. Para o roteiro já conferido, informe CMS manual de **24 kg MS/animal/dia**, selecione silagem, milho, soja e núcleo completos, sem o feno de teste, e formule.
3. Confira o custo, inclusão MS/MN, CF e preços-sombra. A verificação local com a tabela da seed encontrou solução ótima; hardware, alterações nos dados ou limites podem mudar o resultado/tempo.
4. Use o resultado válido para abrir **Batida do Vagão**. A seed prepara cadastros; não cria uma nova formulação nem carrega automaticamente uma sessão na UI.
5. **Feno de Teste** tem composição completa e pode ser usado na demonstração de sucesso.
6. Recria e secas sem TMR ficam fora do escopo de formulação atual. Não use esses lotes como cenário de otimização bem-sucedida.
7. Depois de instalar dependências e gerar o build, confirme a execução sem internet antes do evento.

A barra lateral do pitch mostra Painel do Lote, AkiBot, Batida do Vagão, Insumos e Base de conhecimento. As demais rotas continuam acessíveis pelos fluxos existentes ou por URL.

### Problemas comuns

| Sintoma | Verificação / solução |
|---|---|
| `python`, `py`, `node` ou `npm` não encontrado | Instale os pré-requisitos e reabra o terminal. No Windows, use `py -3.12`; em Linux/macOS, `python3.12`. |
| `.venv` copiada não funciona / `ModuleNotFoundError` | Recrie a `.venv` na máquina destino e reinstale `backend/requirements.txt`. Use o executável da `.venv`, não o Python global. |
| Não foi possível instalar SciPy | Confira Python 3.12 de 64 bits e acesso ao índice de pacotes. Guarde o erro de instalação; não prossiga sem resolver as dependências. |
| `npm ci` falha / assets do Swagger ausentes | Confira Node/npm e o lockfile. Execute `npm ci` dentro de `frontend`; depois `npm run build`. Não instale apenas dependências de produção: o Vite é necessário ao build. |
| Autenticação retorna 503 | Verifique `AKINUTRI_JWT_SECRET` no `.env` e possíveis variáveis herdadas do terminal. Troque `CHANGE_ME` e reinicie a API. |
| Login retorna 401 | Execute a golden seed no mesmo banco usado pela API, confira a credencial e mantenha `localhost` no endereço. Cookies `Secure` precisam estar desativados no HTTP local. |
| Porta 8000 ocupada | Encerre a instância anterior com `Ctrl+C` ou identifique o processo que usa a porta. Não altere portas aleatoriamente: o frontend de desenvolvimento e as origens permitidas usam as portas documentadas. |
| Interface mostra 404 / build ausente | Confira `frontend/dist/index.html`. Gere o build e inicie pelo script `start` ou por `python -m app` dentro de `backend`. |
| Banco vazio ou diferente do esperado | Confira `AKINUTRI_DATABASE_URL`. Caminhos relativos do SQLite são resolvidos a partir de `backend`, não da pasta do terminal. |
| `database is locked` | Pare as instâncias da aplicação antes da seed; evite o banco aberto simultaneamente em ferramentas de edição/sincronização. Use uma pasta local para a execução. |
| `dados_insuficientes` | Confira a composição e remova o feno de teste do cenário de sucesso. A trava é intencional. |
| HTTP 408 | O HiGHS atingiu o limite de 3 s da otimização principal. Confira os limites/insumos e tente novamente; não há garantia de latência em qualquer computador. |
| Aviso `(trapped) error reading bcrypt version` | Aviso conhecido de Passlib 1.7.4 com bcrypt 4.3.0. Nesta revisão, hash, login e seed funcionaram. Confira o código de saída e o JSON final; não confunda esse aviso com falha de instalação. |

### Transferir um banco existente

Para recriar a demonstração em outro computador, prefira a golden seed sobre um banco novo. Se o objetivo for preservar todo o histórico, pare a aplicação na origem e no destino e transfira um backup SQLite consistente, como o arquivo criado pela seed, para `backend/akinutri.db` no destino. Preserve uma cópia do banco que já existir no destino. Gere o `.env` local e mantenha o mesmo código e arquivos de regras versionadas; não reaplique a golden seed se quiser manter os cadastros atuais. O startup aplica as migrações existentes e carrega a base sem reescrever snapshots históricos.

### Desenvolvimento

Mantenha a API local em execução com `start.ps1` ou `bash ./start.sh`. Em outro terminal, dentro de `frontend`, execute `npm run dev` e acesse **http://localhost:5173**. Nesse modo, `frontend/.env.local` aponta para `http://localhost:8000`; o backend aceita apenas as origens locais configuradas. Na apresentação com o build, use a porta 8000 para tudo. Não use `npm run preview` como servidor da aplicação completa.

### Contas e autenticação

O cadastro em `/register` usa `POST /api/auth/register` com `nome`, `email`, `senha`, `cargo` (produtor/zootecnista) e `fazenda_nome`; exige senha com ao menos 8 caracteres e rejeita e-mail já utilizado. Após salvar o hash bcrypt via Passlib, autentica a nova conta automaticamente. O login em `POST /api/auth/login` verifica o hash via Passlib/bcrypt, inclusive hashes bcrypt existentes. Ambos retornam `access_token` / `token_type=bearer` e também emitem JWT em cookie `HttpOnly`, `SameSite=Lax`, com validade de uma hora (30 dias se “Manter conectado” estiver marcado no login). O segredo de assinatura não tem valor padrão: configure `AKINUTRI_JWT_SECRET` com pelo menos 32 bytes aleatórios antes de iniciar o backend. Por exemplo, em Linux/macOS:

```bash
export AKINUTRI_JWT_SECRET="$(openssl rand -hex 32)"
```

Em PowerShell, defina `$env:AKINUTRI_JWT_SECRET` para um valor aleatório forte antes de iniciar o servidor. Nesta entrega local via HTTP, mantenha `AKINUTRI_COOKIE_SECURE=false`. Hospedagem pública/HTTPS exige uma implantação própria e não é coberta por estes scripts.

Crie uma conta administrativa pelo terminal do backend; a senha é solicitada sem eco e nunca deve ser passada como argumento:

```bash
../.venv/bin/python -m app.create_user --email pessoa@exemplo.com --name "Nome da pessoa"
```

No Windows, use `..\.venv\Scripts\python.exe -m app.create_user --email pessoa@exemplo.com --name "Nome da pessoa"`. A inicialização cria tabelas ausentes e aplica migração aditiva dos campos de autenticação/proprietário; contas existentes não são alteradas.

### Proteção de dados e sessão

`GET /api/auth/me` confirma a identidade e a expiração da sessão. `POST /api/auth/logout` remove o cookie e revoga os tokens existentes da conta. O frontend usa `AuthGuard`, espera a confirmação do servidor com Bearer token antes de montar o dashboard; identidades antigas em `sessionStorage` não concedem acesso. Não há atalhos de login demonstrativo.

Lotes, formulações, verificações, histórico, comparação, batidas, animais e grupos exigem autenticação. Os dados são filtrados por `usuario_id` nas consultas e vinculados à conta nas gravações. Insumos públicos são compartilhados somente para leitura; alimentos particulares podem ser cadastrados pela conta. Respostas da API usam `Cache-Control: no-store`, e operações com origem externa não autorizada são rejeitadas.

A migração adiciona proprietário e campos de perfil sem reescrever snapshots, resultados ou hashes. Registros históricos sem proprietário permanecem preservados, mas indisponíveis nas contas comuns; não são atribuídos arbitrariamente à seed. As restrições de nomes únicos de insumos, grupos e brincos são aplicadas por usuário nas migrações existentes.

### Seed histórica alternativa

Para o pitch atual, use **`python seed_apresentacao.py`**, conforme a instalação acima. O comando antigo `python -m app.seed` continua disponível dentro de `backend`, mas prepara outra fixture: três lotes, seis insumos privados e análises históricas. Não execute as duas seeds em sequência se quiser manter o conjunto de quatro grupos e cinco insumos da apresentação.

A seed histórica aceita `AKINUTRI_SEED_PASSWORD` e `--reset-password`; a golden seed atual usa a credencial de demonstração solicitada e tem suas próprias regras de restauração documentadas acima. Nenhuma das duas é disparada automaticamente ao iniciar o servidor.

### URLs reais

Navegação em `/`, `/login`, `/register`, `/dashboard` e `/dashboard/{akibot,comparacao,batida,insumos,regras,historico,resultado,animais}`. O fallback SPA permite recarregar cada rota. Caminhos `/api/*` continuam retornando JSON, e assets inexistentes retornam 404. O JWT fica em sessionStorage, ou localStorage ao manter conectado, e é enviado em `Authorization: Bearer <token>`; sem token validado, o guard leva a `/login` e conserva o destino para depois do login.

As fontes publicadas, os snapshots e os termos científicos exportados não são reescritos pela apresentação. A UI usa “referência” e “ilustrativo”, mantém a identificação de dados fictícios e não afirma criptografia de transporte em HTTP. Veja [validação das rotas e autenticação](docs/ROTAS-AUTH.md).

## Fluxo de uso

### AkiBot e simulação de preços

Em **AkiBot · Assistente** (`/dashboard/akibot`), escolha o perfil do lote, o CMS, os insumos, o objetivo e confira o resumo. A formulação exige um grupo ativo com parâmetros completos. O motor usa os fatos do grupo; a aplicação NASEM é recalculada ao escolhê-lo. O atalho de lactação escolhe um alimento por tipo e prioriza composição completa; inclua os minerais necessários com o botão específico. Preços são por kg de matéria natural e quantidades da verificação são por animal/dia.

No resultado de uma dieta validada, abra **E se o preço mudar? → Simular cenário**. Escolha milho +20%, soja −15% ou um insumo indisponível. A simulação usa os insumos e limites da sessão original, registra outra análise e mostra custos anterior/novo, impacto para 30 dias e mudanças nas quantidades. O catálogo e a sessão original são preservados. Um cenário inviável mostra o diagnóstico sem projetar economia. Alterações nos fatos do lote, grupo, composição ou base impedem a projeção entre contextos distintos.

A comparação A/B continua exigindo o mesmo contexto e preços; a simulação de preços é um fluxo separado. O cenário simulado fica no histórico, e **Abrir resultado completo do cenário** permite conferir o traço e preparar a batida.

### Histórico do ciclo de vida e grupos de produção

Na rota **Animais e GP** (`/dashboard/animais`, oculta na barra lateral do pitch), cadastre grupos nas fases Bezerril, Recria, Lactação ou Seca, depois cadastre animais com data de nascimento, identificação e grupo inicial. A movimentação registra a data de entrada em cada novo grupo e encerra o período anterior no dia precedente. Grupos e animais podem ser arquivados; os registros históricos são preservados.

Para ativar uma dieta, selecione uma formulação LP concluída e verificada, o GP e a data de início. Uma dieta nova encerra a dieta anterior do mesmo grupo no dia precedente. No perfil do animal, a linha do tempo cruza seus períodos de movimentação com as dietas ativas, mostra os ingredientes e custos diários dos snapshots registrados e acumula o custo pelo número de dias em cada período. Períodos sem dieta registrada aparecem explicitamente e têm custo nutricional contabilizado como zero; o histórico começa na primeira movimentação cadastrada, sem inferir fases anteriores.

1. **Lote:** carregue um cenário ou preencha o formulário, incluindo raça, peso, idade, parição, fase, destinação e produção. Salve ou selecione um lote existente.
2. **Consumo:** informe CMS manualmente ou abra o estimador opcional, complete as entradas técnicas e aplique a sugestão. Aplicação e ajuste manual são ações explícitas.
3. **Insumos:** selecione alimentos; edite preços por kg MN diretamente na tabela; defina limites de inclusão em kg MS. Os preços da análise não alteram o catálogo.
4. **Verificar:** informe a dieta atual em kg MN/animal/dia e registre o diagnóstico.
5. **Formular:** mantenha os mesmos fatos e escolha “Formular menor custo”. O LP usa as mesmas regras e pós-verifica o resultado.
6. **Explicar:** abra os acordeões para conferir valor, intervalo, estado, fonte, custos marginais e preços sombra.
7. **Comparar A/B:** escolha uma sessão manual e uma formulação. A API exige igualdade de lote, base, consumo, manejo, composição, preços e limites. Divergência retorna 409; uma comparação não é feita entre contextos diferentes.
8. **Batida do vagão:** selecione uma dieta que atenda ao perfil demonstrativo, informe batidas/dia e capacidade opcional. Reordene os insumos conforme orientação do responsável e imprima ou exporte o JSON exato.

O histórico preserva sessões e verifica sua integridade ao abri-las. O botão “Usar na verificação” transfere quantidades sem arredondar, para conferir a formulação no fluxo manual.

## Arquitetura

```mermaid
flowchart LR
    UI[React / Vite] --> API[FastAPI REST]
    API --> DB[(SQLite / SQLAlchemy)]
    JSON[Regras JSON versionadas] --> R[Motor IF/THEN]
    API --> R
    API --> LP[SciPy / HiGHS]
    JSON --> LP
    LP --> R
    R --> A[Hashes e verificação do traço]
    A --> DB
    API --> CMS[Estimador NASEM / JSON próprio]
    API --> REPORTS[Comparação e batida]
    REPORTS --> UI
```

| Arquivo / módulo | Responsabilidade |
|---|---|
| `backend/app/main.py` | REST, transações, integração e frontend estático |
| `backend/app/lifecycle.py` | CRUD de grupos/animais, movimentações, dietas ativas e linha do tempo nutricional |
| `schemas.py`, `models.py`, `database.py` | DTOs, entidades, SQLite e proteção append-only |
| `engine_rules.py` | Seleção de perfis e verificação determinística |
| `engine_solver.py` | LP, custos marginais e preços sombra |
| `engine_intake.py` | Estimador técnico de CMS |
| `audit.py` | Hash canônico e revalidação do traço |
| `reports.py` | Comparação compatível e quantidades por batida |
| `backend/rules/base_v0.2.0.json` | Perfis e limites nutricionais versionados |
| `backend/rules/intake_nasem2021_v1.json` | Coeficientes, fonte e versão do estimador |
| `frontend/src/hooks/useWorkspace.js` | Estado, chamadas de API e origem do consumo |
| `frontend/src/components/` | Lote, alimentos, traço, comparação, vagão e catálogo |

### Modelo LP e unidades

Variável `x_i`: kg MS do alimento por animal/dia. Custo `c_i = preço_kg_MN / fração_MS`.

```text
minimizar Σ(c_i × x_i)                 [R$/animal/dia]
Σ x_i = consumo alvo                  [kg MS/animal/dia]
inclusão mínima_i ≤ x_i ≤ inclusão máxima_i
limite mínimo × Σ x_i ≤ Σ(teor_i × x_i)
Σ(teor_i × x_i) ≤ limite máximo × Σ x_i
```

Com consumo fixo, minimizar custo diário equivale a minimizar custo por kg MS. Os teores percentuais são pontos percentuais (17 = 17%); energia é Mcal/kg MS. FDN de volumosos usa FDN apenas dos volumosos no numerador e MS total no denominador. `kg MN = kg MS / fração MS`.

A otimização principal usa `method="highs"`, `presolve=True`, tolerâncias de viabilidade de 1e-9 e limite de execução de **3 s**. O diagnóstico de inviabilidade tem orçamento próprio de até 3 s adicionais; timeout da otimização principal retorna HTTP 408. Há tratamento de falhas numéricas e valores não finitos. A solução é pós-verificada com tolerância do JSON, 1e-6, sem arredondar e sem relaxar restrições silenciosamente.

Custos marginais de inclusão são por kg MS adicional no limite. Preços sombra das restrições percentuais são por unidade do lado direito da inequação linear montada, **não** por ponto percentual de nutriente. São derivadas locais; não garantem economia para mudanças grandes ou alterações na base ótima.

### CMS / NASEM 2021

Implementa a **equação 2-1** de fatores animais para Holandesas em lactação: peso vivo, energia diária do leite, dias em lactação, escore corporal (1–5) e fração de multíparas (0–1). [Fonte NASEM](https://www.ncbi.nlm.nih.gov/books/NBK600610/).

A energia pode ser informada diretamente em Mcal/dia ou obtida multiplicando **leite já corrigido** pela energia de referência declarada. O valor inicial de referência é 0,7 Mcal/kg; o sistema não converte silenciosamente litros de leite bruto em leite corrigido. ECC 3 e fração de multíparas são entradas iniciais editáveis, não medições automáticas.

A equação NASEM original não é apresentada como validada para outras raças ou vacas secas. A revisão T2 acrescenta modelos experimentais identificados abaixo; DEL acima de 368 continua fora do escopo da estimativa. A equação é uma estimativa populacional, não garantia de consumo. O perfil nutricional do MVP continua excluindo o início da lactação, mesmo quando a equação pode produzir uma estimativa.

Ao aplicar uma sugestão, o servidor recalcula e confere o vínculo com os fatos do lote. Entradas, coeficientes, fonte, hash do modelo e resultado ficam no snapshot. Ajustar CMS manualmente remove a origem estimada da próxima análise.

### Auditoria e migração

- Banco padrão: `backend/akinutri.db`; configuração opcional: `AKINUTRI_DATABASE_URL` para outro SQLite.
- A migração preservou o banco anterior. Backups de fonte e banco anteriores à evolução estão em `backups/`, ignorados pelo Git.
- A base nutricional 0.1.0 foi preservada sem alteração de conteúdo. Novas regras exigem nova versão.
- Sessões, resultados, explicações e bases publicadas recebem triggers SQLite que rejeitam UPDATE/DELETE. Catálogo de insumos continua editável.
- Sessões novas guardam SHA-256 do snapshot e do resultado; a leitura também confere a base e recalcula perfis, nutrientes e traço. Sessões anteriores são conferidas com base e recálculo, sem inventar hashes históricos que não existiam.
- SHA-256 detecta inconsistências; não é assinatura digital autenticada. Não protege contra um administrador que reescreva banco, triggers e hashes.
- Dados estruturados relacionais com itens preservados em snapshots JSON. `create_all` não substitui migrações de esquema.
- Mesmo ambiente e fatos produzem os mesmos resultados nos testes. Empates podem mudar de solução entre versões do solver; método, versões e fatos são preservados.

### Comparação e vagão

A economia é `(custo manual diário do lote − custo formulado diário do lote) × dias`. Preços e consumo são constantes na projeção. Valores negativos são apresentados como custo adicional. Não calcula receita ou lucro. Se a dieta manual viola regras, a UI informa que não há equivalência nutricional demonstrada.

Na batida: `kg MN/batida = kg MN/animal/dia × animais / batidas_dia`. Capacidade insuficiente retorna 422. O operador define a sequência; a listagem inicial por ID **não é protocolo técnico de mistura**. Não adiciona automaticamente água, perdas ou sobras. A tela usa três casas decimais e o JSON preserva a precisão integral.

## API

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/health`, `/api/racas` | Saúde e raças |
| GET / POST | `/api/lotes` | Consultar e cadastrar lotes |
| GET / POST / PUT | `/api/insumos`, `/api/insumos/{id}` | Catálogo |
| GET | `/api/regras` | Base e hash |
| POST | `/api/estimar-cms` | Sugestão técnica opcional |
| POST | `/api/verificar`, `/api/formular` | Inferência e LP |
| GET | `/api/sessoes`, `/api/sessoes/{id}` | Histórico e integridade |
| POST | `/api/comparar` | Comparação contextual A/B |
| POST | `/api/sessoes/{id}/batida` | Relatório de carregamento |

Seleção vazia de insumos: 400 (`DADOS_INSUFICIENTES`); DTO inválido: 422; timeout da otimização: 408; ID ausente: 404; conflito de contexto/nome/integridade: 409. Inviabilidade ou falta de cobertura são resultados de domínio, registrados com HTTP 200. Rotas REST desconhecidas não são respondidas com o HTML da interface. A navegação usa caminhos reais, como `/dashboard/comparacao`; favoritos antigos com hash são migrados.

## Testes e qualidade

Antes de apresentar em outra máquina, confira dependências, testes e build. Na raiz `akinutri`, para instalar também a ferramenta de formatação Python:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
```

A suíte backend usa bancos temporários e não deve alterar o SQLite operacional. Uma pasta temporária própria evita conflitos de permissões no diretório padrão:

```powershell
Push-Location backend
$akinutriTestTemp = Join-Path (Split-Path (Get-Location) -Parent) ('.test-runs/pytest-' + [guid]::NewGuid().ToString('N'))
..\.venv\Scripts\python.exe -m pytest -q --basetemp=$akinutriTestTemp
Pop-Location
Push-Location frontend
npm test
npm run build
Pop-Location
```

Em Linux/macOS:

```bash
(cd backend && ../.venv/bin/python -m pytest -q)
(cd frontend && npm test && npm run build)
```

Validação adicional de formatação e qualidade em PowerShell, a partir de `akinutri` (requer as dependências de desenvolvimento instaladas):

```powershell
.\tools\verify.ps1
```

O comando interrompe na primeira falha e verifica Black, testes do backend com bancos isolados, Prettier, testes da interface e build de produção. Veja a [validação final](docs/VALIDACAO-FINAL.md).

Para repetir somente os testes da interface e o build, entre em `frontend`:

```powershell
npm test
npm run build
npm run format:check
```

Formatação Python: na raiz `akinutri`, use `.\.venv\Scripts\python.exe tools/check_python_format.py` (Windows) ou `.venv/bin/python tools/check_python_format.py` (Linux/macOS).

Veja [testes](docs/TESTES.md), [arquitetura](docs/ARQUITETURA.md), [skills aplicadas e limitações](docs/SKILLS.md), [contrato visual](.interface-design/system.md) e [apresentação](docs/APRESENTACAO.md).

## Limites científicos e operacionais

Perfis e alimentos iniciais são **demonstrativos e não validados para prescrição**. Parte das faixas é adaptação didática, explicitada no JSON. Não reproduz integralmente NRC/NASEM/CNCPS. Não cobre proteína metabolizável, DCAD, vitaminas, biodisponibilidade ou requerimentos fisiológicos individualizados. Preços/composição do seed devem ser substituídos por análises e cotações locais.

Perfis de lactação exigem TMR, partícula adequada, milho seco predominante e ≥60 dias em lactação; alta produção ≥30 L/dia, moderada <30. Seca distante exige mais de 21 dias até parto. Não cobre transição pré-parto. Idade e parição agora acionam a reserva de crescimento quando há valores de mantença e fonte. Destino do leite aciona pisos experimentais; raça e peso participam do estimador de CMS conforme o domínio declarado abaixo.

Referências de contexto: [NASEM — fibra](https://www.ncbi.nlm.nih.gov/books/NBK600592/), [Penn State — amido](https://extension.psu.edu/carbohydrate-nutrition-for-lactating-dairy-cattle), [Penn State — proteína](https://extension.psu.edu/from-feed-to-milk-understanding-rumen-function), [SciPy — HiGHS](https://docs.scipy.org/doc/scipy/reference/optimize.linprog-highs.html).

O login verifica credenciais e emite JWT em cookie HttpOnly; as rotas operacionais exigem a sessão e isolam os dados por conta. A aplicação permanece com execução em loopback; esta entrega não implica prontidão industrial validada. A interface segue critérios de acessibilidade e recebe verificações de teclado, contraste e reflow; isso não equivale a certificação WCAG completa ou prontidão industrial validada.

## Motor especialista RERUM

A base 0.2.0 acrescenta memória de trabalho, encadeamento direto, CF, explicações ativas e governança. Consulte [a arquitetura, a política de conflitos e os limites de validação](docs/RERUM-MOTOR.md). A revisão por especialista permanece pendente; a formulação automática de transição é bloqueada até haver parâmetros técnicos revisados.



## Base v0.2.0 - recalibração T2

A família da base é **v0.2.0**. O identificador publicado desta revisão é `0.2.0+recalibracao.1`, no arquivo `backend/rules/base_v0.2.0.json`. O conteúdo original 0.2.0 permanece em `base_v0.2.0_original.json`; o seed cria outro registro, preservando sessões e hashes históricos. Não substitua a base anterior no banco.

O motor identifica e relata conjuntamente quais restrições nutricionais foram violadas/conflitantes no modelo estrito, sem relaxá-las automaticamente. Em uma formulação inviável não existe dieta final da qual medir violações: o diagnóstico informa restrições conjuntamente incompatíveis, incluindo limites dos insumos. A certificação do conjunto irredutível depende de concluir o diagnóstico dentro do orçamento numérico; ele não precisa ser único nem ter cardinalidade mínima.

A formulação para o período de transição pré-parto (Close-Up) está intencionalmente bloqueada nesta versão (escopo de evolução futura), sendo suportados apenas os perfis de lactação e seca distante. A lactação suportada pelos perfis continua exigindo DEL >= 60 e os manejos declarados; a estimativa de CMS não amplia automaticamente esse escopo.

Desempenho: execução local determinística em tempo real, com limites explícitos de duração. Não há medição que sustente conclusão do wizard em menos de 30 segundos nem garantia de latência em qualquer equipamento.

SHA-256: **Hash de Validação de Integridade e Rastreabilidade do Conteúdo da Base de Conhecimento**. Não é assinatura digital autenticada. Os registros históricos têm triggers de proteção, mas um administrador com controle total do banco pode alterar registros e hashes.

### Hipóteses e limites da recalibração

- Idade <= 36 meses OU ordem de parição = 1 ativa uma única reserva de crescimento. O acréscimo é 10% da PB e da EL de mantença informadas, por animal/dia, com fonte obrigatória. Para PB, `delta_%MS = 0.10 * mantenca_pb_kg_dia / CMS * 100`; para EL, `delta_Mcal_kgMS = 0.10 * mantenca_el_mcal_dia / CMS`. Não se confunde mantença com a dieta inteira. Sem entradas/fonte, o sistema retorna dados insuficientes. Os valores devem representar o grupo analisado; não há cálculo fisiológico automático da mantença nem garantia de preservação de ECC.
- `destinacao` preserva leite/reprodução/dupla aptidão. O novo campo `destinacao_economica` separa leite fluido de queijo artesanal. Leite fluido mantém os limites; queijo em lactação aplica pisos experimentais PB 18% MS e FDN de volumosos 21% MS. O segundo piso mede contribuição de FDN, sem certificar qualidade da fibra. O sistema não prediz sólidos nem rendimento de queijo.
- CMS Holandesa em lactação preserva a equação 2-1 NASEM 2021 (DEL 1–368). Para outras raças, há adaptação experimental: fator Holandesa 1, Girolando 0.95, Gir Leiteiro 0.88 e Jersey 1.05 sobre `PV**0.75`; reconverte-se `PV_equivalente = (fator * PV**0.75)**(1/0.75)` para o termo linear de peso da equação. Essa transformação é uma escolha de implementação solicitada, sem validação NASEM para essas raças.
- Seca distante: faixa CMS `PV * [0.0197, 0.021]`, com ponto médio `PV * 0.02035`; não aplica fator racial nem equação de lactação. Não solicita produção/energia do leite ou DEL. Até 21 dias para o parto, bloqueia a estimativa e a formulação.
- CF das fontes: laboratório 1.00, tabela 0.85, estimativa de campo 0.70. São pesos de política solicitados, sem calibração empírica nem verificação automática de laudos. Valores explícitos menores são aceitos; maiores que o teto da fonte são rejeitados.
- Composição usa média dos CF ponderada pelos kg MS dos insumos realmente utilizados. Insumo com quantidade zero não participa. O CF global permanece limitado pelas premissas, regras, ajustes e consumo; resultados inviáveis/bloqueados não recebem CF diagnóstico. Não se altera a álgebra MYCIN das regras para apresentar uma média como probabilidade.

A revisão zootécnica permanece pendente. Essas mudanças não garantem nota de banca ou eficácia comercial. Referência do domínio original de CMS: https://www.ncbi.nlm.nih.gov/books/NBK600610/. Os coeficientes adicionais e os pisos de queijo vieram da solicitação da equipe, sem atribuição bibliográfica fictícia.

## Consolidação relacional e seed completo

Consulte [o relatório de consolidação](docs/CONSOLIDACAO-FINAL.md) para o contrato dos campos, migração, conta fictícia, fonte dos seis alimentos e evidências de testes.

Todas as rotas `/api/*`, inclusive `/api/health` e caminhos desconhecidos, exigem autenticação, exceto `/api/auth/login` e `/api/auth/register`. Um caminho desconhecido retorna JSON 401 sem sessão e JSON 404 com sessão; nunca recebe HTML da SPA. Preflight CORS continua atendido pelo middleware. `/login`, `/register`, `/dashboard` e suas rotas de navegação são servidas pelo fallback para `index.html`.

A conta da apresentação é preparada por `python seed_apresentacao.py`; a fixture histórica alternativa usa `python -m app.seed`. Nenhuma é executada silenciosamente no startup. O catálogo global completo é carregado automaticamente; uma conta privada com alimento homônimo não impede a criação da referência global. Usuários comuns podem ler o catálogo global, mas apenas editar suas cópias privadas.
