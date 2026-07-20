# Futebol (Value Bet) — Runbook de deploy para PRODUÇÃO

> ✅ **PROD JÁ PROVISIONADO (verificado 2026-07-20 via inventário SQL no prod).** Schema `futebol` (22 tabelas incl. `_sync_state`), as 19 functions (md5 **idêntico** a dev e a este repo), colunas de trial no `users` e **sync horário ativo** (`workflow-futebol-sync-hourly` no Cloud Scheduler já grava no prod; dados com carga do próprio dia). O aviso antigo ("RPCs não existem em produção") está OBSOLETO. **Falta em prod somente:** os buckets `futebol-team-logos`/`futebol-player-photos` + deploy/execução das 2 edge functions de espelhamento (§6a) — sem eles as telas funcionam com fallback de iniciais. Pré-requisitos de dados (§1) também conferidos em 2026-07-19: 21 tabelas BASE TABLE no BQ, `dbt-futebol` e schedulers rodando, `SUPABASE_PG_URL_PRD` setada no Cloud Run.

> 🔄 **MUDANÇA DE ARQUITETURA (2026-06-30).** O futebol **deixou de usar o FDW BigQuery** (`wrappers`/`bq_futebol`/`futebol.sync_all()`/pg_cron) e passou a usar **o mesmo sync do NBA**: o serviço Cloud Run **`sync-bq-to-postgres`** lê os marts do BQ com `list_rows()` (grátis, sem scan) e faz `TRUNCATE + COPY` nas tabelas nativas de `futebol.*`. Não há mais chave do BigQuery no Vault, nem foreign tables, nem procedure, nem pg_cron de sync. Isso elimina o custo de scan recorrente do FDW. **Este deploy continua NÃO sendo migration** (de propósito, pra não acoplar o schema de produto ao CI), mas agora **não depende de nenhum segredo manual**.

Projetos Supabase: **dev** = `kpbjuplcwiyrymafhehz` · **prod** = `lavclmlvvfzkblrstojd`.

> ✅ **VERIFICADO CONTRA O DEV EM 2026-07-18** (inventário via SQL editor: md5 de `pg_get_functiondef` + shape das tabelas/índices): as **19 functions** e as **21 tabelas** do `.sql` estão **byte-idênticas** ao estado do dev — zero drift desde o snapshot de 30/06. Teardown do FDW confirmado no dev (`bq_futebol`, `bigquery_server` e `sync_all` removidos; só a extensão `wrappers` ficou instalada, sem uso). Deltas encontrados e já incorporados/pendentes:
> 1. **`futebol._sync_state`** (watermark do sync incremental) existia no dev e faltava no `.sql` → **adicionada** (§2a, `create if not exists`).
> 2. **Bucket `futebol-player-photos`** (público) existe no dev + helper `getFutebolPlayerPhotoUrl` no front → criar no prod e espelhar as fotos (§6a).
> 3. **Edge function `mirror-futebol-player-photos`** estava deployada no dev sem estar no repo (deploy direto) → **recuperada e commitada** (2026-07-18), com o gate `?token=` hardcoded do protótipo substituído pelo header `x-cron-secret`. ⚠️ A versão deployada no dev ainda é a antiga (aceita o token) até o próximo redeploy.

---

## 1. Pré-requisitos (do lado de dados — repo `data-engineering` / `analytics-engineering`)

1. **dbt do futebol** materializando as 21 tabelas em **`smartbetting-dados.futebol`** como **BASE TABLE** (as 5 que eram `view` — `int_futebol_premissas_ou/ah/btts/dc` e `fact_h2h` — foram convertidas para `table`, senão `list_rows()` não lê). Imagem `dbt-futebol` reconstruída + `gcloud run jobs update dbt-futebol`.
2. **Serviço Cloud Run `sync-bq-to-postgres`** deployado com o engine **sport-aware** (`?sport=futebol`). Sem novos segredos: usa os mesmos `SUPABASE_PG_URL_PRD`/`SUPABASE_PG_URL_DEV` (porta **5432**, sessão direta) do NBA.
3. **`SUPABASE_PG_URL_PRD`** apontando para o Supabase de prod (`lavclmlvvfzkblrstojd`).
4. **Workflow de futebol** com o passo de sync (`?sport=futebol`) após o job `dbt-futebol` (freshness ≥ horária, substitui o pg_cron antigo).

> Não há mais passo de "subir chave do BigQuery no Vault". O BQ é tocado só pelo Cloud Run sync (que roda com a SA `ExtractScripts@`, já com leitura no BQ).

---

## 2. O que o `docs/futebol-prod-deploy.sql` cria

Schema **`futebol`** (RPC-only, igual ao `nba_mart`):

