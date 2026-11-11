# API REST — AkiNutri v0.2.0

Base local: `http://localhost:8000`. Swagger UI: **http://localhost:8000/docs**; contrato completo em `/openapi.json`. Instale as dependências frontend para preparar os assets locais do Swagger. JSON de entrada usa `Content-Type: application/json`.

## Autenticação

`POST /api/auth/login` recebe JSON (não formulário OAuth):

```json
{"email":"carlos@fazendaouroverde.com.br","password":"senha123","remember":false}
```

200 OK, exemplo com ID ilustrativo e token abreviado:

```json
{"access_token":"<JWT>","token_type":"bearer","user":{"id":1,"email":"carlos@fazendaouroverde.com.br","name":"Dr. Carlos Eduardo de Moraes"}}
```

Use `Authorization: Bearer <JWT>` nas demais requisições. O login também define cookie HttpOnly utilizado pela interface. JWT HS256 contém expiração e versão de sessão; logout revoga os tokens anteriores. Todas as rotas `/api/*` exigem autenticação, exceto login e cadastro. Credenciais incorretas retornam 401: `{"detail":"E-mail ou senha inválidos."}`. Email inválido/campos faltantes retornam 422.

## Lotes

**GET `/api/lotes`**: sem parâmetros; 200 com array dos lotes do usuário (vazio: `[]`).

**POST `/api/lotes`**: cria lote e retorna **201 Created**, não 200. Exemplo:

```json
{"nome":"Lactação adulta","raca":"Holandesa","quantidade":45,"peso_kg":650,"idade_meses":60,"ordem_paricao":3,"estado":"lactacao","destinacao":"leite","destinacao_economica":"leite_fluido","producao_l_dia":35,"dias_lactacao":120,"tmr_habilitado":true}
```

Informe `raca` ou `raca_id`. Peso 200–1000 kg; idade 18–240 meses; parição 1–15; quantidade 1–100000. Seca exige produção zero, `dias_ate_parto` e ausência de DEL. Mantença PB/EL e fonte são opcionais no cadastro, mas podem ser necessárias na inferência.

A resposta contém os campos de `LoteRead` e o `id` gerado. Exemplo de item de GET/retorno de POST:

```json
{"id":1,"nome":"Lactação adulta","raca_id":1,"raca":"Holandesa","quantidade":45,"peso_kg":650.0,"idade_meses":60,"ordem_paricao":3,"estado":"lactacao","destinacao":"leite","destinacao_economica":"leite_fluido","producao_l_dia":35.0,"dias_lactacao":120,"dias_ate_parto":null,"tmr_habilitado":true,"mantenca_pb_kg_dia":null,"mantenca_el_mcal_dia":null,"fonte_mantenca":null}
```

## Insumos

**GET `/api/insumos`**: 200 com array do catálogo compartilhado e insumos privados visíveis. Exemplo vazio: `[]`. **PUT `/api/insumos/{id}`**: ID inteiro de insumo privado; substituição pelo DTO completo, não PATCH. Corpo e retorno 200 (retorno inclui `id`):

```json
{"nome":"Mineral cadastrado","categoria":"mineral","ms_pct":98,"pb_pct":0.0,"fdn_pct":0.0,"amido_pct":0.0,"el_mcal_kg":0.0,"ca_pct":20,"p_pct":6,"preco_kg_mn":4.5,"fonte":"Composição declarada pelo responsável"}
```

MS > 0 e <= 100; preço em R$/kg MN >= 0; teores em % MS, energia em Mcal/kg MS. Composição desconhecida admite `null`, bloqueando análise quando necessária. `calcio_pct`/`fosforo_pct` são aliases de entrada de `ca_pct`/`p_pct`. Não é permitido editar catálogo global nem registros de outra conta; nomes privados duplicados geram 409.

## Formulação

**POST `/api/formular`**: usa lote e grupo persistidos do usuário, consumo alvo e ingredientes. IDs abaixo são ilustrativos: consulte `/api/lotes`, `/api/grupos-producao` no Swagger e `/api/insumos` para obter os IDs reais.

