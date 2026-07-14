-- Métricas de retenção — Smart Betting (projeto prod "Smart Betting", ref lavclmlvvfzkblrstojd)
-- Todas read-only. Ver docs/plano-metricas-retencao.md. Colunas validadas contra o schema em 2026-07-08.

-- ─────────────────────────────────────────────────────────────────────────────
-- E2 / B1 — Liquidação POR COORTE DE NOVOS (1ª aposta liquidada em <=7 dias),
-- por semana de entrada do usuário. NÃO usar taxa agregada (viés de sobrevivência).
-- ─────────────────────────────────────────────────────────────────────────────
with primeira_aposta as (
  select user_id,
         min(created_at)                                   as entrada,
         (array_agg(status     order by created_at))[1]    as status_1a,
         (array_agg(updated_at order by created_at))[1]    as updated_1a,
         (array_agg(created_at order by created_at))[1]    as created_1a
  from public.bets
  group by user_id
)
select date_trunc('week', entrada)::date as semana_entrada,
       count(*)                          as novos,
       count(*) filter (where status_1a <> 'pending'
         and updated_1a <= created_1a + interval '7 days') as liquidaram_1a_7d,
       round(100.0 * count(*) filter (where status_1a <> 'pending'
         and updated_1a <= created_1a + interval '7 days') / count(*), 1) as pct
from primeira_aposta
group by 1 order by 1 desc;

-- ─────────────────────────────────────────────────────────────────────────────
-- Retrato de viés de sobrevivência — liquidação por intensidade de uso.
-- Explica por que a taxa agregada engana (poucos power users liquidam ~tudo).
-- ─────────────────────────────────────────────────────────────────────────────
with u as (
  select user_id,
         count(*)                                   as total,
         count(*) filter (where status <> 'pending') as settled
  from public.bets
  group by user_id
)
select case when total >= 50 then 'd) 50+'
            when total >= 10 then 'c) 10-49'
            when total >= 2  then 'b) 2-9'
            else 'a) 1' end            as perfil,
       count(*)                        as usuarios,
       sum(total)                      as apostas,
       round(100.0 * sum(settled) / sum(total), 1) as pct_liquidada
from u
group by 1 order by 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- E1 — North Star: usuários com >=1 aposta liquidada na semana, por canal.
-- ─────────────────────────────────────────────────────────────────────────────
select date_trunc('week', updated_at)::date        as semana,
       coalesce(channel, '(legado)')               as canal,
       count(distinct user_id)                     as usuarios_ns
from public.bets
where status in ('won', 'lost', 'void', 'half_won', 'half_lost', 'cashout')
group by 1, 2 order by 1 desc;

-- ─────────────────────────────────────────────────────────────────────────────
-- Base ativa — o gargalo real. Tamanho e concentração.
-- ─────────────────────────────────────────────────────────────────────────────
select count(distinct user_id)                                                            as usuarios_total,
       count(distinct user_id) filter (where created_at > now() - interval '30 days')     as ativos_30d,
       count(distinct user_id) filter (where created_at > now() - interval '90 days')     as ativos_90d,
       count(*)                                                                           as apostas_total,
       round(count(*)::numeric / nullif(count(distinct user_id), 0), 1)                   as apostas_por_usuario
from public.bets;
