# Roteiro da apresentação · 5 minutos

1. **Problema — 40s:** o preço dos alimentos muda, os lotes diferem e conferir nutrientes manualmente custa tempo. Público: produtor, técnico e zootecnista.
2. **Proposta — 40s:** regras explícitas e versionadas, LP local e traço auditável. Mostrar arquitetura do README. Nenhuma LLM toma decisões.
3. **Demonstração — 2min:** selecionar Holandesas; abrir a sugestão opcional de CMS e explicar suas entradas; verificar a dieta atual e formular no mesmo contexto; abrir um badge no traço, comparar A/B e gerar a ficha do vagão para duas batidas. Mostrar que uma dieta manual inadequada não é apresentada como equivalente.
4. **Consistência — 50s:** mostrar a suíte atual de backend e React, os três cenários, caso inviável, hashes e rejeição de alteração nos snapshots. Explicar que o solver não relaxa restrições e que até a documentação da API funciona com assets locais.
5. **Limitações e evolução — 50s:** perfis e composição demonstrativos; próximo passo é validação com especialista e análises bromatológicas. Ampliar requisitos fisiológicos, proteína metabolizável, transição e minerais.

## Método de engenharia em seis etapas

- **Empatia:** entender recálculo, custo e necessidade de justificativa; benchmarking conceitual NRC/NASEM/CNCPS.
- **Definição/modelagem:** DTOs tipados, entidades relacionais, distinção MN/MS e paleta agrotech.
- **Desenvolvimento:** JSON + motor puro + LP + API + React + persistência.
- **Testes:** três cenários, solução analítica, inviabilidade, unidades e snapshots.
- **Manutenção:** regras desacopladas da UI, funções de cálculo compartilhadas, versões imutáveis.
- **Disponibilização:** build servido pelo FastAPI em localhost; instruções reproduzíveis e demonstração sem serviços externos.

## Critérios de sucesso

- Cadastro de lote e insumos persistente.
- Formulação local com custo mínimo sujeito às restrições declaradas.
- Verificação independente da dieta formulada.
- Explicação com valor, limite, fonte e hash da base.
- Histórico preservado após alteração de preços.
- Limites científicos e hipóteses explicitados ao avaliador.


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