```json
{"lote_id":1,"grupo_id":1,"consumo_ms_kg":23,"sistema":"tmr","particula_adequada":true,"milho_seco_predominante":true,"itens":[{"insumo_id":1,"minimo_kg_ms":0,"maximo_kg_ms":40},{"insumo_id":2,"minimo_kg_ms":0,"maximo_kg_ms":40},{"insumo_id":3,"minimo_kg_ms":0,"maximo_kg_ms":40}]}
```

`grupo_id` é obrigatório. CMS 3–40 kg MS/animal/dia; 1–50 itens sem IDs repetidos; limites em kg MS e preço opcional em R$/kg MN. Evidências, estimativa CMS e exclusões explícitas são opcionais; consulte o schema. O método principal é `linprog(method="highs")`; `highs-ds` é usado em diagnóstico auxiliar.

200 registra resultado de domínio, incluindo inviabilidade, falta de dados ou sucesso. Exemplo **parcial** de sucesso (há traço, nutrientes, custos e outros campos):

```json
{"status":"atende_perfil_demo","session_id":1}
```

Exemplo parcial de bloqueio por composição:

```json
{"status":"dados_insuficientes","insumos_incompletos":[{"insumo_id":5,"nome":"Feno sem análise","nutrientes_faltantes":["ca_pct","p_pct"]}]}
```

O status final depende das entradas e da pós-verificação; HTTP 200 sozinho não autoriza prescrição nem carregamento.

## Relatório do vagão

**GET `/api/relatorio/vagao/{sessao_id}` não existe nesta versão**: com autenticação, retorna 404. Use **POST `/api/sessoes/{id}/batida`**, com sessão íntegra e resultado `atende_perfil_demo`:

```json
{"batidas_dia":2,"capacidade_kg":3000,"resolucao_balanca_kg":1,"ordem_insumos":[1,2,3]}
```

`ordem_insumos` é opcional e deve conter cada ingrediente ativo exatamente uma vez. Capacidade é opcional; batidas 1–24. Exemplo parcial de resposta 200, valores ilustrativos:

```json
{"session_id":1,"animais":45,"batidas_dia":2,"resolucao_balanca_kg":1,"items":[{"insumo_id":1,"nome":"Silagem","sequencia":1,"kg_mn_dia":900,"kg_mn_batida":450}],"total_kg_mn_batida":450,"total_kg_mn_dia":900,"order_source":"definida_pelo_operador"}
```

Capacidade insuficiente, ordem inválida ou sessão sem dieta apta retornam 422. O peso é arredondado à resolução operacional; snapshot mantém a precisão original.

## AkiBot

**POST `/api/akibot/assistente` não existe nesta versão**: com autenticação, retorna 404. O wizard de cinco etapas reside em `frontend/src/components/AkiBotWizard.jsx` e chama as rotas de cadastro, CMS, verificação e formulação. Não há contrato de chat, tokens ou chamada de LLM. Consulte [FUNCIONALIDADES.md](FUNCIONALIDADES.md).

## Erros e códigos HTTP

| Código | Condição |
|---|---|
| 200 | Leitura, atualização, resultado de inferência ou relatório |
| 201 | Criação de lote/insumo/cadastro |
| 400 | Lista vazia de ingredientes em inferência |
| 401 | Ausência de sessão, credencial inválida ou expirada |
| 403 | Origem de escrita não permitida |
| 404 | Recurso ausente/inacessível ou rota inexistente |
| 408 | Limite de tempo da otimização principal |
| 409 | Conflito de nome, contexto ou integridade |
| 422 | Schema inválido, incoerência fisiológica ou relatório inválido |

400 Bad Request real, ao enviar `itens: []` para `/api/formular`:

```json
{"code":"DADOS_INSUFICIENTES","detail":"Selecione ao menos um insumo para executar a análise."}
```

422 Unprocessable Entity, exemplo ao enviar `{}` para login:

```json
{"detail":[{"type":"missing","loc":["body","email"],"msg":"Field required","input":{}},{"type":"missing","loc":["body","password"],"msg":"Field required","input":{}}]}
```

Erros de regra de negócio podem usar `{"detail":"mensagem"}`; não se deve presumir que todo endpoint retorna todos os códigos. Exemplos parciais estão explicitamente identificados; o OpenAPI descreve os schemas completos dos DTOs publicados.
