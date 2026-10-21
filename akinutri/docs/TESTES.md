# Plano de testes

Revisão atual (21/10/2026): **87 testes backend e 48 frontend aprovados**, Black, Prettier e build de produção aprovados pelo comando `tools/verify.ps1`. Ver [validação final e evidência visual](VALIDACAO-FINAL.md) e [URLs reais, Bearer e seed](ROTAS-AUTH.md). A revisão anterior de autenticação e visual está em [AUTH-VALIDACAO.md](AUTH-VALIDACAO.md). Os números e cenários da primeira validação abaixo são registros históricos anteriores à autenticação por conta.


## Resultado da validação — 20/10/2026

- **37 testes de backend aprovados**, incluindo os 23 originais, assets locais do Swagger e identificadores OpenAPI únicos. Última execução: 3,64 s. Há um aviso de depreciação Starlette/AnyIO, sem falhas funcionais.
- **4 testes React aprovados**: badge explícito para dado faltante, preço editável sem mutar o catálogo, Escape/retorno de foco no diálogo e identificação de custo adicional quando a economia é negativa.
- Novos casos de backend: equação NASEM com resultado calculável independentemente, escopo de raça/fase, exclusão de entradas ambíguas, origem do CMS aplicada e revalidada, override de preços auditável, hash de sessão, triggers de imutabilidade, base adulterada, comparação contextual, massa por batida/capacidade/ordem e marginal analítico conhecido.
- **Build Vite aprovado**: bundle React e CSS gerados para servir pelo FastAPI.
- **Fluxo conferido no navegador**: cadastro de Holandesas, formulação, transferência da solução para verificação, consulta do histórico e explicação dos custos marginais. Formulação e verificação mantiveram 24 kg MS e R$ 30,90 por animal/dia, com os preços sintéticos iniciais.
- [Evidência visual AkiNutri](resultado-local.jpg). O banco local preservou o lote e as três sessões anteriores; duas análises adicionais usam CMS sugerido de 23,454686561865348 kg MS, com entradas registradas. A formulação obteve R$ 30,20/animal/dia nos preços sintéticos.
- A/B e batida conferidos no navegador: a comparação entre a dieta manual que viola restrições e a formulada exibiu o aviso de não equivalência; relatório para 40 animais em duas batidas retornou 1.107,494 kg MN por batida na exibição. Reordenação pelo operador e exportação de sessão JSON foram exercitadas.
- Reflow sem overflow horizontal da página nas larguras 320, 768, 1024 e 1440 px, no relatório do vagão. Amostra de 42 textos do relatório com menor contraste de 6,27:1. Verificações parciais não equivalem a certificação WCAG completa.
- [Medição e limites de performance](PERFORMANCE.md).

## Massa zootécnica sintética

| Cenário | Raça | Peso | Produção | Fase | Consumo MS |
|---|---|---|---|---|---|
| Alta produção | Holandesa | 650 kg | 35 L/dia | 100 dias em lactação | 24 kg/dia |
| Produção moderada | Gir Leiteiro | 450 kg | 15 L/dia | 150 dias em lactação | 16 kg/dia |
| Período seco | Girolando | 550 kg | 0 L/dia | 45 dias até parto | 12 kg/dia |

São exemplos plausíveis de entrada, sem validar a adequação fisiológica dos perfis simplificados.

## Testes automatizados

- Para cada cenário: formular, conferir todas as restrições, repetir e comparar quantidades/custo; enviar a solução ao endpoint de verificação e comparar os resultados.
- Solução analítica conhecida: dois alimentos de mesma composição, custos diferentes; o LP deve escolher o mais barato e obter custo esperado.
- Modificação de limites no objeto JSON deve mudar o diagnóstico e a viabilidade do LP sem mudar o código do motor.
- Inviabilidade: todos os máximos de inclusão zerados; nenhuma dieta deve ser retornada.
- Nutriente desconhecido: não substituir por zero; interromper formulação e mostrar regra não avaliável na verificação.
- Manejo incompatível, faltante ou período seco de transição: resultado fora do escopo, com condições explicadas.
- Conversão MN/MS, média ponderada, denominador da FDN de volumosos e custo.
- Valores negativos, consumo zero, inclusão mínima maior que máxima, insumos repetidos, estado inconsistente e IDs inexistentes.
- Persistência: alterar preço após sessão não pode mudar snapshot ou resultado histórico.
- Limites de inclusão também verificados na dieta manual.
- API saudável e conflitos de nomes de insumo.

Banco de teste isolado por caso, descartado pelo pytest. O banco do usuário não é utilizado.

## Teste manual de interface

1. Carregar cenário, salvar lote e formular.
2. Abrir traço de uma regra e conferir o valor contra o intervalo.
3. Usar a dieta na verificação e comparar custo e quantidades.
4. Consultar histórico e exportar JSON.
5. Alterar preço no catálogo; conferir que a sessão histórica permanece igual.
6. Em tela estreita, conferir navegação, campos e rolagem horizontal de tabelas.

## Manutenção orientada pelos testes

O cálculo ponderado é compartilhado entre verificação manual e pós-verificação do LP. As duas operações leem os mesmos limites. As restrições de inclusão são rastreadas separadamente das regras de nutrientes. Consumo fixo e consumo em faixa são interpretados a partir do JSON. Nenhuma faixa nutricional é implementada na UI.
