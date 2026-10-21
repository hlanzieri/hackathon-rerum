# Motor especialista RERUM — versão 0.2.0

A aplicação continua determinística, sem LLM no caminho de decisão. A base 0.1.0 foi preservada; novas sessões usam `backend/rules/base_v0.2.0.json`. O seed registra uma nova versão sem alterar os registros históricos.

## Memória e inferência

A memória inicia com fatos do lote/grupo, manejo, consumo e insumos. Cada registro contém valor, CF, origem declarada e regras produtoras. O motor executa rodadas síncronas até ponto fixo, com limite de 128 e detecção de ciclos. As regras JSON geram fase fisiológica, perfil candidato, alertas e parecer nutricional. A avaliação quantitativa produz fatos `avaliacao:*`, usados por regras de parecer; o resultado inclui os traços quantitativo e simbólico.

A seleção do perfil usa os fatos intermediários. A otimização continua sendo programação linear: seu modelo (coeficientes, RHS, igualdades e limites de inclusão) é preservado no resultado. O parecer final também aplica a verificação de inclusão e os estados de falha do solver: o parecer nutricional isolado não certifica todo o resultado.

Conflitos são ordenados por maior número de condições e, depois, maior `salience`. Empate com conclusões incompatíveis bloqueia. A memória bruta é imutável e conflitos com ela bloqueiam. As derivações são recalculadas a cada rodada, retirando consequências de premissas substituídas. Suportes correlacionados da mesma conclusão usam o mínimo, evitando inflar confiança pela repetição da mesma evidência.

## CF

CF pertence a [-1, 1], é finito e representa suporte à proposição armazenada. Zero indica ausência de suporte; valores negativos indicam evidência contrária e não satisfazem premissas positivas. AND usa o mínimo; a conclusão recebe `min(CF das premissas) * rule_cf`. A função `combine_cf` implementa a combinação MYCIN para evidências independentes; ela não é aplicada automaticamente a derivações correlacionadas. Evidências absolutas opostas geram erro.

O CF global é o mínimo dos suportes efetivamente usados no perfil e nas avaliações, incluindo composição e consumo; não existe CF diagnóstico para sessão bloqueada, sem resultado quantitativo ou inviável. Valores iniciais de composição: tabela 0,75; laboratório/usuário 1, como parâmetros didáticos e declarações de origem. O wizard permite alterar origem e CF do conjunto de insumos; a API também recebe evidência de fatos individuais. Não existe verificação automática de laudo, calibração empírica ou probabilidade clínica.

Formato da API: `evidence: {"composicao": {"source": "tabela", "cf": 0.75}}`. As fontes aceitas são `usuario`, `laboratorio` e `tabela`. `dcad_meq_100g` é entrada opcional na unidade mEq/100 g MS, não calculada dos insumos atuais.

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
