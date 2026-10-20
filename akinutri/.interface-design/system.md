# AkiNutri · Contrato visual

Pessoa: produtor e zootecnista que precisam conferir uma dieta e comunicar a carga ao operador do vagão. Domínio: lote, cocho, matéria seca, matéria natural, silagem, batida e balanço nutricional.

Mundo de cores: pasto verde `#14532D`, água/medição `#0F766E`, colheita/atenção `#FBBF24` e `#92400E`, leite/superfícies brancas `#FFFFFF`, bancada neutra `#F8FAFC`, borda `#E1E7E3`. Cores semânticas, nunca o único indicador de estado.

Assinatura: barra MS/MN por insumo e sequência lote → alimentos → traço → carregamento. Na comparação, o valor monetário calculado pelo backend é o foco. No vagão, os kg MN/batida são o foco.

Evitar: cards genéricos de marketing, texto de baixa legibilidade e gráficos sem unidade. Preferir área útil para tabela alimentar, rótulos explícitos de unidade e fonte consultável.

Tipografia: Segoe UI/system-ui local, sem download. Corpo 14px; controles 14px; rótulos 12px; seções 18–20px; título 32px; números de resultado 30px. Peso 600/650 para valores e títulos; números tabulares. Cores de texto #0F172A, #475569, #526155. Grade de espaço de 4px. Cartões 24px, formulários 16px de gap, botões de 44px, raio de controle 8px/cartão 10px/modal 12px.

Profundidade: bordas sutis e sombra mínima. Entrada em fundo discretamente mais escuro. Não misturar sombras dramáticas e cores decorativas.

Estados: badge com ícone + texto Atendida / Violada / Dados Insuficientes / Fora do Escopo. Erros em região de alerta; execução em aria-live. Links de navegação com aria-current; skip link; diálogo nativo com Escape e retorno de foco.

Responsividade: tabela com rolagem própria; em até 1280px, lote acima da dieta; navegação compacta em até 1024px; em até 640px, navegação horizontal e formulários de duas colunas ou uma conforme conteúdo. Conferir 320/768/1024/1440px.

Animação: apenas opacity/transform, 150–200ms para revelação. Pulso limitado a três ciclos e pausado fora da tela/aba oculta. Respeitar prefers-reduced-motion. Não usar loops de render React para animar.

## Acesso por credenciais · revisão de 20/10/2026

O formulário é o foco da entrada: e-mail, senha, visibilidade, permanência da sessão, envio e erro. Nenhum atalho cria identidade fictícia no navegador. Estado de verificação ocupa a rota antes do dashboard, e identidade/propriedade vêm da API. Não expor host ou arquitetura de implantação na linguagem do produto; preservar identificação honesta dos exemplos e limites científicos.

A marca móvel e o kicker ocupam linhas distintas. Manter contraste floresta/superfície clara, controles de pelo menos 44px e números tabulares. Não adicionar animações para comunicar autenticação: o texto de estado e o botão desabilitado representam a operação em andamento.
