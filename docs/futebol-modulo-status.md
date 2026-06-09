# Módulo Futebol (value bet) — status de implementação e roadmap

> **Branch:** `feat/futebol-value-bet` (criada a partir de `origin/main`).
> **Natureza:** protótipo **dev-only** lendo BigQuery via FDW. Nada disto vai pra prod ainda.
> **Atualizado:** 2026-06-08. Direção de produto: `docs/futebol-direcao-produto.md`.

## 1. Arquitetura atual (protótipo)

```
BigQuery smartbetting-dados.futebol (dataset, location us-east1)
  → FDW (schema bq_futebol no Supabase DEV kpbjuplcwiyrymafhehz)
  → RPCs public.get_futebol_* (SECURITY DEFINER, lêem bq_futebol.*)
  → src/services/futebol-data.service.ts
  → src/hooks/use-futebol-data.ts (React Query)
  → src/pages/FutebolJogos.tsx + FutebolJogo.tsx
```

⚠️ **O FDW e as RPCs existem só no DEV** (aplicados via `execute_sql`, **NÃO** commitados como migration, de propósito — não podem vazar pra prod). Pra produção, depois: sync BQ→tabela nativa Supabase + RPCs repontadas (padrão NBA, migrations 055/057). O frontend lê o dev porque `.env.local` aponta pra `kpbjuplcwiyrymafhehz`.

## 2. Objetos criados no banco DEV (não versionados — recriar se resetar)

- `wrappers` ext (já instalada); FDW `bigquery_wrapper` (handler `extensions.big_query_fdw_handler`).
- Server `bigquery_server` OPTIONS(`sa_key_id '12e87cbd-1309-4d85-99a6-e2096a5aac20'`, `project_id 'smartbetting-dados'`, `dataset_id 'futebol'`). Chave SA reaproveitada do vault (secret `bigquery_wrapper_sa_key_id`; SA `smartbetting-dev@...`).
- `CREATE USER MAPPING FOR postgres ... OPTIONS (user 'public')`.
- Schema `bq_futebol` com foreign tables (todas `OPTIONS(table '<x>', location 'us-east1')`): `dim_leagues, dim_teams, fact_fixtures (+venue_name add column), fact_fixture_stats, fact_fixture_lineups, fact_fixture_lineups_players, fact_fixture_events`.
- RPCs `public`: `get_futebol_fixtures(p_competition, p_season, p_round)`, `get_futebol_fixture_detail(p_fixture_id)` (JSONB bundle), `get_futebol_standings(p_competition, p_season)` (classificação via UNION home/away — cast `sum()::bigint`), `get_futebol_team_profile(p_team_id, p_competition, p_season)` (JSONB: results+stats_avg por geral/casa/fora, via UNION + GROUPING SETS), helper `_futebol_team_form(...)`. GRANT EXECUTE a `authenticated, anon`.

## 3. Gotchas do FDW BigQuery (importantes — custaram tempo)

- **`to_jsonb(<foreign table cru>)` NÃO projeta colunas** → volta tudo NULL exceto as usadas em WHERE/ORDER. Use `jsonb_build_object(...)` explícito **ou** subquery derivada com colunas explícitas.
- **`OR` entre duas colunas zera o scan** (ex.: `home_team_id=X OR away_team_id=X` retorna ~nada). Troque por **`UNION ALL`** de dois ramos com igualdade. (Vale pra forma do time e H2H.)
- **Coluna reservada do BQ** (ex.: `current`) quebra o pushdown → evitar/omitir.
- **`execute_sql` roda em transação** → erro de um SELECT no lote dá rollback no DDL anterior. Aplicar ALTER/CREATE sozinhos.
- Dataset é **`futebol`** (não `apifootball_raw` como dizia o ClickUp), location **us-east1**.

## 4. Dados validados (2026-06-08)

Brasileirão 2024/2025 completos (380 jogos, 380 FT cada); 2026 em andamento (177 FT); Copa 2026 agendada (72 jogos). `fact_fixture_stats` = 2 linhas/jogo, **xG e posse 100% preenchidos** (xG existe, ao contrário do spec). Furo: 1 jogo do BR-2024 sem stats. `fact_fixture_events`: 960 gols (Normal/Pênalti/Contra + autor/assist/minuto), 1.972 cartões, subs, VAR.

