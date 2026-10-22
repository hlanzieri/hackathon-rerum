# Motor especialista RERUM — versão 0.2.0

A aplicação continua determinística, sem LLM no caminho de decisão. A base 0.1.0 foi preservada; novas sessões usam `backend/rules/base_v0.2.0.json`. O seed registra uma nova versão sem alterar os registros históricos.

## Memória e inferência

A memória inicia com fatos do lote/grupo, manejo, consumo e insumos. Cada registro contém valor, CF, origem declarada e regras produtoras. O motor executa rodadas síncronas até ponto fixo, com limite de 128 e detecção de ciclos. As regras JSON geram fase fisiológica, perfil candidato, alertas e parecer nutricional. A avaliação quantitativa produz fatos `avaliacao:*`, usados por regras de parecer; o resultado inclui os traços quantitativo e simbólico.

A seleção do perfil usa os fatos intermediários. A otimização continua sendo programação linear: seu modelo (coeficientes, RHS, igualdades e limites de inclusão) é preservado no resultado. O parecer final também aplica a verificação de inclusão e os estados de falha do solver: o parecer nutricional isolado não certifica todo o resultado.

Conflitos são ordenados por maior número de condições e, depois, maior `salience`. Empate com conclusões incompatíveis bloqueia. A memória bruta é imutável e conflitos com ela bloqueiam. As derivações são recalculadas a cada rodada, retirando consequências de premissas substituídas. Suportes correlacionados da mesma conclusão usam o mínimo, evitando inflar confiança pela repetição da mesma evidência.

## CF

CF pertence a [-1, 1], é finito e representa suporte à proposição armazenada. Zero indica ausência de suporte; valores negativos indicam evidência contrária e não satisfazem premissas positivas. AND usa o mínimo; a conclusão recebe `min(CF das premissas) * rule_cf`. A função `combine_cf` implementa a combinação MYCIN para evidências independentes; ela não é aplicada automaticamente a derivações correlacionadas. Evidências absolutas opostas geram erro.

O CF global é o mínimo dos suportes efetivamente usados no perfil e nas avaliações, incluindo composição e consumo; não existe CF diagnóstico para sessão bloqueada, sem resultado quantitativo ou inviável. Nesta revisão, os pesos iniciais são tabela 0,85, laboratório 1 e estimativa de campo 0,70. A composição é ponderada pela MS efetivamente usada; o CF global é limitado pelos suportes das regras. São pesos de política sem calibração empírica. O wizard permite alterar origem e CF do conjunto de insumos; a API também recebe evidência de fatos individuais. Não existe verificação automática de laudo, calibração empírica ou probabilidade clínica.

Formato da API: `evidence: {"composicao": {"source": "tabela", "cf": 0.85}}`. As fontes aceitas são `usuario`, `laboratorio` e `tabela`. `dcad_meq_100g` é entrada opcional na unidade mEq/100 g MS, não calculada dos insumos atuais.

## Transição e revisão técnica

Foi corrigido o exemplo fisiológico: dias em lactação até 21 representam pós-parto. Pré-parto é identificado por estado seco e dias ATÉ o parto até 21. R-01 → R-02 → R-03 emite um alerta didático e uma exigência de revisão da dieta de transição se DCAD > 0. R-03 bloqueia formulação: não inventa metas DCAD/Ca nem prescreve restrição de cálcio sem parâmetros revisados e composição iônica. Portanto, a prescrição automática de transição solicitada não está habilitada.

Todos os pesos e as adaptações nutricionais permanecem pendentes de revisão. Não foi atribuída validação à profissional mencionada no pedido, pois não foi fornecido registro de revisão. Os metadados registram responsável/data nulos, justificativa, fonte e método de aquisição. O carregador exige revisor, data e evidência documental para aceitar o estado `validado_por_especialista`; isso verifica completude documental, não autenticidade de credenciais.

## Explicações e segurança

Os quatro endpoints GET ficam em `/api/explicacao/`: `por-que-pergunta?fato=X`, `por-que-perfil?sessao_id=Y`, `como-concluiu?sessao_id=Y` e `gargalo-formulacao?sessao_id=Y`. Exigem autenticação; sessões respeitam a propriedade da conta e passam pela auditoria antes da explicação. As explicações de sessão usam a base congelada, enquanto a justificativa de campo usa a base vigente. Sessões históricas sem o novo traço apresentam indicação explícita de indisponibilidade.

O resultado e os endpoints expõem fatos, rodadas, premissas, CFs, conflitos e modelo LP. A interface inclui perguntas de ajuda, três consultas ativas no resultado e governança na página da base. A auditoria recalcula encadeamento, CF e avaliações a partir do snapshot.

Na inviabilidade, um filtro de remoção identifica um conjunto irredutível de restrições conjuntamente inviáveis (IIS), incluindo limites dos insumos. Não é necessariamente o único conjunto ou o menor em cardinalidade. O diagnóstico tem orçamento de 3 segundos e 0,1 segundo por chamada LP; interrupção ou estado numérico desconhecido retorna conjunto não certificado, explicitamente marcado. Não há relaxamento automático.

## Referências

- MYCIN, capítulos 11 e 12: https://www.shortliffe.net/Buchanan-Shortliffe-1984/Chapter-12.pdf
- Contexto de DCAD e prevenção pré-parto: https://www.merckvetmanual.com/metabolic-disorders/parturient-paresis-in-ruminants/parturient-paresis-in-cows

A implementação de arquitetura não equivale à certificação de conformidade do edital ou à validação zootécnica. A prescrição de transição e a revisão documentada por especialista permanecem pendentes.

## Verificação desta entrega — 21/10/2026

Execução integral de `tools/verify.ps1` concluída com código 0: Black (27 arquivos), pytest (97 aprovados), Prettier, Vitest (51 aprovados em 10 arquivos) e build Vite de produção. Os testes usam bancos temporários, sem atualizar o banco operacional. A prévia determinística foi regenerada com o hash da nova base.

Há avisos não bloqueantes de depreciação Starlette/AnyIO e de chaves React duplicadas em fixtures anteriores da suíte de interface. Não foi realizada nova inspeção visual no navegador nesta entrega; a interface foi verificada por testes de componentes e build.


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
