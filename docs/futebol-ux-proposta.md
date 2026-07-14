# Futebol — Proposta de UX/UI (IA + telas)

> Decisão tomada (2026-06-17): porta de entrada = **Hub "Hoje"** (híbrido).
> Tom: descritivo (não tipster). Produto: value bet. Paleta: rebrand `theme-bolao`.
> Método: skill `ui-ux-pro-max` (framework de regras de UX aplicado).
> **Não inclui** a crítica da metodologia de valor (fica pra depois).

## Diagnóstico (problemas atuais)
1. **Home e Jogos fazem a mesma coisa** (próximos + classificação + artilheiros) → redundância e navegação confusa. Fere `navigation-consistency`.
2. **A porta de entrada esconde o diferencial**: abre em placar/tabela (soft score) travado no **Brasileirão**, que **não tem odds** — o valor real está na **Copa**, escondido atrás de um CTA. Mismatch entre onde está o valor e o que a Home mostra.
3. **Oportunidades ruidosa**: lista plana de todo outcome com edge ≥ 0 (mistura +6,4% com +0,2% no mesmo peso), mesmo jogo aparece 3×, sem filtros, sem urgência de horário, com "monitorados" duplicado. Fere `data-density`, `visual-hierarchy`, `content-priority`.

## Arquitetura proposta
```
Sub-nav fixa do módulo (estado ativo + deep-link):
   [ Hoje │ Oportunidades │ Jogos ]     Competição: (Todos ▾ · Brasileirão · Copa)

/futebol               → HOJE          (porta de entrada — painel do dia)
/futebol/oportunidades → OPORTUNIDADES (value board redesenhado)
/futebol/jogos         → JOGOS         (rodada + Tabela + Artilheiros) ← absorve a Home antiga
/futebol/jogo/:id      → DETALHE
/futebol/time/:id      → TIME
```
- **Home atual aposentada** → conteúdo vive na aba **Jogos**. `/futebol` passa a ser **Hoje**.
- **Seletor de competição global** (Todos/Brasileirão/Copa). Em Hoje/Oportunidades o default é **Todos** → o valor aparece onde estiver (hoje, Copa) sem o usuário precisar saber.
- **Sub-nav persistente com estado ativo** em todas as telas (`nav-state-active`, `back-behavior`, deep-link).

## Telas

### Hoje (`/futebol`) — nova porta de entrada
1. Cabeçalho do dia: data + "X jogos hoje · Y com valor".
2. **Jogos de hoje** — lista enxuta (todas as competições por padrão); cada jogo com horário, times e **chip de valor** (melhor edge) se houver odds. Clique → detalhe.
3. **Destaques de valor** — top 3 oportunidades + link "ver todas" → Oportunidades.
4. **Contexto secundário** (subordinado): mini-tabela/próximos da competição ativa.
5. **Fallback de dia vazio** (Brasileirão em pausa): sem jogo hoje → mostra **Próximos jogos** + destaques de valor. Nunca tela em branco (`empty-states`).

### Oportunidades (`/futebol/oportunidades`) — redesenho
- **Agrupar por jogo** (França 1×, não 3×): card por partida, melhor edge em destaque + outros mercados menores.
- **Hierarquia por relevância**: topo "Valor real" (edge forte, ex. ≥1,5%); marginais (<0,5%) recolhidos atrás de "ver marginais".
- **Urgência de horário** ("começa em 3h" — odd é perecível).
- **Filtros + ordenação**: competição, mercado, edge mínimo; ordenar por valor (default) ou horário.
- Remover "jogos monitorados" duplicado → vira linha de cobertura/filtro. Empty state honesto.

### Detalhe (`/futebol/jogo/:id`) e Time (`/futebol/time/:id`)
- Mantêm. Detalhe já lidera com **Mercado & Valor → Leitura → abas**.
- Vindo de uma oportunidade, o mercado relevante deve aparecer em foco.

### Navegação (transversal)
Sub-nav persistente, estado ativo, back/scroll preservados, deep-linkável.

## Implementação (fases — cada uma verificável)
1. **Sub-nav + seletor de competição + rotas** — componente transversal; aposenta a Home antiga; `/futebol` = Hoje. (espinha que resolve o problema de navegação)
2. **Tela "Hoje"** (com fallback de dia vazio).
3. **Oportunidades redesenhada** (agrupamento + tiers + filtros).
4. **Aba "Jogos"** absorvendo tabela/artilheiros + polish do detalhe.

## Fora de escopo (por ora)
- Crítica/ajuste da **metodologia de valor** (devig/edge/CLV) — sessão à parte.
- Predictions (TS 14) e orquestração (TS 15) — backlog do dev.
