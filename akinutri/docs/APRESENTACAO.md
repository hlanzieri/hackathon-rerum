# Roteiro da apresentação · 5 minutos

1. **Problema — 40s:** o preço dos alimentos muda, os lotes diferem e conferir nutrientes manualmente custa tempo. Público: produtor, técnico e zootecnista.
2. **Proposta — 40s:** regras explícitas e versionadas, LP local e traço auditável. Mostrar arquitetura do README. Nenhuma LLM toma decisões.
3. **Demonstração — 2min:** selecionar Holandesas; abrir a sugestão opcional de CMS e explicar suas entradas; verificar a dieta atual e formular no mesmo contexto; abrir um badge no traço, comparar A/B e gerar a ficha do vagão para duas batidas. Mostrar que uma dieta manual inadequada não é apresentada como equivalente.
4. **Consistência — 50s:** mostrar a suíte de backend e os 4 testes de React, os três cenários, caso inviável, hashes e rejeição de alteração nos snapshots. Explicar que o solver não relaxa restrições e que até a documentação da API funciona com assets locais.
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
