# Módulo Futebol (value bet) — status de implementação e roadmap

> **Branch:** `feat/futebol-value-bet` (criada a partir de `origin/main`).
> **Natureza:** protótipo **dev-only**. Dados **materializados** no Postgres (schema `futebol`), sincronizados do BigQuery por job agendado (padrão NBA). Nada disto vai pra prod ainda.
> **Atualizado:** 2026-06-15. Direção de produto: `docs/futebol-direcao-produto.md`.

## 1. Arquitetura atual (protótipo) — MATERIALIZADA (2026-06-15)

```
BigQuery smartbetting-dados.futebol (dataset, location us-east1)
  → FDW (schema bq_futebol no Supabase DEV) — usado SÓ como fonte do sync
  → futebol.sync_all() (procedure) copia BQ → tabelas NATIVAS no schema `futebol`
     [pg_cron job 'futebol-sync-daily' às 09:00 UTC]
  → RPCs public.get_futebol_* (SECURITY DEFINER) leem `futebol.*` (Postgres local)
  → src/services/futebol-data.service.ts
  → src/hooks/use-futebol-data.ts (React Query)
  → src/pages/FutebolJogos.tsx + FutebolJogo.tsx + FutebolHome.tsx + FutebolTime.tsx
```

**Por que materializou:** ler o BQ ao vivo via FDW custava **1–6s por RPC** (a tela de detalhe fazia 7 → ~6,3s de relógio de parede). Cada chamada FDW = um job no BigQuery (round-trip + scan). Copiando pra tabelas nativas, as RPCs leem Postgres local: **detalhe caiu de ~6,3s → ~620ms** (piso ≈ latência de rede pro dev remoto). Mesmo conceito do `sync-bq-to-postgres` da NBA.

⚠️ **Tudo isto existe só no DEV** (aplicado via `execute_sql`, **NÃO** commitado como migration, de propósito). O frontend lê o dev porque `.env.local` aponta pra `kpbjuplcwiyrymafhehz`. Pra prod: replicar schema `futebol` + `sync_all` + cron como migrations (e o sync rodar contra o BQ a partir do projeto de prod).

## 2. Objetos criados no banco DEV (não versionados — recriar se resetar)

- `wrappers` ext (já instalada); FDW `bigquery_wrapper` (handler `extensions.big_query_fdw_handler`).
- Server `bigquery_server` OPTIONS(`sa_key_id '12e87cbd-1309-4d85-99a6-e2096a5aac20'`, `project_id 'smartbetting-dados'`, `dataset_id 'futebol'`). Chave SA reaproveitada do vault (secret `bigquery_wrapper_sa_key_id`; SA `smartbetting-dev@...`).
- `CREATE USER MAPPING FOR postgres ... OPTIONS (user 'public')`.
- Schema `bq_futebol` com foreign tables (todas `OPTIONS(table '<x>', location 'us-east1')`): `dim_leagues, dim_teams, fact_fixtures (+venue_name), fact_fixture_stats, fact_fixture_lineups, fact_fixture_lineups_players, fact_fixture_events, fact_fixture_player_stats, fact_h2h, fact_injuries_snapshot, fact_standings_snapshot, fact_team_season_stats`. **Hoje servem só de fonte pro sync** (as RPCs não leem mais o FDW direto).
- **Schema `futebol` (NATIVO) — onde as RPCs leem.** 12 tabelas espelho das de `bq_futebol`, criadas via `CREATE TABLE futebol.x AS SELECT * FROM bq_futebol.x` + índices nas colunas de filtro (`fixture_id`, `team_id`, `(competition,season,round)`, `(competition,season,snapshot_date)`, `h2h_pair_key`, etc.).
- **`futebol.sync_all()` (PROCEDURE, SECURITY DEFINER):** `truncate + insert ... select` de cada tabela com `commit` por tabela. Agendada por **pg_cron** (`futebol-sync-daily`, `0 9 * * *`). Refresh manual: `CALL futebol.sync_all();`.
- RPCs `public` (todas leem `futebol.*`): `get_futebol_fixtures`, `get_futebol_fixture_detail` (core JSONB), `get_futebol_fixture_extras`, `get_futebol_fixture_injuries`, `get_futebol_h2h`, `get_futebol_standings_official`, `get_futebol_team_profile`, `get_futebol_team_season`, `get_futebol_matchup_markets`, `get_futebol_leaders`, `get_futebol_teams`, helper `_futebol_team_form`. GRANT EXECUTE a `authenticated, anon`. (As RPCs mantêm os workarounds da época do FDW — UNION ALL no lugar de OR, etc. — inofensivos em tabela nativa.)

