# Futebol (Value Bet) — Runbook de deploy para PRODUÇÃO

> ⚠️ **LEIA ANTES DE MERGEAR.** O frontend deste módulo chama RPCs `get_futebol_*` que **não existem em produção**. Todo o backend de futebol foi construído **apenas no projeto DEV** (`kpbjuplcwiyrymafhehz`) via `execute_sql` — **nunca** como migration. Se a `main` for pra prod **sem** provisionar o backend abaixo, **o módulo Futebol inteiro fica quebrado** (telas carregam, mas toda chamada de dado falha).
>
> Este deploy **NÃO está em `supabase/migrations/`** de propósito: ele depende de um **FDW para o BigQuery** (extensão `wrappers` + chave de service account no Vault) que não existe em prod. Se virasse migration automática, o pipeline de migrations de prod quebraria. **É um deploy manual e gated.**

Projetos: **dev** = `kpbjuplcwiyrymafhehz` · **prod** = `lavclmlvvfzkblrstojd` (nunca tocado via MCP até aqui).

---

## 1. Pré-requisitos (bloqueadores reais)

O módulo lê os dados do **BigQuery** (`smartbetting-dados.futebol`, pipeline dbt do Mateus) através de um **Foreign Data Wrapper**. Antes de qualquer RPC funcionar em prod, é preciso:

1. **Extensão `wrappers`** (Supabase Wrappers) — versão usada no dev: `0.5.7`.
2. **Chave de service account do BigQuery** com acesso de leitura ao dataset `smartbetting-dados.futebol`, guardada no **Vault** de prod (NUNCA hardcoded em SQL/repo). No dev ela vive no Vault e sobreviveu às recriações do FDW.
3. **FDW server** `bigquery_server` (wrapper `bigquery_wrapper`) apontando pro projeto/dataset, `location = us-east1`.
4. **Pipeline do BigQuery ativo** — as tabelas-fonte (`fact_*`, `int_futebol_*`) precisam estar populadas lá. Isso é responsabilidade do Mateus (repo de engenharia de dados), independente deste PR.
5. **Extensão `pg_cron`** (pro sync agendado).

> Sem (1)–(4), nada de futebol funciona em prod. O passo de chave (2) exige um humano com o secret — não dá pra automatizar neste PR.

---

## 2. Inventário do que existe no DEV (e precisa ir pra prod)

Tudo no schema `bq_futebol` (foreign/leitura do BQ) e `futebol` (cópia materializada nativa que as RPCs leem).

### 2.1 FDW — schema `bq_futebol` (21 foreign tables, leitura ao vivo do BQ)
`OPTIONS (table '<nome>', location 'us-east1')` em cada uma.

- Dimensões: `dim_leagues`, `dim_teams`
- Fatos base: `fact_fixtures`, `fact_fixture_stats`, `fact_fixture_events`, `fact_fixture_lineups`, `fact_fixture_lineups_players`, `fact_fixture_player_stats`, `fact_h2h`, `fact_injuries_snapshot`, `fact_standings_snapshot`, `fact_team_season_stats`, `fact_odds_snapshot`, `fact_predictions_api`
- **Camada de valor:** `fact_value_opportunities`, `int_futebol_premissas_1x2`, `int_futebol_premissas_ou`, `int_futebol_premissas_ah`, `int_futebol_premissas_btts`, `int_futebol_odds_devig`
- Helper de introspecção: `_cols` (lê `INFORMATION_SCHEMA.COLUMNS` do dataset)

> ⚠️ **Limitação do FDW:** o wrapper **não lê `ARRAY<STRING>` do BigQuery**. As foreign tables das premissas/`fact_value_opportunities` são criadas **excluindo** as colunas array (`evidencias`, `avisos`). As evidências/avisos exibidas no app são **remontadas no SQL das RPCs** a partir dos booleanos das premissas (ver §4).

### 2.2 Schema `futebol` (20 tabelas nativas materializadas)
Espelho 1:1 das foreign tables acima (mesmas colunas, sem os arrays). São o que as RPCs realmente leem (rápido, sem ir ao BQ a cada request). Recriáveis com `CREATE TABLE futebol.<t> AS SELECT * FROM bq_futebol.<t>` (ver §5).

### 2.3 Procedure `futebol.sync_all()`
`TRUNCATE + INSERT SELECT *` de cada foreign → nativa (com `COMMIT` por tabela). É o que mantém a cópia nativa atualizada. Inclui as 6 tabelas da camada de valor.

### 2.4 Cron (`pg_cron`)
- `futebol-sync-daily` → **`0 * * * *`** (de hora em hora) → `CALL futebol.sync_all()`.
  - Era `0 9 * * *` (1×/dia); subimos pra horário porque odd de value bet muda intradiário.