## 5. Telas entregues

- **`FutebolJogos.tsx`** (`/futebol`, `/futebol/jogos`): paleta rebrand (claro). Pills de competição/temporada + **stepper de rodada** (abre na rodada mais próxima de hoje) + jogos **agrupados por dia**. ~10 jogos/rodada (não 380). Vencedor em negrito.
- **`FutebolJogo.tsx`** (`/futebol/jogo/:fixtureId`): Header + **slot "Sem oportunidade mapeada…"** (placeholder do bloco de oportunidade) + Tabs **Estatísticas** (barras forest×amber), **Forma & H2H**, **Escalação** (formação + titulares/banco).
- **`FutebolJogos.tsx`** agora tem segmento **Jogos | Tabela** — Tabela = classificação clicável (linha → tela Time).
- **`FutebolTime.tsx`** (`/futebol/time/:teamId?c=&s=`): perfil do time — Resultados (geral/casa/fora: V-E-D, médias gols, %Over2.5, %BTTS) + Médias por jogo (posse, finalizações, xG, escanteios, cartões).
- Rotas em `src/App.tsx`; entrada **FUTEBOL** em `src/components/AnalyticsNav.tsx` (desktop + mobile).
- **Conhecido (cosmético):** logos dos times (`media.api-sports.io`) dão 404 nesta sandbox (DNS bloqueado) → fallback de iniciais. Em navegador real o CDN público carrega. Se incomodar, proxiar via edge function.

### Paleta (rebrand / tema `theme-bolao`, definido em `src/index.css`)
Wrap a página em `theme-bolao` + `AnalyticsNav variant="rebrand"`. Tokens: `bg-canvas/canvas-2`, `text-ink/ink-2/ink-3`, `bg-forest/text-forest`, `text-amber/amber-2`, `border-line/line-2`, `text-status-success/danger/warning`, `rounded-rebrand-sm/md/lg`, `font-display`. Evitar `Card`/`Select` do shadcn cru (usam tokens do tema default escuro + Radix porta pro body fora do tema) — usei divs `bg-white border-line` e pills/stepper próprios.

## 6. Roadmap — o que dá pra fazer JÁ (zero ingestão, só das tabelas atuais)

Prioridade por valor/esforço:
1. ~~**Classificação do Brasileirão**~~ ✅ FEITO (RPC `get_futebol_standings` + segmento Tabela).
2. ~~**Perfil/médias do time**~~ ✅ FEITO (RPC `get_futebol_team_profile` + tela `FutebolTime`).
3. ~~**Timeline de lances**~~ ✅ FEITO (events no bundle `get_futebol_fixture_detail` + aba "Lances" no detalhe: gols+autor+assist, cartões, subs Entra/Sai, VAR).
4. ~~**Taxas de mercado no confronto**~~ ✅ FEITO (RPC `get_futebol_matchup_markets` + card "Tendências · temporada" no detalhe do Jogo: %Over2.5, %BTTS, médias de gols feitos/sofridos dos 2 times, com disclaimer descritivo).
5. **xG over/under-performance** (gols reais vs xG) — `fact_fixture_stats`.
6. **Artilheiros / líderes de cartões** — `fact_fixture_events + dim_players`.

Telas que habilita: enriquecer **Jogo**; nova tela **Time** (perfil); **Home** com tabela + próximos + artilheiros.

## 7. Bloqueado (precisa de ingestão nova ou do modelo)

- **Odds/EV/CLV** (subtask 13), **predictions** (14), **lesões** (12) — não estão no dataset `futebol`.
- **Stats por jogador por jogo** (`fact_fixture_player_stats`, subtask 8) — **não foi montada**; analytics de jogador hoje = só gols/cartões/quem jogou.
- **Score de Confiabilidade / Oportunidades / Análise mastigada** — dependem do modelo proprietário (Poisson/devigged/CLV), que não existe.

## 8. Como retomar

1. Garantir o FDW no dev (seção 2) — se o banco resetou, recriar server + foreign tables + RPCs.
2. `npm run dev` → http://localhost:8080/futebol/jogos (env já aponta pro dev).
3. Próximo passo recomendado: **classificação + perfil/médias do time** (item 6.1/6.2).