## 3. Gotchas do FDW BigQuery (importantes — custaram tempo)

- **`to_jsonb(<foreign table cru>)` NÃO projeta colunas** → volta tudo NULL exceto as usadas em WHERE/ORDER. Use `jsonb_build_object(...)` explícito **ou** subquery derivada com colunas explícitas.
- **`OR` entre duas colunas zera o scan** (ex.: `home_team_id=X OR away_team_id=X` retorna ~nada). Troque por **`UNION ALL`** de dois ramos com igualdade. (Vale pra forma do time e H2H.)
- **Coluna reservada do BQ** (ex.: `current`) quebra o pushdown → evitar/omitir.
- **`execute_sql` roda em transação** → erro de um SELECT no lote dá rollback no DDL anterior. Aplicar ALTER/CREATE sozinhos.
- Dataset é **`futebol`** (não `apifootball_raw` como dizia o ClickUp), location **us-east1**.
- **Latência: RESOLVIDA pela materialização (2026-06-15).** Os gotchas abaixo só importam pra quem for editar o **sync** ou criar nova foreign table — as RPCs já leem Postgres local. Histórico: o detalhe fazia 7 RPCs FDW (~6,3s) e estourava o `statement_timeout`; chegou a ser dividido em core/extras paralelas (~1,5s percebido). Agora, lendo `futebol.*` nativo, o detalhe todo carrega em **~620ms** (3 RPCs de bundle ~620ms + as leves no piso de rede ~200ms). Timeout dev em 15s mantido como folga (`ALTER ROLE ... statement_timeout` + `NOTIFY pgrst, 'reload config'`).

## 4. Dados validados (2026-06-08)

Brasileirão 2024/2025 completos (380 jogos, 380 FT cada); 2026 em andamento (177 FT); Copa 2026 agendada (72 jogos). `fact_fixture_stats` = 2 linhas/jogo, **xG e posse 100% preenchidos** (xG existe, ao contrário do spec). Furo: 1 jogo do BR-2024 sem stats. `fact_fixture_events`: 960 gols (Normal/Pênalti/Contra + autor/assist/minuto), 1.972 cartões, subs, VAR.

## 5. Telas entregues

- **`FutebolJogos.tsx`** (`/futebol`, `/futebol/jogos`): paleta rebrand (claro). Pills de competição/temporada + **stepper de rodada** (abre na rodada mais próxima de hoje) + jogos **agrupados por dia**. ~10 jogos/rodada (não 380). Vencedor em negrito.
- **`FutebolJogo.tsx`** (`/futebol/jogo/:fixtureId`): Header + **slot "Sem oportunidade mapeada…"** (placeholder do bloco de oportunidade) + Tabs **Estatísticas** (barras forest×amber), **Forma & H2H**, **Escalação** (formação + titulares/banco).
- **`FutebolJogos.tsx`** agora tem segmento **Jogos | Tabela** — Tabela = classificação clicável (linha → tela Time).
- **`FutebolTime.tsx`** (`/futebol/time/:teamId?c=&s=`): perfil do time — Resultados (geral/casa/fora: V-E-D, médias gols, %Over2.5, %BTTS) + Médias por jogo (posse, finalizações, xG, escanteios, cartões).
- **`FutebolHome.tsx`** (`/futebol`): home/resumo do Brasileirão 2026 — próximos jogos (só kickoff ≥ hoje), top-6 da classificação e top-5 artilheiros, com deep-links (`?view=tabela`/`artilheiros`). É o ponto de entrada do módulo (nav "Futebol" → `/futebol`).
- Rotas em `src/App.tsx`; entrada **FUTEBOL** em `src/components/AnalyticsNav.tsx` (desktop + mobile) aponta pra `/futebol`.
- **Logos dos times (RESOLVIDO):** a api-sports tem hotlink protection (`<img>` direto falha no navegador). Espelhados pro nosso Storage (mesmo padrão do `mirror-wc-photos`):
  - bucket público **`futebol-team-logos`** + RPC **`get_futebol_teams()`** (lê `bq_futebol.dim_teams`) — criados no DEV (não-migration).
  - edge function **`supabase/functions/mirror-futebol-team-logos`** (deploy DEV, `verify_jwt=false`): baixa cada logo da api-sports → sobe `{team_id}.png` no bucket. Rodada 1x via `pg_net` (75/75 espelhados).
  - helper **`src/utils/futebol-logos.ts`** `getFutebolTeamLogoUrl(teamId)` → URL do Storage; os `Crest` usam ela com fallback pras iniciais.
  - **Pra prod:** criar bucket + `get_futebol_teams` + deploy da function + rodar 1x (ou cron) no ambiente alvo. Re-rodar quando entrarem times novos.

