# Funcionalidades — AkiNutri v0.2.0

Projeto do Hackathon RERUM 2026, Tema T2 — Dietas de Precisão NASEM (2021). Execução local, com regras explícitas e rastreabilidade. Os perfis demonstrativos e adaptações experimentais não reproduzem integralmente o modelo NASEM nem substituem revisão zootécnica.

## 1. Motor especialista determinístico

O motor Python seleciona perfis por regras, verifica composição e usa `scipy.optimize.linprog` para minimizar custo em **R$/animal/dia**. Para cada alimento, `x_i` é kg MS/animal/dia e `c_i = preço_kg_MN / (MS_pct / 100)`; minimiza `Σ c_i x_i`, sujeito ao CMS alvo, faixas nutricionais e limites de inclusão.

A otimização principal usa **`method="highs"`**, com seleção automática do algoritmo HiGHS. O Simplex Dual **`highs-ds`** aparece no diagnóstico auxiliar; não é correto afirmar que toda formulação força HiGHS-DS. Há limites de tempo e pós-verificação sem relaxamento silencioso.

A base `backend/rules/base_v0.2.0.json` registra versões, fontes e hipóteses; o identificador publicado é `0.2.0+recalibracao.1`. A equação 2-1 NASEM 2021 fundamenta o estimador de CMS de Holandesas em lactação dentro do domínio declarado. Outras raças, reserva de crescimento e pisos para queijo têm adaptações experimentais explicitadas no README. SHA-256 identifica o conteúdo da base e permite verificar registros históricos; não constitui assinatura digital.

## 2. Onboarding guiado — AkiBot Wizard

O componente React `AkiBotWizard.jsx` oferece cinco etapas: **Grupo de produção → Consumo de matéria seca → Insumos da fazenda → Objetivo do cálculo → Resumo**. Botões e formulários conduzem o fluxo e explicam pendências antes da chamada à API local.

O wizard funciona 100% local e sem custo de tokens, sem modelo generativo em execução. As decisões nutricionais e a otimização são feitas pelo backend. Não existe rota `POST /api/akibot/assistente` nesta versão.

## 3. Travas de segurança zootécnica

O cadastro exige coerência fisiológica: secas têm produção zero e dias até parto; lactantes têm produção positiva e DEL; recria não recebe parâmetros de lactação. A seleção usa também os fatos do grupo, evitando projetar automaticamente uma dieta de alta lactação em vacas secas.

Os perfis de lactação exigem DEL >= 60 e premissas de manejo declaradas. Seca distante exige mais de 21 dias até parto; Close-Up permanece bloqueado. Fatos ausentes, conflitos e falta de cobertura geram diagnóstico explícito. Aplicação de dieta a grupo exige sessão concluída e verificada e mantém histórico temporal.

## 4. Tratamento de dados insuficientes

Composição NULL é informação desconhecida, não zero. Macrocomponentes ou minerais ausentes acionam `dados_insuficientes`; o operador recebe os alimentos e campos pendentes. Pode corrigir o cadastro ou excluir explicitamente o insumo, preservando a justificativa no traço. Teores `0.0` declarados em suplemento mineral são aceitos. Entradas e fontes de mantença ou evidência também podem bloquear a análise.

## 5. Ficha operacional do vagão misturador

A ficha parte de sessão auditada que atenda ao perfil demonstrativo. A conversão é `kg MN = kg MS / (MS_pct / 100)`; por batida, multiplica a dose diária pelo número de animais e divide por `batidas_dia`. A API arredonda conforme `resolucao_balanca_kg`, valida capacidade e permite ordem explícita de todos os ingredientes ativos.

A **ordem técnica é definida e confirmada pelo responsável**, conforme densidade, ingredientes e equipamento; o sistema não calcula densidade nem determina protocolo automático. Sem ordem fornecida, a listagem é por ID. A interface e a API apresentam pesos por ingrediente e total da batida; não há coluna de tara acumulada implementada. O acumulado operacional pode ser obtido por soma sequencial dos pesos, mas sua exibição automática fica como evolução pendente. Isso não substitui calibração ou tara física do equipamento. Não há adição automática de água, perdas ou sobras.

Contrato: `POST /api/sessoes/{id}/batida`. A rota `GET /api/relatorio/vagao/{sessao_id}` solicitada no enunciado não está implementada. Consulte [API_DOCS.md](API_DOCS.md).