- **21 tabelas nativas** (espelho **escalar** dos marts BQ `smartbetting-dados.futebol`): `dim_leagues, dim_teams, fact_fixtures, fact_fixture_stats, fact_fixture_events, fact_fixture_lineups, fact_fixture_lineups_players, fact_fixture_player_stats, fact_h2h, fact_injuries_snapshot, fact_standings_snapshot, fact_team_season_stats, fact_odds_snapshot, fact_predictions_api, int_futebol_odds_devig, int_futebol_premissas_1x2, int_futebol_premissas_ou, int_futebol_premissas_ah, int_futebol_premissas_btts, int_futebol_premissas_dc, fact_value_opportunities`. Colunas `ARRAY<STRING>` (`evidencias`/`avisos`) e `RECORD` (`coverage`) **não** são materializadas — o sync as pula e as RPCs **remontam** evidências/avisos a partir dos booleans das `int_futebol_premissas_*`.
- **Índices** das RPCs (1 por tabela, +1 composto em odds/fixtures/standings).
- **Helper** `public._futebol_team_form(...)` (SECURITY DEFINER).
- **18 RPCs** `public.get_futebol_*` (SECURITY DEFINER, `search_path=''`, lendo `futebol.*`) + grants `anon`/`authenticated`/`service_role`.
- **Reverse trial:** colunas `futebol_trial_started_at` e `futebol_subscription_status` em `public.users` + `get_futebol_access()`.

O `.sql` é **drop+create** nas tabelas (shape determinístico) — os **dados vêm do Cloud Run sync**, não do arquivo. As funções usam `set check_function_bodies = off` (ordem-robusto) e o arquivo roda atômico (uma transação).

---

## 3. Ordem de aplicação

### DEV (cutover do FDW → sync) — já feito nesta entrega
1. `select cron.unschedule('futebol-sync-daily');` (para o `sync_all()` antigo).
2. Aplicar `docs/futebol-prod-deploy.sql` (cria schema/tabelas/índices/helper/RPCs/grants).
3. Rodar o sync e validar (§4).
4. Rodar a seção **§TEARDOWN** do `.sql` (descomentada) p/ remover `bq_futebol`/`bigquery_server`/`sync_all`/`wrappers`.

### PROD (greenfield — nunca houve futebol em prod)
1. Garantir os pré-requisitos da §1 (sync deployado, `SUPABASE_PG_URL_PRD` setado).
2. Aplicar `docs/futebol-prod-deploy.sql` no prod (`lavclmlvvfzkblrstojd`). O §TEARDOWN **não se aplica** (nunca houve FDW de futebol em prod) — manter comentado.
3. Popular: disparar o sync — `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" "https://sync-bq-to-postgres-<hash>-ue.a.run.app?sport=futebol&env=prd"` — ou esperar o workflow de futebol rodar o Phase-3.
4. Smoke test (§5).

---

## 4. Validar o sync (dev/prd)
```bash
# local (venv do data-engineering): roda o sync direto
SYNC_SPORT=futebol SYNC_ENV=dev .venv/bin/python3 scripts/sync_bq_to_postgres.py
```
- O pre-flight de **parity** aborta antes de qualquer TRUNCATE se BQ e PG divergirem.
- Comparar `COUNT(*)` BQ `smartbetting-dados.futebol.<t>` vs Supabase `futebol.<t>` por tabela.

## 5. Smoke test (read-only)
```sql
select count(*) from futebol.fact_value_opportunities;                 -- > 0
select market, count(*) from futebol.fact_value_opportunities group by 1;  -- até 5 mercados
select * from public.get_futebol_value_board() limit 3;                -- linhas + evidencias[]
select * from public.get_futebol_fixture_value(<fixture_id>) limit 5;
select * from public.get_futebol_standings_official('brasileirao', 2026) limit 5;
```
No app: `/futebol`, `/futebol/oportunidades`, `/futebol/jogos`, `/futebol/jogo/:id`, `/futebol/time/:id` — 0 erros de console, reverse trial/blur ok.

---

## 6a. Storage + espelhamento de imagens (hotlink protection da api-sports)

No ambiente alvo (prod), depois do `.sql`:

1. Criar buckets **públicos**: `futebol-team-logos` e `futebol-player-photos`.
2. Deployar `mirror-futebol-team-logos` e `mirror-futebol-player-photos` (ambas no repo) com `verify_jwt=false`.
3. Rodar 1x cada com o header `x-cron-secret: $CRON_SECRET` (idempotentes, upsert). Re-rodar quando entrarem times/jogadores novos — não há cron agendado (nem no dev).

## 6. Notas
- **Custo/latência:** as RPCs leem `futebol.*` nativo (não o BQ). O BQ é tocado só pelo Cloud Run sync (`list_rows`, grátis) — sem o scan recorrente que o FDW cobrava.
- **Novos mercados:** quando subir um mercado novo no BQ → adicionar a tabela em `FUTEBOL_SYNC_TABLES_ORDERED` (`data-engineering/src/config.py`) + criar a tabela nativa no `.sql` + estender as 2 RPCs de valor (join por `market` + strings de evidência) + chip no front. Mercados hoje: **1X2, Gols (O/U), Handicap, BTTS, Dupla chance**.
- **Drift de schema:** o `.sql` é espelho **exato** do BQ (menos colunas complexas). Se o Mateus mudar colunas no BQ, o parity check do sync aborta — realinhar o `.sql`.