### Paleta (rebrand / tema `theme-bolao`, definido em `src/index.css`)
Wrap a página em `theme-bolao` + `AnalyticsNav variant="rebrand"`. Tokens: `bg-canvas/canvas-2`, `text-ink/ink-2/ink-3`, `bg-forest/text-forest`, `text-amber/amber-2`, `border-line/line-2`, `text-status-success/danger/warning`, `rounded-rebrand-sm/md/lg`, `font-display`. Evitar `Card`/`Select` do shadcn cru (usam tokens do tema default escuro + Radix porta pro body fora do tema) — usei divs `bg-white border-line` e pills/stepper próprios.

## 6. Roadmap — o que dá pra fazer JÁ (zero ingestão, só das tabelas atuais)

Prioridade por valor/esforço:
1. ~~**Classificação do Brasileirão**~~ ✅ FEITO (RPC `get_futebol_standings` + segmento Tabela).
2. ~~**Perfil/médias do time**~~ ✅ FEITO (RPC `get_futebol_team_profile` + tela `FutebolTime`).
3. ~~**Timeline de lances**~~ ✅ FEITO (events no bundle `get_futebol_fixture_detail` + aba "Lances" no detalhe: gols+autor+assist, cartões, subs Entra/Sai, VAR).
4. ~~**Taxas de mercado no confronto**~~ ✅ FEITO (RPC `get_futebol_matchup_markets` + card "Tendências · temporada" no detalhe do Jogo: %Over2.5, %BTTS, médias de gols feitos/sofridos dos 2 times, com disclaimer descritivo).
5. ~~**xG over/under-performance**~~ ✅ FEITO (`avg_xg_against` no `get_futebol_team_profile` via CTE de total de xG por jogo + card "Eficiência · gols × xG" no perfil do Time: feitos×xG e sofridos×xG com Δ, por geral/casa/fora). **Nota FDW:** self-join com `<>` quebra; usar CTE agregada + join por igualdade de `fixture_id`.
6. ~~**Artilheiros / líderes de cartões**~~ ✅ FEITO (RPC `get_futebol_leaders` + segmento "Artilheiros" na tela Jogos: ranking de gols + cartões amarelos/vermelhos).
7. ~~**Classificação oficial + zonas**~~ ✅ FEITO (tabelas 9/10 do dev). `fact_standings_snapshot` → RPC `get_futebol_standings_official` (último snapshot via `max(snapshot_date)` em variável; rank/pontos/SG oficiais + `rank_description`). `StandingsTable` (Jogos) e mini-tabela (Home) com **faixa de zona colorida** (Libertadores=forest / Sul-Americana=info / Rebaixamento=danger; helper `futebolZone` + `FUTEBOL_ZONE_COLOR` no service). Substituiu a classificação computada.
8. ~~**Raio-X da temporada no Time**~~ ✅ FEITO. `fact_team_season_stats` → RPC `get_futebol_team_season` (jsonb) + card "Raio-X" em `FutebolTime`: forma, clean sheets/% , não marcou/%, médias gols casa×fora, V-E-D casa/fora, sequências, pênaltis (% conv.). **Caveat:** `fact_standings_snapshot.form` veio NULL (a forma boa está no team_season_stats — avisar o dev).
9. ~~**H2H oficial**~~ ✅ FEITO (tabela 11 do dev: `fact_h2h`, `pair_key = least(a,b)-greatest(a,b)`). RPC `get_futebol_h2h(home,away)` (filtro por pair_key — sem OR; histórico completo cross-temporada/competição + winner). Bloco "Confrontos diretos" no Jogo: resumo agregado (V mandante × empates × V visitante, barra) + lista. Removido o h2h computado do bundle `extras` (mais leve).
10. ~~**Desfalques (lesões/suspensões)**~~ ✅ FEITO (tabela 12 do dev: `fact_injuries_snapshot`, por fixture). RPC `get_futebol_fixture_injuries(fixture_id)` (dedup por player via distinct on). Bloco "Desfalques" na aba Escalação do Jogo: por time, badge Fora/Dúvida (`injury_type`) + motivo traduzido (`injury_reason`: Poupado/Suspenso/Lesão/…).
12. ~~**Mercado & Valor — odds reais (value bet de verdade)**~~ ✅ FEITO (tabela 13 do dev: `fact_odds_snapshot`, 14 casas × 8 mercados × janelas `t24h`/`t1h`). **Coração do produto.** Materializada em `futebol.fact_odds_snapshot` (+ `sync_all`). RPC `get_futebol_fixture_odds(fixture_id)` agrega por mercado×resultado: odd Pinnacle, **melhor odd + casa**, nº casas, abertura/fechamento. Util `src/utils/futebol-value.ts` faz **devig** (Pinnacle âncora; consenso quando Pinnacle não cobre) → prob. justa → **edge = melhor_odd × justa − 1**. Card "Mercado & Valor" no topo do Jogo (Resultado, O/U 2,5, BTTS): headline do melhor valor, prob. justa, melhor odd+casa, selo +EV, movimento, banner honesto. **Schema real ≠ spec:** sem `handicap_value` (a linha vem em `outcome_label`, ex.: "Over 2.5"); foreign table só com colunas confirmadas (fixture_id, collection_window, bookmaker_name, market_name, outcome_label, odd_decimal). **Cobertura:** só 6 fixtures (jogos de Copa T-24h/T-1h); Brasileirão encerrado não tem odds. **Dupla Chance fora do devig** (outcomes se sobrepõem). **Guard:** a Leitura do Jogo (Poisson) é escondida quando `played_total < 5` (seleções de Copa sem season stats geravam "100%").
11. ~~**Leitura do Jogo — tendências por mercado**~~ ✅ FEITO (ponte para o Value Bet, **sem ingestão nova** — reusa `get_futebol_team_season` dos 2 times). Modelo de gols **Poisson** no front (`src/utils/futebol-tendencias.ts`): `λ_mandante = média(ataque casa, defesa do adversário fora)` e vice-versa → matriz de placar → probabilidades coerentes de **1X2, dupla chance, O/U 1,5 e 2,5, BTTS, clean sheet**, cada uma com **probabilidade + odd justa (1/p) + leitura em PT + força (Alta/Média/Baixa)**. Service `getMatchupTendencies` (2 `getTeamSeason` em paralelo) + hook `useFutebolMatchupTendencies`. Card "Leitura do Jogo" no topo do detalhe (headline do mercado mais confiante entre resultado/O2.5/BTTS, gols esperados, linhas por mercado, comparativo da temporada, **banner honesto**). **É o slot onde odds (13) e predictions (14) plugam** — hoje é estimativa descritiva, NÃO veredito de valor (sem edge/CLV até as odds chegarem).

