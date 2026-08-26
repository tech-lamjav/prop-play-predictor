-- 20260826103000_108_futebol_motivos_gols
-- Contrato de motivos para a tela: o backend escolhe o lado e o front apenas renderiza.
create or replace function public.get_futebol_fixture_reason_contract(p_fixture_id bigint)
returns table(
  market text,
  outcome text,
  line_value double precision,
  score integer,
  componentes_score jsonb,
  favor jsonb,
  contra jsonb
)
language sql
stable
security definer
set search_path to ''
as $function$
  with base as (
    select
      v.market, v.outcome, v.line_value, v.score, v.pts_valor, v.pts_premissas,
      v.pts_corroboracao, v.penalidades as penalidades_score,
      v.modelo_api_concorda, v.linha_sharp_confirma, v.avisos,
      p.acesas, p.apagadas, p.penalidades as penalidades_ativas,
      case v.outcome
        when 'Over' then array[
          'defesas_vazaveis', 'ataque_combinado', 'xg_combinado_alto',
          'ambos_vazam', 'ritmo_alto', 'historico_over', 'linha_subindo'
        ]::text[]
        when 'Under' then array[
          'defesas_firmes', 'xg_baixo_combinado', 'clean_sheets_altos',
          'ataques_fracos', 'historico_under', 'linha_descendo'
        ]::text[]
        else array[]::text[]
      end as aplicaveis
    from public.get_futebol_fixture_value(p_fixture_id) v
    join public.get_futebol_fixture_premissas(p_fixture_id) p
      on p.market = v.market
     and p.outcome = v.outcome
     and p.line_value is not distinct from v.line_value
    where v.market = 'goals_over_under'
  )
  select
    b.market,
    b.outcome,
    b.line_value,
    b.score,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'texto', texto, 'pontos', pontos) order by ordem)
      from (values
        (1, 'premissas', 'Premissas', b.pts_premissas),
        (2, 'valor_de_mercado', 'Valor de mercado', b.pts_valor),
        (3, 'corroboracao', 'Corroboração', b.pts_corroboracao),
        (4, 'penalidades', 'Penalidades', b.penalidades_score)
      ) as componente(ordem, id, texto, pontos)
      where pontos <> 0
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'premissa') order by slug)
      from unnest(b.acesas) slug
      where slug = any(b.aplicaveis) and b.pts_premissas > 0
    ), '[]'::jsonb)
    || case when b.pts_valor > 0
      then jsonb_build_array(jsonb_build_object(
        'id', 'valor_de_mercado', 'tipo', 'componente_score',
        'texto', 'A cotação oferece valor', 'pontos', b.pts_valor
      ))
      else '[]'::jsonb end
    || case when b.pts_corroboracao > 0
      then jsonb_build_array(jsonb_build_object(
        'id', 'corroboracao', 'tipo', 'componente_score', 'pontos', b.pts_corroboracao,
        'texto', case
          when b.modelo_api_concorda and b.linha_sharp_confirma then 'Modelo e movimento de mercado confirmam a leitura'
          when b.modelo_api_concorda then 'Modelo confirma a leitura'
          when b.linha_sharp_confirma then 'Movimento de mercado confirma a leitura'
          else 'Corroboração confirma a leitura'
        end
      ))
      else '[]'::jsonb end,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'premissa') order by slug)
      from unnest(b.apagadas) slug
      where slug = any(b.aplicaveis)
    ), '[]'::jsonb)
    || coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'penalidade') order by slug)
      from unnest(b.penalidades_ativas) slug
    ), '[]'::jsonb)
    || coalesce((
      select jsonb_agg(jsonb_build_object('id', 'aviso_' || ord, 'tipo', 'penalidade', 'texto', texto) order by ord)
      from unnest(b.avisos) with ordinality as a(texto, ord)
    ), '[]'::jsonb)
  from base b;
$function$;

grant execute on function public.get_futebol_fixture_reason_contract(bigint) to anon, authenticated, service_role;
