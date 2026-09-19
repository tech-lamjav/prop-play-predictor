-- 20260919120000_161_futebol_premissas_com_indice
--
-- Três das cinco tabelas de premissas não tinham índice NENHUM.
--
-- Todas as RPCs de valor — `get_futebol_value_board`, `get_futebol_value_history`
-- e `get_futebol_fixture_value` — montam a lista de evidências com os mesmos
-- cinco `left join`, um por mercado, sempre por `(fixture_id, outcome)` e, onde
-- o mercado tem linha, também por `line_value`. Duas dessas tabelas ganharam
-- índice no DDL do schema (1x2 e over/under) e três ficaram de fora.
--
-- Medido no dev em 19/09/2026, no plano da `get_futebol_value_history` com a
-- janela de 30 dias que a home pedia:
--
--   Seq Scan on int_futebol_premissas_ah ... rows=109878 (actual time=... 1033 ms)
--
-- Um segundo inteiro varrendo 14 MB para achar, no máximo, uma linha por
-- oportunidade. A `_ou` não aparecia no plano como varredura porque ela TEM o
-- índice equivalente, e é a maior das cinco — o que mostra que a diferença é o
-- índice, e não o tamanho da tabela.
--
-- As colunas de cada índice espelham exatamente a condição de join da RPC:
--   · ah   → fixture_id, outcome, line_value   (igual à `_ou`)
--   · btts → fixture_id, outcome               (igual à `_1x2`)
--   · dc   → fixture_id, outcome               (igual à `_1x2`)
--
-- ⚠️ O `line_value` entra no join por `is not distinct from`, e não por `=`,
-- porque a linha pode ser nula. O índice continua servindo: o Postgres usa o
-- prefixo `(fixture_id, outcome)` para chegar às poucas linhas do jogo e
-- resolve a comparação nulo-segura ali, em vez de varrer a tabela inteira.
--
-- ⚠️ Estas tabelas são do schema `futebol`, que o repositório NÃO cria por
-- migration (ver docs/futebol-prod-deploy.sql). Por isso o `if not exists` em
-- cada um e o `to_regclass` em volta: num ambiente onde a tabela ainda não
-- existe, esta migration não pode falhar o deploy inteiro. É a mesma escolha da
-- 102, que criou o `fact_fixtures_kickoff_utc_idx` por aqui.
--
-- O DDL manual foi atualizado junto, para seguir sendo espelho do que existe.
--
-- Conferência depois de aplicar:
--   select tablename, indexname from pg_indexes
--    where schemaname = 'futebol' and tablename like 'int_futebol_premissas%'
--    order by tablename;
--   -- espera-se uma linha para cada uma das cinco tabelas.

do $$
begin
  if to_regclass('futebol.int_futebol_premissas_ah') is not null then
    create index if not exists int_futebol_premissas_ah_fixture_id_outcome_line_value_idx
      on futebol.int_futebol_premissas_ah using btree (fixture_id, outcome, line_value);
  end if;

  if to_regclass('futebol.int_futebol_premissas_btts') is not null then
    create index if not exists int_futebol_premissas_btts_fixture_id_outcome_idx
      on futebol.int_futebol_premissas_btts using btree (fixture_id, outcome);
  end if;

  if to_regclass('futebol.int_futebol_premissas_dc') is not null then
    create index if not exists int_futebol_premissas_dc_fixture_id_outcome_idx
      on futebol.int_futebol_premissas_dc using btree (fixture_id, outcome);
  end if;
end $$;
