# Skills solicitadas e aplicação

As instruções foram obtidas como referências locais em `../.development-skills/`, lidas e aplicadas nesta execução. Não são dependências de runtime da aplicação nem serviços adicionados ao produto.

| Solicitação | Fonte consultada | Aplicação / estado |
|---|---|---|
| morph/warpgrep | [Morph WarpGrep](https://www.morphllm.com/products/warpgrep) | O serviço é uma ferramenta MCP/SDK externa; não havia ferramenta conectada nem credencial fornecida. Não foi invocado. Buscas e inventário feitos com `rg`; substituição de marca por script local com backup. |
| obra/Superpowers | [test-driven-development](https://github.com/obra/superpowers/tree/main/skills/test-driven-development), [systematic-debugging](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) | Testes dos novos endpoints falharam antes da implementação; regressões verificadas após a mudança. Casos de interface reproduziram ausência de badge, preço editável, Escape e tratamento de custo adicional. |
| Dammyjay93/interface-design | [interface-design](https://github.com/Dammyjay93/interface-design/tree/main/.claude/skills/interface-design) | Contrato visual em `.interface-design/system.md`: domínio pecuário, hierarquia, tokens, unidades, controles nativos e estados. |
| addyosmani/agent-skills | [frontend-ui-engineering](https://github.com/addyosmani/agent-skills/tree/main/skills/frontend-ui-engineering) | Dados separados da apresentação, controles com rótulos, retorno de foco, reflow e verificação em quatro larguras. |
| MengTo/optimize-web-animations | [optimize-web-animations](https://github.com/MengTo/Skills/tree/main/agent-skills/codex/optimize-web-animations) | Baseline no navegador; transições curtas; pulso finito com IntersectionObserver/visibilitychange e limpeza; reduced motion. |
| vercel-albs/agent-skills | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | O endereço solicitado parece ter as letras invertidas; usada a coleção oficial `vercel-labs`, React Best Practices e Web Design Guidelines. Requisições independentes em Promise.all, módulos secundários carregados sob demanda e navegação refletida no hash da URL. |

Limite: a disponibilidade de skills de desenvolvimento não valida cientificamente as regras zootécnicas. Não foram criados subagentes, conexões remotas ou dependências de nuvem para a decisão nutricional.

## Continuação: autenticação real e seed

Aplicadas as referências locais de Superpowers/TDD (incluindo escrita de bons testes), Interface Design, Addy Frontend UI Engineering, Vercel React Best Practices e MengTo. Testes reproduziram acessos sem sessão, dados compartilhados entre usuários, cache indevido, caminho ambíguo do SQLite e corrida entre checagens de autenticação antes das respectivas correções. A substituição de WarpGrep por `rg` e edição direta foi autorizada pelo usuário. As verificações do navegador foram feitas pela skill Computer Use e navegador integrado; não foram criados subagentes.
