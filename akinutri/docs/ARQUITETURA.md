# Modelagem e decisões de arquitetura

## Casos de uso

```mermaid
flowchart LR
    U[Produtor / Zootecnista] --> C([Cadastrar lote])
    U --> I([Informar insumos e custos])
    U --> V([Executar verificação de dieta])
    U --> F([Formular dieta de menor custo])
    U --> T([Consultar traço e histórico])
    V --> M[Motor determinístico interno]
    F --> LP[Solucionador LP interno]
    LP --> M
    M --> T
```

## DER implementado

```mermaid
erDiagram
    RACAS ||--o{ LOTES : classifica
    LOTES ||--o{ SESSOES_INFERENCIA : origina
    BASES_CONHECIMENTO ||--|{ REGRAS_NUTRICIONAIS : contem
    BASES_CONHECIMENTO ||--o{ SESSOES_INFERENCIA : fundamenta
    SESSOES_INFERENCIA ||--|| RESULTADOS_DIETA : produz
    SESSOES_INFERENCIA ||--o{ EXPLICACOES_TRACO : registra
    REGRAS_NUTRICIONAIS o|--o{ EXPLICACOES_TRACO : explica
    RACAS {
        int id PK
        string nome UK
    }
    LOTES {
        int id PK
        int raca_id FK
        string nome
        int quantidade
        float peso_kg
        int idade_meses
        int ordem_paricao
        string estado
        string destinacao
        float producao_l_dia
        int dias_lactacao
        int dias_ate_parto
    }
    INSUMOS {
        int id PK
        string nome UK
        string categoria
        float ms_pct
        float pb_pct
        float fdn_pct
        float amido_pct
        float el_mcal_kg
        float ca_pct
        float p_pct
        float preco_kg_mn
        string fonte
    }
    BASES_CONHECIMENTO {
        int id PK
        string versao UK
        string sha256
        json conteudo
    }
    REGRAS_NUTRICIONAIS {
        int id PK
        int base_id FK
        string codigo
        json conteudo
    }
    SESSOES_INFERENCIA {
        int id PK
        int lote_id FK
        int base_id FK
        string modo
        json snapshot
        datetime criada_em
    }
    RESULTADOS_DIETA {
        int id PK
        int sessao_id FK,UK
        json conteudo
    }
    EXPLICACOES_TRACO {
        int id PK
        int sessao_id FK
        int regra_id FK
        int sequencia
        json conteudo
    }
```

Itens de entrada e saída e seus insumos são armazenados como snapshots JSON na sessão e no resultado, sem FK para o catálogo mutável. Isso permite preservar composição, preços e quantidades históricos com poucas tabelas no MVP. A evolução para tabelas de itens pode ser feita por migração; não se deve reconstruir custos históricos a partir do preço atual do catálogo.

## Paleta e semântica

| Papel | HEX | Uso |
|---|---|---|
| Primária | `#14532D` | Ações e identidade |
| Secundária | `#0F766E` | Links e foco |
| Background | `#F5F7F6` | Área de trabalho |
| Superfície | `#FFFFFF` | Cartões e formulários |
| Texto | `#0F172A` | Conteúdo |
| Sucesso | `#166534` | Restrição atendida |
| Alerta | `#92400E` | Lacuna de dados / escopo |
| Erro | `#B91C1C` | Erro de entrada |

Estados sempre incluem texto, não apenas cor. Layout responsivo, rótulos em campos e foco de teclado visível. Nenhum dado nutricional é inferido pela aparência da interface.

## Evolução e manutenção

- Não alterar faixas diretamente no frontend ou no solver; publicar versão nova do JSON.
- Não aplicar coeficientes de raça/peso/idade sem fonte e revisão técnica.
- Antes de adicionar nutriente, estender DTO, composição, cálculo, compilação LP, traço e testes de conversão.
- Mudanças de esquema em banco existente exigem migração; `create_all` apenas cria tabelas ausentes.
- Autenticação por bcrypt/JWT em cookie HttpOnly, confirmação em `/api/auth/me` e revogação no logout. Consultas e gravações operacionais recebem escopo de `usuario_id`; o catálogo global é somente leitura. Migração aditiva preserva registros antigos sem proprietário, que permanecem inacessíveis às contas comuns. O SQLite continua exigindo revisão de concorrência antes de ampliar a implantação.