13. ~~**Tela Oportunidades**~~ ✅ FEITO (`/futebol/oportunidades`, `FutebolOportunidades.tsx`). RPC `get_futebol_odds_board()` (mesma lógica do detalhe, board-wide: todos os jogos com odds + metadados/team_ids). Util `computeBoardOpportunities` (reusa `computeFixtureValue` por jogo) → lista de oportunidades com edge ≥ 0 ranqueada por valor, + lista de jogos monitorados (cobertura, ordenada por melhor edge). Card por oportunidade: jogo (brasões), competição, kickoff, mercado+resultado, melhor odd+casa, prob. justa, selo +EV. CTA verde "Oportunidades" no topo da Home. Banner honesto. Mercados: Resultado, O/U 2,5, BTTS (Dupla Chance fora).

14. ~~**Metodologia v2 (Score de Confiabilidade)**~~ ✅ FEITO. Ranquear por **edge cru** enganava (zebra Iraq +6,4% @15.75 era "hero"). `futebol-value.ts` agora calcula **Score 0–100** = Kelly (acionabilidade, pune longshot) × banda de odds (~1.4–4.0) × corroboração (melhor odd vs média; outlier de 1 casa = "linha suspeita") × âncora sharp (Pinnacle) × movimento. Stake = **½ Kelly**. Ranking/hero por score; abaixo da régua = "sem valor claro". Storytelling reescrito: mercado rotulado ("Vencedor (1X2)"), **sem casa de aposta** (direção do produto), "justa"→**"chance"** explicada, sem "N casas". Hero virou Argentina @1.50 (score 61); Iraq caiu da lista.
15. ~~**Onda B — expansão de mercados**~~ ✅ FEITO. RPCs (`get_futebol_fixture_odds`/`get_futebol_odds_board`) retornam **O/U em várias linhas (campo `line`)** + **Dupla Chance**; motor generalizado num builder único com devig por normalização: **soma-1** nas partições (1X2, O/U por linha [1,5/2,5/3,5], BTTS) e **soma-2** na Dupla Chance. Surgiram novas oportunidades (ex.: O/U 1,5/3,5). **Asian Handicap fica de fora** (linha de quarto = push/meia-vitória, risco de erro). Telas não mudaram (renderizam os mercados do motor).