- (existe também `ingest-wc-scores` `*/5 * * * *` — ingestão de placar ao vivo, fora do escopo deste schema; verificar separadamente se aplica em prod.)

### 2.5 RPCs (17, schema `public`, todas `SECURITY DEFINER`, `search_path=''`)
Consumidas pelo `src/services/futebol-data.service.ts`:

`get_futebol_fixtures`, `get_futebol_fixture_detail`, `get_futebol_fixture_extras`, `get_futebol_fixture_injuries`, `get_futebol_h2h`, `get_futebol_standings`, `get_futebol_standings_official`, `get_futebol_team_profile`, `get_futebol_team_season`, `get_futebol_teams`, `get_futebol_matchup_markets`, `get_futebol_leaders`, `get_futebol_fixture_odds`, `get_futebol_odds_board`, `get_futebol_fixture_prediction`, **`get_futebol_value_board`**, **`get_futebol_fixture_value`**.

As duas em **negrito** são o núcleo do value bet (board + detalhe) e estão com a definição completa e atual no `docs/futebol-prod-deploy.sql` deste PR. As outras 15 devem ser exportadas do dev (ver §3).

---

## 3. Exportar a DDL exata do DEV

Como o backend nunca virou migration, a fonte da verdade é o dev. Gere a DDL a partir dele (rodar no dev, aplicar no prod **depois** dos pré-requisitos):

```sql
-- Todas as RPCs de futebol (defs canônicas)
select string_agg(pg_get_functiondef(p.oid), E'\n\n') 
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'get_futebol%';

-- A procedure de sync
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='futebol' and p.proname='sync_all';

-- DDL das foreign tables (colunas + OPTIONS) — gera o CREATE FOREIGN TABLE
select c.relname,
  'create foreign table bq_futebol.'||c.relname||' ('||
   string_agg(a.attname||' '||format_type(a.atttypid,a.atttypmod), ', ' order by a.attnum)||
   ') server bigquery_server options ('||array_to_string(ft.ftoptions,', ')||');'
from pg_foreign_table ft
join pg_class c on c.oid=ft.ftrelid join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
where n.nspname='bq_futebol' group by c.relname, ft.ftoptions;
```

---

## 4. Ordem de aplicação em PROD

1. `create extension if not exists wrappers;` e `create extension if not exists pg_cron;`
2. Subir a **chave do BigQuery** no Vault de prod; criar o **FDW** (`bigquery_wrapper`) e o **server** `bigquery_server` (mesma config do dev, `location us-east1`, dataset `smartbetting-dados.futebol`).
3. `create schema bq_futebol; create schema futebol;`
4. Criar as **21 foreign tables** em `bq_futebol` (DDL do §3) — **sem** as colunas `ARRAY<STRING>`.
5. Criar as **20 tabelas nativas** em `futebol` via `CREATE TABLE futebol.<t> AS SELECT * FROM bq_futebol.<t>;` (cria + popula de uma vez).
6. Criar `futebol.sync_all()` e as **17 RPCs** (DDL do §3 + as 2 de valor do `.sql` deste PR). `grant execute ... to authenticated, anon;` em cada RPC.
7. Agendar o cron `futebol-sync-daily` (`0 * * * *` → `CALL futebol.sync_all()`).
8. Smoke test (ver §6).

---

## 5. Padrão pra novos mercados (referência)
Quando o Mateus subir um mercado novo no BQ (ex.: Dupla chance): criar a foreign table → `CREATE TABLE futebol.<t> AS SELECT *` → adicionar a tabela no array de `sync_all()` → estender as 2 RPCs de valor (join gateado por `market` + strings de evidência/contra) → `pickLabel`/`marketLabel` + chip no front. Mercados ativos hoje: **1X2, Gols (O/U), Handicap asiático, Ambos marcam (BTTS)**.

---

## 6. Smoke test em PROD (read-only)
```sql
select count(*) from futebol.fact_value_opportunities;          -- > 0
select market, count(*) from futebol.fact_value_opportunities group by 1;  -- 4 mercados
select * from get_futebol_value_board() limit 3;                 -- retorna linhas + evidencias[]
select * from get_futebol_fixture_value(<algum_fixture_id>) limit 5;
```
No app: `/futebol` (Home), `/futebol/oportunidades`, e um `/futebol/jogo/:id` — 0 erros de console, cards com score/evidências.

---

## 7. Notas
- **Dev-only até aqui:** todas as alterações de banco desta entrega foram via `execute_sql` no dev. Este runbook é o caminho para refletir em prod **de forma controlada**.
- **Segurança:** a chave do BigQuery **não** está neste repo e não deve ser commitada. Ela entra só via Vault no passo §4.2.
- **Custo/latência:** as RPCs leem a cópia **nativa** (`futebol.*`), não o BQ a cada request; o BQ só é tocado no `sync_all()` (1×/hora). Manter assim.
