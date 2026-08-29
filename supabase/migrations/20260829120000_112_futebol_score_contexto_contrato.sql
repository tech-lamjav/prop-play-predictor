-- 20260829120000_112_futebol_score_contexto_contrato
--
-- Virada coordenada para o Score de contexto (spec #301, entrega #304).
--
-- O Score deixa de somar preço, corroboração e penalidades de odd: ele passa a
-- expressar SÓ quanto do contexto favorável está presente na linha. O preço
-- continua publicado como informação (edge, odd, casas) e continua sendo porta
-- de segurança nas faixas por mercado, mas não compõe a nota nem destrava a
-- publicação.
--
-- ⚠️ NÃO APLICAR ISOLADAMENTE EM PRODUÇÃO. Esta migration é metade de uma virada
-- combinada com analytics-engineering#109, que troca o mart e o sync. A ordem
-- documentada é: migration → mart → sync manual → smoke test → reabertura. Até
-- o mart publicar contexto_v1, as RPCs devolvem score_versao = 'legacy' e a
-- nota continua na escala antiga.
--
-- Por que DROP e CREATE em vez de CREATE OR REPLACE: o retorno tabular muda nas
-- três RPCs, e o Postgres recusa `create or replace` que altere o RETURNS TABLE
-- ("cannot change return type of existing function"). As quatro caem e sobem
-- juntas, na ordem de dependência, porque get_futebol_fixture_reason_contract
-- consome get_futebol_fixture_value.

-- ── 1. score_versao no mart ─────────────────────────────────────────────────
-- Obrigatório e sem nulo (decisão da spec). O default 'legacy' carimba o que já
-- está gravado: no board ele é substituído no primeiro full-refresh do mart
-- novo; no snapshot ele fica para sempre, que é justamente o ponto — histórico
-- é point-in-time e não se recalcula.
alter table futebol.fact_value_opportunities
  add column if not exists score_versao text not null default 'legacy';

alter table futebol.fact_value_opportunities_hist
  add column if not exists score_versao text not null default 'legacy';

comment on column futebol.fact_value_opportunities.score_versao is
  'Escala em que o Score foi calculado: legacy (soma com preço) ou contexto_v1 (só contexto, 0-100). Técnico, nunca exibido ao usuário.';
comment on column futebol.fact_value_opportunities_hist.score_versao is
  'Escala do Score no instante da publicação. Registros antigos permanecem legacy e não são recalculados.';

-- ── 2. Derrubar as quatro, na ordem de dependência ──────────────────────────
drop function if exists public.get_futebol_fixture_reason_contract(bigint);
drop function if exists public.get_futebol_fixture_value(bigint);
drop function if exists public.get_futebol_value_board();
drop function if exists public.get_futebol_value_history(date, date);

-- ── 3. Board ────────────────────────────────────────────────────────────────
-- Saem pts_valor e pts_corroboracao. Entra score_versao. pts_premissas e
-- penalidades ficam: a penalidade que sobra é de contexto, não de odd.
create function public.get_futebol_value_board()
 returns table(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, score integer, faixa text, score_versao text, evidencias text[], premissas_sem_dado integer)
 language sql
 security definer
 set search_path to ''
as $function$
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int, v.score::int, v.faixa, v.score_versao,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    v.premissas_sem_dado::int
  from futebol.fact_value_opportunities v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by v.score desc, v.edge desc;
$function$;

-- ── 4. Histórico point-in-time ──────────────────────────────────────────────
-- Mesma forma do board, coluna por coluna: as duas telas compartilham o mesmo
-- tipo no front, e uma divergência aqui quebra a outra tela sem erro de
-- compilação. O PIT continua estrito (ADR 0009, migrations 101 e 102).
create function public.get_futebol_value_history(p_from date, p_to date)
 returns table(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, score integer, faixa text, score_versao text, evidencias text[], premissas_sem_dado integer)
 language sql
 security definer
 set search_path to ''
as $function$
  with pit as (
    select distinct on (h.opportunity_key)
      h.fixture_id, h.market, h.outcome, h.line_value, h.edge,
      h.best_odd, h.best_book, h.avg_odd, h.n_casas, h.janela_usada,
      h.prob_justa_fechamento, h.pts_premissas,
      h.penalidades, h.score, h.faixa, h.score_versao,
      h.modelo_api_concorda, h.linha_sharp_confirma, h.premissas_sem_dado
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
      and h.dbt_valid_from <= fx.kickoff_utc
      and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to)
    order by h.opportunity_key, h.dbt_valid_from desc
  )
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int, v.score::int, v.faixa, v.score_versao,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    v.premissas_sem_dado::int
  from pit v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by f.kickoff_utc desc, v.score desc, v.edge desc;
