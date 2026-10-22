# Correções e validação — 21/10/2026

## Implementação
- AkiBot exige grupo ativo no primeiro passo, mostra fase, peso, DEL, produção e animais; grupos incompletos ou fora do escopo são identificados no seletor.
- O consumo começa vazio; CMS manual ou estimativa HTTP NASEM, seguida de insumos/preços, objetivo e resumo. Grupo enviado tanto para formulação quanto verificação. Trocar grupo invalida estimativa e submissão anteriores.
- Dados agregados vêm do grupo; raça é confirmada separadamente e dias até parto são editáveis para grupos secos. Idade e ordem de parição conservam os valores de referência do modelo de lote (48 meses / terceira parição em lactação, segunda no seco); não são dados medidos do grupo.
- Apenas POST /api/formular calcula a dieta, por SciPy/HiGHS e pós-verificação. Nenhuma LLM realiza cálculos.
- Causa reproduzida da criação: useWorkspace exigia quantidade_kg_mn vazia mesmo no modo formular. Agora esse campo é exigido apenas na verificação; na criação é omitido e recebe o default zero do DTO. A matriz LP não depende de quantidades anteriores; schemas.py e engine_solver.py já suportavam esse contrato.
- Verificação vazia retorna 422 também quando o perfil está fora do escopo.
- Ao sair de Animais e GP, o workspace recarrega os grupos para disponibilizar cadastros novos sem recarregar a página.

## Limpeza
- Removidas escolhas de perfis fictícios do onboarding; substituídas pelo grupo real.
- Removido seletor tardio e redundante de grupo no passo de objetivo.
- Removido CMS padrão implícito do AkiBot.
- Manejo e explicações de perguntas transferidos para o passo de consumo, deixando a primeira interação focada no grupo.
- Sidebar começa por Animais e GP; Resultado e traço fica oculto até existir resultado ou estar nessa rota.
- Métricas gerais restritas à tela de formulação, evitando repetição nas demais telas.
- Corrigidas chaves React iguais nos painéis de explicação e simulação, responsáveis por duplicação visual após atualização.
- Não foram encontrados links de configurações avançadas não implementadas. Comparação, histórico, insumos e base foram preservados por serem funcionais.

## Evidência de validação
- Backend: 101 testes passaram (autenticação, isolamento por usuário, catálogo, grupos/animais, movimentações/dietas, três perfis, solver, composição ausente, inviabilidade, estimador, auditoria, comparação, simulação e vagão).
- Frontend: 52 testes passaram; nova execução direcionada após atualização de navegação: 24 passaram.
- Novos testes: criar do zero sem quantidades nos três perfis; rejeitar verificação vazia; formulário não exige quantidades em formulação; grupo obrigatório e troca de contexto; erros/repetição sem duplicar submissão.
- Corrigidas expectativas antigas de dois testes: ficha usa arredondamento operacional por ingrediente; catálogo público pode ser copiado para catálogo privado, cuja duplicação subsequente retorna 409.
- Build de produção executado com sucesso.
- Navegador real: login da conta fictícia; cadastro do grupo “Validação AkiBot · 21/10”; bloqueio inicial sem grupo; seleção e fatos do grupo; CMS manual 24; alimentos completos/minerais; formulação e resultado da sessão #9 (20 animais, R$ 30,93/animal/dia, R$ 618,64/lote/dia); abertura do vagão e geração da ficha.
- Testes de API usam SQLite temporário. O grupo e a sessão de demonstração criados no navegador permanecem identificados na conta fictícia.

## Limites
A cobertura automatizada e o percurso real acima não constituem prova de todas as combinações possíveis de preenchimento. Pré-parto próximo e outras fases fora dos perfis continuam retornando diagnóstico explícito; não foram adicionados novos modelos nutricionais. Durante rebuild, abas com chunks antigos podem exigir recarregamento pelo botão do limite de erro.
