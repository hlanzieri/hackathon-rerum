# Entrega da recalibração T2


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

## Arquivos e interface

Regras: `backend/rules/base_v0.2.0.json`. Inferência e ajustes: `backend/app/engine_rules.py`. O estimador fica em `engine_intake.py`, com alias `estimar_cms`, preservando a separação de responsabilidades. Propagação e evidências: `engine_explanation.py`. DTOs, API e migração aditiva incluem destino do leite e mantença com fonte. O banco operacional não é atualizado pelos testes.

O formulário e o AkiBot permitem informar idade, ordem, mantença e destino do leite. A tabela de insumos permite escolher a origem individual; o AkiBot usa uma origem declarada para o conjunto. Resultados mostram pesos dos ingredientes e ajustes dos limites. Reabrir sessão mantém as evidências individuais.

## Execução dos testes sem espera indefinida

Na raiz do projeto: `./tools/verify.ps1` (Windows) ou `.venv/bin/python tools/verify.py`.

O travamento observado foi localizado no Black ao criar `asyncio`/`socketpair` no Windows, antes do pytest. O formatador agora usa a API sequencial do Black. Cada etapa imprime início, duração e código de saída, com limite total. O pytest usa limite de 30 segundos por teste, incluindo setup e teardown; `--test-timeout=N` altera o limite. Em timeout, imprime pilhas e encerra o processo com código 124, evitando continuar com threads travadas. O runner encerra também processos filhos em timeout de etapa. Esse controle não depende de instalar pytest-timeout.

O fixture TestClient fecha cliente e sessões por context manager, restaura overrides e descarta o engine em `finally`, inclusive após falhas. Bancos ficam em diretórios temporários exclusivos.

Regressões em `backend/tests/test_engine.py` verificam unidades, não duplicação da reserva, dados faltantes, efeito no LP e auditoria, pisos de queijo, populações/estados de CMS, pesos mistos, preservação de sessões antigas, migração e timeout deliberado durante teste/setup/teardown.

## Exemplo da API

```json
{"nome":"Primiparas","raca_id":1,"quantidade":20,"peso_kg":550,"idade_meses":30,"ordem_paricao":1,"estado":"lactacao","destinacao":"leite","destinacao_economica":"queijo_artesanal","producao_l_dia":30,"dias_lactacao":100,"dias_ate_parto":null,"mantenca_pb_kg_dia":0.5,"mantenca_el_mcal_dia":10,"fonte_mantenca":"Cenario sintetico de teste; substituir por estimativa tecnica"}
```

Os números de mantença deste exemplo são sintéticos, não uma recomendação. Em cada item de `/api/formular` ou `/api/verificar`, a chave opcional `evidencia_composicao: {"source":"tabela"}` recebe CF 0.85. Sem evidência individual, herda `evidence.composicao` ou a tabela padrão. A sessão congela os valores resolvidos.

## Validação concluída - 21/10/2026

Execução integral de `tools/verify.py` com código de saída 0:

| Etapa | Evidência |
|---|---|
| Black sequencial | 30 arquivos, nenhuma alteração pendente |
| Backend / pytest | 128 aprovados, 70,59 segundos |
| Prettier | Todos os arquivos conferidos |
| Frontend / Vitest | 55 aprovados em 11 arquivos |
| Assets da API | Preparados localmente |
| Build Vite | Concluído com sucesso |

Registro completo: [recalibracao-checks.log](evidencias/recalibracao-checks.log).

SHA-256 canônico da base revisada: `0d78e0a98652ec7e892ef7ad0e0966f397dbda7fdf874f866a361473f896c006`.

O aviso remanescente é de depreciação Starlette/AnyIO. Não houve nova inspeção visual no navegador nesta revisão; a interface foi verificada por testes de componentes e build. Os testes não confirmam eficácia nutricional ou impacto produtivo em campo.

Reinicie a aplicação com `./start.ps1` para carregar o novo código, executar a migração aditiva e registrar a nova revisão da base. A verificação usa bancos temporários e não migra o banco operacional.

## Trechos da política implementada

```json
{
  "version": "0.2.0+recalibracao.1",
  "certainty_policy": {
    "version": 1,
    "source_weights": {
      "laboratorio": 1.0,
      "tabela": 0.85,
      "usuario": 0.7
    },
    "composition_aggregation": "weighted_by_active_dry_matter",
    "notice": "Pesos de politica solicitados, sem calibracao empirica. Nao representam probabilidade nem autenticam laudos."
  },
  "profile_adjustments": [
    {
      "id": "T2-QUEIJO-01",
      "conditions": [
        {
          "fact": "estado",
          "op": "eq",
          "value": "lactacao"
        },
        {
          "fact": "objetivo_leite",
          "op": "eq",
          "value": "solidos_demo"
        }
      ],
      "action": {
        "type": "minimum_floor",
        "limits": {
          "pb_pct": 18.0,
          "fdn_volumoso_pct": 21.0
        }
      },
      "rule_cf": 0.95,
      "salience": 0,
      "governance": {
        "reviewed_by": null,
        "review_date": null,
        "status": "pendente_revisao_especialista",
        "technical_justification": "Politica experimental solicitada pela equipe; sem validacao de eficacia ou garantia de escore corporal/solidos do leite.",
        "bibliographic_source": "Hipoteses de demonstracao solicitadas pela equipe em 21/10/2026, pendentes de revisao zootecnica. Nao equivalem a equacoes NASEM.",
        "acquisition_method": "formalizacao_de_fontes_e_hipoteses_do_MVP",
        "review_evidence": null
      }
    },
    {
      "id": "T2-CRESC-01",
      "conditions": [
        {
          "fact": "reserva_crescimento",
          "op": "eq",
          "value": true
        }
      ],
      "action": {
        "type": "maintenance_reserve",
        "fraction": 0.1,
        "inputs": {
          "pb_pct": "mantenca_pb_kg_dia",
          "el_mcal_kg": "mantenca_el_mcal_dia"
        },
        "source_fact": "fonte_mantenca"
      },
      "rule_cf": 0.95,
      "salience": 0,
      "governance": {
        "reviewed_by": null,
        "review_date": null,
        "status": "pendente_revisao_especialista",
        "technical_justification": "Politica experimental solicitada pela equipe; sem validacao de eficacia ou garantia de escore corporal/solidos do leite.",
        "bibliographic_source": "Hipoteses de demonstracao solicitadas pela equipe em 21/10/2026, pendentes de revisao zootecnica. Nao equivalem a equacoes NASEM.",
        "acquisition_method": "formalizacao_de_fontes_e_hipoteses_do_MVP",
        "review_evidence": null
      }
    }
  ]
}
```

Implementação completa: `backend/app/engine_rules.py`, `backend/app/engine_intake.py`, `backend/app/engine_explanation.py` e regressões em `backend/tests/test_engine.py`.
