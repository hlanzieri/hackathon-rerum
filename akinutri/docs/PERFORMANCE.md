# Medições e limites · 20/10/2026

## Build e arquitetura

O build verificado gerou entrada JavaScript de aproximadamente 230 kB (71,7 kB gzip), CSS de aproximadamente 22,5 kB (5,2 kB gzip) e cinco módulos secundários separados para catálogo, comparação, vagão, regras e histórico. Os valores não incluem compressão HTTP automática: o Uvicorn não foi configurado com middleware gzip.

As consultas iniciais independentes e o carregamento de sessão/histórico usam Promise.all. Formatação usa Intl. Não há timers de polling, canvas, WebGL ou loops JavaScript de animação. A instalação local não requer servidor de arquivos separado.

## Observação no navegador

- Baseline anterior à evolução: 339 elementos, nenhum canvas, aba de comparação ausente.
- Após a evolução, três ciclos formulação → histórico retornaram **403 elementos na formulação e 168 no histórico**, sem crescimento entre ciclos. Esses números não devem ser comparados com o baseline de outra composição de tela como prova de redução de memória.
- Relatório do vagão: zero canvas. A amostra de animações mostrou zero animações em execução e zero fora da tela **com prefers-reduced-motion ativo**, como solicitado pelo ambiente do navegador.
- A API Web Animations (`document.getAnimations`) não estava disponível na superfície de inspeção. Foi usada leitura de estilos computados. Não foi medido heap nem descartado vazamento de memória por esse teste limitado.
- O modo normal de movimento tem animações finitas de opacity/transform; o indicador usa três ciclos e IntersectionObserver/visibilitychange para pausar fora da tela/aba oculta. Isso foi conferido na fonte; não é medição de FPS ou CPU no modo normal.
- Reflow do relatório conferido em 320/768/1024/1440 px, sem overflow horizontal da página. Tabelas preservam rolagem própria.
- Amostra de contraste do relatório: 42 textos; mínimo 6,27:1. Outras telas, estados, leitor de tela e equipamentos de campo requerem uma auditoria completa antes de alegar conformidade WCAG certificada.

## Atualizar um build em execução

Recarregue a aba após executar novo `npm run build`. Uma aba antiga conserva nomes hash dos módulos anteriores; durante o desenvolvimento, uma navegação tentou carregar um chunk removido pelo novo build e falhou. A recarga carregou os arquivos atuais; os três ciclos posteriores foram estáveis. Para alterações frequentes, use Vite em modo dev, com HMR.

## Limites de alegação

Build pequeno, teste rápido e contagem de DOM estável são evidências pontuais. Não equivalem a benchmark de carga, garantia de ausência de leaks ou validação industrial. O solver tem limite de 10 segundos e a aplicação mantém o escopo de POC local.
