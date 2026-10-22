# Consolidação final do AkiNutri - 21/10/2026

## Implementação

SQLite/SQLAlchemy foram preservados. A migração é aditiva, sem apagar bancos, snapshots, resultados, triggers ou versões publicadas. A base continua na revisão `0.2.0+recalibracao.1` da família v0.2.0.

| Domínio solicitado | Persistência e compatibilidade |
|---|---|
| Usuario | Alias de UserAccount na tabela users. nome/senha_hash/criado_em são sinônimos de name/password_hash/criada_em. Cargo, fazenda e marca interna conta_demo são persistidos. |
| Lote | FK usuario_id e raca_id; raca é a relação com o catálogo de raças. peso_medio_kg/estado_produtivo/producao_litros_dia/dias_em_lactacao são aliases dos nomes existentes. TMR é persistido. |
| Insumo | Alias de InsumoAlimentar; usuario_id nulo identifica referência global. calcio_pct/fosforo_pct mapeiam ca_pct/p_pct. Categorias energéticas/proteicas são aceitas. |
| SessaoInferencia | FK de usuário/lote/base, base_versao, base_hash_sha256, cf_global e snapshot integral. dados_snapshot_json/criado_em têm aliases. Colunas novas de sessões antigas permanecem nulas; leitura usa os metadados do snapshot sem alterá-lo. |

A API aceita os nomes novos de entrada e preserva os nomes antigos de saída para o frontend. O nome da raça pode ser informado em vez de raca_id; se ambos forem enviados, precisam concordar. O endpoint `/api/sessoes/{id}` inclui `metadata`, conferido contra os dados congelados.

## Autenticação e tenant

Passlib 1.7.4, bcrypt 4.3.0 e PyJWT 2.10.1 estão fixados em requirements.txt. Novas senhas usam Passlib/bcrypt com custo 12; hashes bcrypt existentes continuam válidos. Há limite explícito de 72 bytes, sem truncamento silencioso. JWT exige sub/iat/exp/ver, valida HS256 e usa segredo local de pelo menos 32 bytes. Logout revoga tokens por versão de sessão. Bearer inválido não recorre ao cookie.

Cargo e fazenda podem ser cadastrados. Todas as rotas /api exigem autenticação, inclusive health e rotas futuras/desconhecidas, exceto login e register. CORS trata preflight antes das dependências. Respostas autenticadas não são cacheadas. Fallback da SPA serve páginas de navegação, preserva 404 para assets ausentes e nunca substitui erros da API por HTML.

Cada consulta/gravação operacional recebe o usuário autenticado. O catálogo global é visível e somente leitura; insumos privados permanecem isolados. Aliases de classes usam os mesmos mappers e políticas de tenant.

## Seed e proveniência

`INSUMOS_SEED` contém exatamente os seis dicionários fornecidos no pedido, com Ca/P, categorias, preços e zeros explícitos. Unidades: composição em % MS, EL em Mcal/kg MS, MS em % MN e preço em R$/kg MN. Dados ausentes em outros cadastros não são transformados em zero.

A origem registra que os valores vieram da equipe. O pedido não incluiu tabela/página/amostra que comprove cada número, portanto os registros não são rotulados como validados por NASEM/CQAL/Embrapa. Referências gerais consultadas: [NASEM 2021](https://www.ncbi.nlm.nih.gov/books/NBK600610/) e [pesquisa Embrapa sobre composição de silagens](https://apct.sede.embrapa.br/pab/pt_BR/article/view/27143). Essas referências não certificam os seis valores exatos da submissão.

O nome fornecido “Núcleo Mineral Aniónico / Lactação” foi mantido, com aviso de que não comprova efeito aniônico: o catálogo não contém composição iônica completa/DCAD. A formulação close-up continua bloqueada.

O startup inclui o catálogo global. A conta demonstrativa exige comando explícito, para não instalar uma credencial conhecida em toda inicialização:

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.seed
```

Conta fictícia: Dr. Carlos Eduardo de Moraes; carlos@fazendaouroverde.com.br; cargo zootecnista; Fazenda Ouro Verde; senha inicial senha123. AKINUTRI_SEED_PASSWORD pode definir outra senha inicial. Execuções repetidas não redefinem senhas; --reset-password é explícito e restrito à conta demonstrativa identificada. E-mail já pertencente a conta comum não é apropriado pela seed.

A seed cria seis entradas privadas completas e três exemplos auditados. Registros antigos reconhecidos como seed fictícia recebem somente os nutrientes antes ausentes; valores não nulos e preços existentes são preservados. Dados privados personalizados não são completados automaticamente. Sessões antigas nunca são recalculadas ou substituídas.

## Validação

Novas regressões estão em backend/tests/test_consolidacao.py: compatibilidade de hashes/aliases, perfil/fazenda, perímetro da API, TMR, nomes alternativos, catálogo completo, homônimo privado/global, idempotência da conta e metadados congelados. O preview determinístico foi regenerado com os novos alimentos.

Execute `./tools/verify.ps1` ou `.venv/bin/python tools/verify.py`. A validação usa SQLite temporário com limites de tempo e não altera o banco operacional.

A consolidação de software não certifica eficácia nutricional, impacto em campo ou nota da banca. A revisão especializada da base continua pendente.

## Resultado da validação e aplicação local

Execução integral concluída com código 0:

| Verificação | Resultado |
|---|---|
| Black sequencial | 31 arquivos, nenhuma alteração pendente |
| pytest | 137 aprovados em 79,63 segundos |
| Prettier | Aprovado |
| Vitest | 55 aprovados em 11 arquivos |
| Assets locais / Vite | Preparados; build de produção aprovado |

Evidência: [registro completo](evidencias/consolidacao-checks.log).

O banco operacional recebeu a migração e o seed após backup em `backups/consolidacao-20261021-a3ff67b0.db`. As 10 sessões anteriores mantiveram snapshot e resultado exatamente iguais e passaram novamente na auditoria. As senhas existentes foram comparadas antes/depois e preservadas; a senha padrão da conta fictícia foi verificada. O catálogo recebeu as seis referências completas; PRAGMA foreign_key_check não encontrou pendências.

A conferência com TestClient usando a configuração real confirmou login JWT, cargo/fazenda, API sem login retornando 401, leitura dos seis alimentos e navegação GET /login, /dashboard e /dashboard/akibot retornando 200. As 4 sessões visíveis para a conta padrão foram abertas com auditoria aprovada. Registros: [banco](evidencias/consolidacao-banco.json) e [conferência local](evidencias/consolidacao-smoke.json). Não houve nova inspeção visual em navegador nesta revisão; foram usados testes de componentes, navegação HTTP e build.

Limitações de bibliotecas: permanece a depreciação Starlette/AnyIO. Na inicialização, Passlib 1.7.4 registra um aviso sobre a ausência de bcrypt.__about__ no bcrypt 4.3.0; a biblioteca captura essa falha de metadados. Hashing, hashes existentes e login foram verificados. Não foi aplicado monkeypatch para ocultar o aviso nem downgrade do bcrypt.

Reinicie uma instância que já esteja em execução com `./start.ps1` para carregar o novo código e o build. A migração e a população do banco já foram aplicadas nesta entrega; repetir o seed mantém os dados existentes conforme a política descrita acima.