Telas que habilita: enriquecer **Jogo**; nova tela **Time** (perfil); **Home** com tabela + próximos + artilheiros + CTA Oportunidades; **Oportunidades** (value board). Nav: **dropdown por produto** (NBA/Futebol/Betinho/Bolão), mobile acordeão.

## 7. Bloqueado (precisa de ingestão nova ou do modelo)

- ~~**Odds** (subtask 13)~~ ✅ **ENTREGUE E INTEGRADA** (ver item 12 do roadmap) — value bet real (devig vs Pinnacle + edge). Falta só ampliar cobertura (hoje 6 fixtures de Copa) e, no futuro, CLV com janela de fechamento real.
- **predictions** (14, baseline da própria API) e **orquestração** (15) — ainda backlog. Predictions vai calibrar/complementar nosso modelo. **lesões (12) já entregue** (item 10).
- ~~**Stats por jogador por jogo**~~ ✅ **JÁ EXISTE E VALIDADA** (subtask 8 entregue pelo dev, 2026-06-09): `bq_futebol.fact_fixture_player_stats` (45 cols: minutes, rating, shots, goals, assists, passes_total/key/accuracy, tackles, duels, dribbles, fouls, cartões, pênaltis). Brasileirão 24/25/26 (~45,8 linhas/jogo = elenco completo; rating/minutes só de quem jogou). Gols batem com os artilheiros (fact_fixture_events). **Quirk:** contadores (goals_total etc.) vêm NULL pra quem não fez (não 0) → usar coalesce/nulls last. **Destrava analytics de jogador** (perfil, melhores por nota, criadores).
- **Score de Confiabilidade / Oportunidades / Análise mastigada** — dependem do modelo proprietário (Poisson/devigged/CLV), que não existe.

## 8. Como retomar

1. Garantir o FDW no dev (seção 2) — se o banco resetou, recriar server + foreign tables + RPCs.
2. `npm run dev` → http://localhost:8080/futebol/jogos (env já aponta pro dev).
3. Próximo passo recomendado: **classificação + perfil/médias do time** (item 6.1/6.2).