$function$;

-- ── 5. Detalhe do jogo ──────────────────────────────────────────────────────
-- Além de pts_valor e pts_corroboracao, sai penalidades_globais_pts: era a
-- penalidade de odd, que não pesa mais na nota. penalidades_especificas_pts
-- fica, porque é penalidade de contexto. Os avisos continuam sendo devolvidos:
-- eles são leitura de risco do preço, não razão do Score.
create function public.get_futebol_fixture_value(p_fixture_id bigint)
 returns table(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, penalidades_especificas_pts integer, score integer, faixa text, score_versao text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[], premissas_sem_dado integer)
 language sql
 security definer
 set search_path to ''
as $function$
  -- migration 101: kickoff no futuro lê o board; kickoff já passado lê a FOTO DO
  -- APITO no snapshot. migration 105: os avisos leem as colunas pen_* do mart.
  with v_src as (
    select fixture_id, market, outcome, line_value, competition, season, edge,
           pts_premissas, penalidades, score, faixa, score_versao, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities
    where fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id and fx.kickoff_utc > (now() at time zone 'UTC'))
    union all
    select fixture_id, market, outcome, line_value, competition, season, edge,
           pts_premissas, penalidades, score, faixa, score_versao, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities_hist h
    where h.fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id
                     and fx.kickoff_utc <= (now() at time zone 'UTC')
                     and h.dbt_valid_from <= fx.kickoff_utc
                     and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to))
  )
  select v.market, v.outcome,
    (case when v.market = 'match_winner'
          then (case v.outcome when 'Home' then 1 when 'Draw' then 2 else 3 end)
          when v.market = 'goals_over_under'
          then (coalesce(v.line_value,0)*10 + case when v.outcome='Over' then 1 else 2 end)::int
          when v.market = 'asian_handicap'
          then (1000 + (case v.outcome when 'Home' then 0 else 500 end) + (coalesce(v.line_value,0)*10))::int
          when v.market = 'btts'
          then (2000 + case when v.outcome in ('Yes') then 0 else 1 end)
          when v.market = 'double_chance'
          then (3000 + case v.outcome when '1X' then 1 else 2 end)
          else 0 end),
    v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int,
    v.penalidades_especificas_pts::int, v.score::int, v.faixa, v.score_versao,
    v.modelo_api_concorda, v.linha_sharp_confirma,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    public.futebol_copy('aviso', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    (public.futebol_copy('contra', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))))[1:3],
    v.premissas_sem_dado::int
  from v_src v
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3;
$function$;

