-- ============================================================================
-- 105 · `get_futebol_fixture_value`: avisos de penalidade saem do próprio mart
-- ============================================================================
-- Issue #267 (Matheus, 19/08). O `analytics-engineering#87` publicou no mart as
-- quatro flags de penalidade de odds como colunas BOOLEAN de
-- `fact_value_opportunities` (e do `_hist`) — as MESMAS que compõem o
-- `penalidades_globais_pts` da linha. Esta migration faz a RPC colher.
--
-- O que sai: o CTE `d`, que rederivava as flags do `int_futebol_odds_devig`.
-- No prd (pré-098, sem desempate nenhum) ele sorteava a janela: 74 de 126
-- linhas do board (18/08) e 76 (19/08) exibiam aviso de janela diferente da
-- publicada, e 34 contradiziam o `penalidades_globais_pts` da própria linha.
-- Aqui na develop a 098 já tinha consertado o desempate, mas o defeito de
-- desenho fica: a tabela tem grão (fixture, mercado, saída, linha, JANELA) e
-- é fácil de ler como se fosse única por (fixture, saída, linha). Ler as
-- parcelas ao lado da soma remove a tentação para o próximo consumidor.
--
-- O que entra: as 4 colunas `pen_*` no select das duas fontes do `v_src`
-- (board e foto do apito), e os quatro `case when` lendo `v.pen_*`.
--
-- No `_hist`, `pen_*` é NULL nas versões abertas antes do AE#87 (ficaram fora
-- do check_cols de propósito, para não fabricar churn no deploy). NULL não
-- gera aviso — "não sei" não vira alerta.
--
-- Conferência (0 esperado):
--   select count(*) from futebol.fact_value_opportunities
--   where 30*pen_odd_outlier::int + 12*pen_poucas_casas::int
--       + 15*pen_odd_longshot::int + 10*pen_odd_juice::int
--         is distinct from penalidades_globais_pts;
--
-- Assinatura não muda: `create or replace` basta, grants preservados.
--
-- O 4o case perdeu o `and v.market <> double_chance` que o ticket marcou como
-- opcional: o mart garante pen_odd_juice = FALSE em toda linha de Dupla Chance
-- por construcao (gate de odd proprio, sem juice). Manter a guarda nao protegia
-- nada e armava a contradicao inversa: se o mart um dia marcasse juice numa DC,
-- os 10 pts entrariam na soma exibida com o aviso suprimido.
-- Corpo completo (fonte: docs/futebol-prod-deploy.sql, mesma revisão).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_value(p_fixture_id bigint)
 RETURNS TABLE(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, penalidades_globais_pts integer, penalidades_especificas_pts integer, score integer, faixa text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[], premissas_sem_dado integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- migration 101: a fonte deixa de ser fixa. Kickoff no futuro lê o board;
  -- kickoff já passado lê a FOTO DO APITO no snapshot. É *kickoff passado* e
  -- não *jogo terminado*, senão as ~2h de bola rolando ficariam sem linha
  -- depois que o mart passar a expurgar os status ao vivo (ADR 0009).
  -- migration 105: os avisos de penalidade leem as colunas pen_* do proprio mart
  -- (AE#87). O CTE sobre int_futebol_odds_devig foi removido: ele rederivava as
  -- flags e, no prd, 76 de 126 linhas exibiam aviso de janela errada (issue #267).
  -- No hist, pen_* pode ser NULL em versao aberta antes do AE#87: NULL nao gera aviso.
  with v_src as (
    select fixture_id, market, outcome, line_value, competition, season, edge, pts_valor,
           pts_premissas, pts_corroboracao, penalidades, score, faixa, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_globais_pts, penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities
    where fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id and fx.kickoff_utc > (now() at time zone 'UTC'))
    union all
    select fixture_id, market, outcome, line_value, competition, season, edge, pts_valor,
           pts_premissas, pts_corroboracao, penalidades, score, faixa, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_globais_pts, penalidades_especificas_pts, modelo_api_concorda,
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
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int,
    v.penalidades_globais_pts::int, v.penalidades_especificas_pts::int, v.score::int, v.faixa,
    v.modelo_api_concorda, v.linha_sharp_confirma,
    array_remove(array[
      case when p.forca_mismatch then 'Ataque forte contra defesa frágil do adversário' end,
      case when p.superioridade_xg then 'Cria mais chances de gol do que o adversário' end,
      case when p.mando then (case v.outcome when 'Home' then 'Manda bem em casa' when 'Away' then 'Vai bem fora de casa' else 'Mando relevante' end) end,
      case when p.desfalque_adversario then 'Adversário com desfalque de titular importante' end,
      case when p.superioridade_tabela then 'Bem à frente na tabela' end,
      case when p.forma then 'Em boa fase (vitórias recentes)' end,
      case when p.h2h_favoravel then 'Histórico favorável no confronto direto' end
    ], null)
    || array_remove(array[
      case when o.ataque_combinado then 'Os dois somam muitos gols (casa + fora)' end,
      case when o.defesas_vazaveis then 'Defesas frágeis dos dois lados' end,
      case when o.xg_combinado_alto then 'Os dois criam muitas chances de gol' end,
      case when o.ritmo_alto then 'Jogo de ritmo alto (muitas finalizações)' end,
      case when o.ambos_vazam then 'Os dois sofrem gol quase todo jogo' end,
      case when o.historico_over then 'Últimos jogos goleadores' end,
      case when o.linha_subindo then 'Mercado puxando a linha pra cima' end,
      case when o.defesas_firmes then 'Defesas firmes dos dois lados' end,
      case when o.clean_sheets_altos then 'Os dois passam muitos jogos sem sofrer gol' end,
      case when o.xg_baixo_combinado then 'Os dois criam pouca coisa na frente' end,
      case when o.ataques_fracos then 'Ataque fraco (passam em branco com frequência)' end,
      case when o.historico_under then 'Últimos jogos truncados' end,
      case when o.linha_descendo then 'Mercado puxando a linha pra baixo' end
    ], null)
    || array_remove(array[
      case when ah.supremacia then 'Muito superior ao adversário' end,
      case when ah.tende_golear then 'Costuma vencer com boa diferença de gols' end,
      case when ah.adversario_fragil_fora then 'Adversário tem defesa frágil' end,
      case when ah.mando_forte then 'Manda muito bem em casa' end,
      case when ah.sem_rodizio then 'Deve entrar com força máxima' end,
      case when ah.raramente_perde_por_2 then 'Raramente perde por 2 gols ou mais' end,
      case when ah.defesa_fora_solida then 'Defesa sólida jogando fora' end,
      case when ah.favorito_irregular then 'O favorito não costuma golear' end
    ], null)
    || array_remove(array[
      case when bt.ambos_marcam then 'Os dois quase sempre marcam' end,
      case when bt.ataque_dos_dois then 'Os dois ataques vêm produzindo' end,
      case when bt.defesas_vazaveis then 'As duas defesas sofrem gol com frequência' end,
      case when bt.historico_btts then 'Nos últimos jogos, os dois marcaram' end,
      case when bt.defesa_forte then 'Uma das defesas segura bem o placar' end,
      case when bt.ataque_trava then 'Um dos ataques costuma passar em branco' end,
      case when bt.historico_seco then 'Jogos recentes sem os dois marcarem' end
    ], null)
    || array_remove(array[
      case when dc.lado_coberto_forte then 'O lado coberto é claramente o mais forte' end,
      case when dc.equilibrio_defensivo then 'Defesas parelhas — empate é desfecho plausível' end,
      case when dc.adversario_limitado then 'Adversário com campanha fraca' end,
      case when dc.invicto_recente then 'Vem sem perder nos últimos jogos' end
    ], null)
    || array_remove(array[
      case when v.modelo_api_concorda and v.linha_sharp_confirma then 'As principais casas e o modelo da API apontam o mesmo lado'
           when v.modelo_api_concorda then 'Modelo da API concorda com esse lado'
           when v.linha_sharp_confirma then 'As principais casas vêm baixando a odd desse lado' end
    ], null),
    array_remove(array[
      case when v.pen_odd_outlier then 'Só uma casa paga essa odd — pode ser linha furada' end,
      case when v.pen_poucas_casas then 'Poucas casas cotando esse mercado' end,
      case when v.pen_odd_longshot then 'Odd alta (zebra) — entra com cautela' end,
      case when v.pen_odd_juice then 'Odd baixa — retorno pequeno pro risco' end,
      case when p.pick_empate then 'Empate é o resultado mais difícil de prever' end,
      case when p.desfalque_proprio then 'Time apostado com desfalque de titular importante' end,
      case when o.linha_extrema then 'Linha extrema — pouco confiável' end,
      case when ah.handicap_alto then 'Handicap alto (2,5+ gols) — raramente confiável' end
    ], null),
    (array_remove(array[
      case when not coalesce(p.forca_mismatch, true) then 'Sem vantagem clara de ataque × defesa' end,
      case when not coalesce(p.mando, true) and v.outcome <> 'Draw' then 'Mando não pesa a favor' end,
      case when not coalesce(p.superioridade_tabela, true) then 'Times equilibrados na tabela' end,
      case when v.outcome='Over' and not coalesce(o.ataque_combinado, true) then 'Os dois não somam tantos gols' end,
      case when v.outcome='Over' and not coalesce(o.ritmo_alto, true) then 'Jogo não costuma ser de ritmo alto' end,
      case when v.outcome='Over' and not coalesce(o.xg_combinado_alto, true) then 'O volume de chances não é tão alto' end,
      case when v.outcome='Under' and not coalesce(o.defesas_firmes, true) then 'As defesas não são tão firmes' end,
      case when v.outcome='Under' and not coalesce(o.clean_sheets_altos, true) then 'Não costumam segurar o placar zerado' end,
      case when v.outcome='Under' and not coalesce(o.xg_baixo_combinado, true) then 'Criam chances demais pra um jogo truncado' end,
      case when ah.is_favorito and not coalesce(ah.supremacia, true) then 'Não é tão superior assim ao adversário' end,
      case when ah.is_favorito and not coalesce(ah.tende_golear, true) then 'Nem sempre vence com boa diferença' end,
      case when ah.is_azarao and not coalesce(ah.raramente_perde_por_2, true) then 'Já levou goleada algumas vezes' end,
      case when ah.is_azarao and not coalesce(ah.defesa_fora_solida, true) then 'Defesa fora não é das mais sólidas' end,
      case when v.outcome='Yes' and not coalesce(bt.ambos_marcam, true) then 'Nem sempre os dois marcam' end,
      case when v.outcome='Yes' and not coalesce(bt.defesas_vazaveis, true) then 'As defesas não são tão vazadas' end,
      case when v.outcome='No' and not coalesce(bt.defesa_forte, true) then 'Nenhuma defesa é tão sólida' end,
      case when v.outcome='No' and not coalesce(bt.ataque_trava, true) then 'Os dois ataques costumam marcar' end,
      case when not coalesce(dc.lado_coberto_forte, true) then 'O lado coberto não é claramente o mais forte' end,
      case when not coalesce(dc.adversario_limitado, true) then 'Adversário não é tão limitado' end
    ], null))[1:3],
    v.premissas_sem_dado::int
  from v_src v
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3;
$function$
;