-- ── 6. Contrato de motivos ──────────────────────────────────────────────────
-- O backend continua sendo a autoridade sobre qual razão vale para a saída
-- analisada, e agora só devolve contexto:
--
--   · sai `componentes_score`: a nota não é mais uma soma exibível de partes;
--   · sai valor de mercado e corroboração de A favor;
--   · saem os avisos de odd de Contra — eles continuam no detalhe como leitura
--     de risco do preço, mas parar de aparecer como premissa é o ponto da spec;
--   · saem `linha_subindo` e `linha_descendo` das premissas aplicáveis de gols,
--     porque movimento de mercado é preço, não contexto.
--
-- Contra continua sendo premissa aplicável avaliada e ausente, mais penalidade
-- de contexto. O lado oposto nunca vira Contra automaticamente.
create function public.get_futebol_fixture_reason_contract(p_fixture_id bigint)
returns table(
  market text,
  outcome text,
  line_value double precision,
  score integer,
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
      v.market, v.outcome, v.line_value, v.score,
      p.acesas, p.apagadas, p.penalidades as penalidades_ativas,
      case v.market
        when 'goals_over_under' then case v.outcome
          when 'Over' then array[
            'defesas_vazaveis', 'ataque_combinado', 'xg_combinado_alto',
            'ambos_vazam', 'ritmo_alto', 'historico_over'
          ]::text[]
          when 'Under' then array[
            'defesas_firmes', 'xg_baixo_combinado', 'clean_sheets_altos',
            'ataques_fracos', 'historico_under'
          ]::text[]
          else array[]::text[]
        end
        when 'match_winner' then case v.outcome
          when 'Home' then array[
            'forma', 'mando', 'superioridade_tabela', 'forca_mismatch',
            'superioridade_xg', 'h2h_favoravel', 'desfalque_adversario'
          ]::text[]
          when 'Away' then array[
            'forma', 'mando', 'superioridade_tabela', 'forca_mismatch',
            'superioridade_xg', 'h2h_favoravel', 'desfalque_adversario'
          ]::text[]
          else array[]::text[]
        end
        when 'asian_handicap' then case
          -- A linha é guardada na ótica do mandante. Para o visitante, o
          -- sinal representa a saída espelhada e precisa ser lido ao contrário.
          when (v.outcome = 'Home' and v.line_value < 0)
            or (v.outcome = 'Away' and v.line_value > 0) then array[
            'tende_golear', 'supremacia', 'sem_rodizio',
            'adversario_fragil_fora', 'mando_forte'
          ]::text[]
          when v.line_value <> 0 then array[
            'defesa_fora_solida', 'raramente_perde_por_2'
          ]::text[]
          else array[]::text[]
        end
        when 'btts' then case v.outcome
          when 'Yes' then array[
            'ambos_marcam', 'ataque_dos_dois', 'defesas_vazaveis', 'historico_btts'
          ]::text[]
          when 'No' then array[
            'defesa_forte', 'ataque_trava', 'historico_seco'
          ]::text[]
          else array[]::text[]
        end
        when 'double_chance' then array[
          'lado_coberto_forte', 'equilibrio_defensivo',
          'adversario_limitado', 'invicto_recente'
        ]::text[]
        else array[]::text[]
      end as aplicaveis
    from public.get_futebol_fixture_value(p_fixture_id) v
    join public.get_futebol_fixture_premissas(p_fixture_id) p
      on p.market = v.market
     and p.outcome = v.outcome
     and p.line_value is not distinct from v.line_value
  )
  select
    b.market,
    b.outcome,
    b.line_value,
    b.score,
    -- Sem o gate `pts_premissas > 0` que existia aqui. Ele era herança da nota
    -- antiga, em que a linha podia ser publicada só pelo preço e as premissas
    -- não contribuíam. No Score de contexto, premissa aplicável e acesa É
    -- contribuição por definição — e manter o gate deixaria A favor vazio numa
    -- linha legacy publicada pelo preço, entre esta migration e a troca do mart.
    coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'premissa') order by slug)
      from unnest(b.acesas) slug
      where slug = any(b.aplicaveis)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'premissa') order by slug)
      from unnest(b.apagadas) slug
      where slug = any(b.aplicaveis)
    ), '[]'::jsonb)
    || coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'penalidade') order by slug)
      from unnest(b.penalidades_ativas) slug
      where slug <> 'favorito_irregular'
    ), '[]'::jsonb)
  from base b;
$function$;

-- ── 7. Copy: preço, movimento de mercado e concordância de modelo saem ──────
-- Estes cinco slugs descrevem preço, não contexto, e a spec tira os três do
-- texto de evidência. A tabela de copy é a única fonte desses textos, então
-- apagar a semente basta: futebol_flags pode continuar acendendo as chaves,
-- elas simplesmente não traduzem mais para nada.
-- A tabela de apoio é regerada inteira a partir do catálogo do front
-- (src/utils/futebol-premissas.ts, copyDeServing). Apagar só as cinco linhas
-- deixaria buracos no campo ordem, e ordem decide qual evidência a DM do
-- Telegram mostra: ela manda o primeiro item da lista.
delete from public.futebol_premissa_copy;

insert into public.futebol_premissa_copy (tipo, market, slug, mando, ordem, texto) values
  ('evidencia', 'goals_over_under', 'defesas_firmes', 'any', 1, 'Defesas firmes dos dois lados'),
  ('evidencia', 'goals_over_under', 'defesas_vazaveis', 'any', 2, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'goals_over_under', 'ataque_combinado', 'any', 3, 'Os dois somam muitos gols'),
  ('evidencia', 'goals_over_under', 'xg_baixo_combinado', 'any', 4, 'Os dois criam pouca chance de gol'),
  ('evidencia', 'goals_over_under', 'xg_combinado_alto', 'any', 5, 'Os dois criam muita chance de gol'),
  ('evidencia', 'goals_over_under', 'clean_sheets_altos', 'any', 6, 'Os dois passam muitos jogos sem sofrer gol'),
  ('evidencia', 'goals_over_under', 'ataques_fracos', 'any', 7, 'Ataques fracos dos dois lados'),
  ('evidencia', 'goals_over_under', 'historico_under', 'any', 8, 'Histórico de jogo com poucos gols'),
  ('evidencia', 'goals_over_under', 'ambos_vazam', 'any', 9, 'Os dois sofrem gol quase todo jogo'),
  ('evidencia', 'goals_over_under', 'ritmo_alto', 'any', 10, 'Jogo de ritmo alto'),
  ('evidencia', 'goals_over_under', 'historico_over', 'any', 11, 'Histórico de jogo com muitos gols'),
  ('contra', 'goals_over_under', 'defesas_firmes', 'any', 1, 'A solidez das defesas não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'ataque_combinado', 'any', 2, 'O ataque dos dois times não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'xg_baixo_combinado', 'any', 3, 'O baixo volume de chances não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'xg_combinado_alto', 'any', 4, 'O alto volume de chances não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'clean_sheets_altos', 'any', 5, 'Os jogos sem sofrer gol não entraram como sinal a favor'),
  ('contra', 'goals_over_under', 'ritmo_alto', 'any', 6, 'O ritmo do jogo não entrou como sinal a favor'),
  ('aviso', 'goals_over_under', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'goals_over_under', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'goals_over_under', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'goals_over_under', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'goals_over_under', 'linha_extrema', 'any', 5, 'Linha muito longe do normal'),
  ('evidencia', 'match_winner', 'forma', 'any', 1, 'Em boa fase, vem ganhando'),
  ('evidencia', 'match_winner', 'mando', 'any', 2, 'Mando relevante'),
  ('evidencia', 'match_winner', 'mando', 'home', 2, 'Manda bem em casa'),
  ('evidencia', 'match_winner', 'mando', 'away', 2, 'Vai bem fora de casa'),
  ('evidencia', 'match_winner', 'superioridade_tabela', 'any', 3, 'Bem à frente na tabela'),
  ('evidencia', 'match_winner', 'forca_mismatch', 'any', 4, 'Ataque forte contra defesa frágil do adversário'),
  ('evidencia', 'match_winner', 'superioridade_xg', 'any', 5, 'Cria mais chances de gol que o adversário'),
  ('evidencia', 'match_winner', 'h2h_favoravel', 'any', 6, 'Leva vantagem no histórico do confronto'),
  ('evidencia', 'match_winner', 'desfalque_adversario', 'any', 7, 'Adversário com desfalque de titular importante'),
  ('contra', 'match_winner', 'mando', 'home', 1, 'Em casa, o mando não entrou como sinal a favor'),
  ('contra', 'match_winner', 'mando', 'away', 1, 'Fora de casa, o mando não entrou como sinal a favor'),
  ('contra', 'match_winner', 'superioridade_tabela', 'any', 2, 'A posição na tabela não entrou como sinal a favor'),
  ('contra', 'match_winner', 'forca_mismatch', 'any', 3, 'O duelo entre ataque e defesa não entrou como sinal a favor'),
  ('aviso', 'match_winner', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'match_winner', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'match_winner', 'desfalque_proprio', 'any', 3, 'Time apostado com desfalque de titular importante'),
  ('aviso', 'match_winner', 'pen_poucas_casas', 'any', 4, 'Poucas casas cotando esse mercado'),
  ('aviso', 'match_winner', 'pen_odd_juice', 'any', 5, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'match_winner', 'pick_empate', 'any', 6, 'Empate é o resultado mais difícil de prever'),
  ('evidencia', 'asian_handicap', 'tende_golear', 'any', 1, 'Costuma ganhar por muitos gols'),
  ('evidencia', 'asian_handicap', 'supremacia', 'any', 2, 'Muito superior ao adversário'),
  ('evidencia', 'asian_handicap', 'defesa_fora_solida', 'any', 3, 'Defesa sólida jogando fora'),
  ('evidencia', 'asian_handicap', 'defesa_fora_solida', 'home', 3, 'Defesa sólida em casa'),
  ('evidencia', 'asian_handicap', 'sem_rodizio', 'any', 4, 'Deve entrar com força máxima'),
  ('evidencia', 'asian_handicap', 'raramente_perde_por_2', 'any', 5, 'Quando perde, perde apertado'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'any', 6, 'Adversário fraco fora de casa'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'away', 6, 'Adversário fraco em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'any', 7, 'Manda muito bem em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'away', 7, 'Vai muito bem fora de casa'),
  ('contra', 'asian_handicap', 'tende_golear', 'any', 1, 'A margem das vitórias não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'supremacia', 'any', 2, 'A superioridade sobre o adversário não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'defesa_fora_solida', 'any', 3, 'A solidez defensiva não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'defesa_fora_solida', 'home', 3, 'Em casa, a solidez defensiva não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'raramente_perde_por_2', 'any', 4, 'A margem das derrotas não entrou como sinal a favor'),
  ('aviso', 'asian_handicap', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'asian_handicap', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'asian_handicap', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'asian_handicap', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'asian_handicap', 'handicap_alto', 'any', 5, 'Handicap muito alto'),
  ('evidencia', 'btts', 'ambos_marcam', 'any', 1, 'Os dois costumam marcar'),
  ('evidencia', 'btts', 'ataque_dos_dois', 'any', 2, 'Os dois atacam bem'),
  ('evidencia', 'btts', 'defesas_vazaveis', 'any', 3, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'btts', 'defesa_forte', 'any', 4, 'Defesa forte de um dos lados'),
  ('evidencia', 'btts', 'ataque_trava', 'any', 5, 'Um dos ataques costuma passar em branco'),
  ('evidencia', 'btts', 'historico_btts', 'any', 6, 'Nos últimos jogos, os dois marcaram'),
  ('evidencia', 'btts', 'historico_seco', 'any', 7, 'Jogos recentes sem os dois marcarem'),
  ('contra', 'btts', 'ambos_marcam', 'any', 1, 'Os gols dos dois times não entraram como sinal a favor'),
  ('contra', 'btts', 'defesas_vazaveis', 'any', 2, 'A fragilidade das defesas não entrou como sinal a favor'),
  ('contra', 'btts', 'defesa_forte', 'any', 3, 'A força defensiva não entrou como sinal a favor'),
  ('contra', 'btts', 'ataque_trava', 'any', 4, 'A limitação ofensiva não entrou como sinal a favor'),
  ('aviso', 'btts', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'btts', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'btts', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'btts', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('evidencia', 'double_chance', 'lado_coberto_forte', 'any', 1, 'O lado coberto é forte'),
  ('evidencia', 'double_chance', 'equilibrio_defensivo', 'any', 2, 'Equilíbrio defensivo'),
  ('evidencia', 'double_chance', 'adversario_limitado', 'any', 3, 'Adversário com campanha fraca'),
  ('evidencia', 'double_chance', 'invicto_recente', 'any', 4, 'Invicto nos últimos jogos'),
  ('contra', 'double_chance', 'lado_coberto_forte', 'any', 1, 'A força do lado coberto não entrou como sinal a favor'),
  ('contra', 'double_chance', 'adversario_limitado', 'any', 2, 'A campanha do adversário não entrou como sinal a favor'),
  ('aviso', 'double_chance', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'double_chance', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'double_chance', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'double_chance', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco');

-- ── 8. Grants ───────────────────────────────────────────────────────────────
grant execute on function public.get_futebol_value_board() to anon, authenticated, service_role;
grant execute on function public.get_futebol_value_history(date, date) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_value(bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_reason_contract(bigint) to anon, authenticated, service_role;
