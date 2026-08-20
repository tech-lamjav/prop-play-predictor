-- ============================================================
-- 093_futebol_mapa_premissas — as premissas de um jogo, acesas E apagadas
-- ============================================================
-- Contexto: a tela de jogo mostra hoje "a aposta e o preço". A revisão da
-- metodologia (docs/premissas-recalibragem.md, 01/08/2026) provou que essa é a
-- ordem errada: a porta de publicação passa a ser o CONTEXTO (2+ premissas
-- acesas) e o preço vira filtro de sanidade. A regra antiga (edge > 0) é a única
-- das quatro testadas que perde dinheiro (R$ 100 → R$ 85 em 393 apostas), contra
-- R$ 110 de "2 premissas, sem olhar preço" em 1.087 apostas.
--
-- Consequência de produto: o pick deixa de ser o conteúdo da tela e passa a ser
-- uma CONSEQUÊNCIA. O conteúdo é o mapa de premissas, e ele precisa mostrar
-- também o que NÃO acendeu, porque "faltou pouco" e "não passou nem perto" são
-- leituras diferentes que hoje viram a mesma ausência.
--
-- Por que isto destrava a tela: odds só existem a partir de T−24h, então a
-- maioria dos jogos da agenda não tem preço nenhum. As premissas, ao contrário,
-- cobrem TODOS os 6.597 jogos do mart, incluindo 1.177 jogos futuros. O mapa de
-- premissas é o único conteúdo analítico que existe para um jogo de amanhã.
--
-- LIMITE CONHECIDO, e é o T3 da recalibragem: as colunas booleanas não têm NULL
-- (medido: zero nulos nas duas tabelas maiores). Ou seja, premissa sem dado hoje
-- virou `false` em silêncio, e por isso esta RPC devolve dois estados (acesa /
-- apagada) e não três. Quando o T3 entrar, `apagadas` se divide em apagada e
-- sem_dado sem mudar a assinatura: é só passar a devolver um terceiro array.
--
-- Também não devolve "por quanto faltou": o limiar de cada premissa é a fórmula
-- que o Matheus ainda precisa entregar (T5). As tabelas int_* guardam só o
-- booleano, não a métrica que o gerou.
--
-- Formato: uma linha por CANDIDATO (mercado + saída + linha), com as premissas em
-- arrays de slug. Mesmo padrão do `evidencias text[]` que o
-- get_futebol_fixture_value já usa. O rótulo humano, o peso e o agrupamento
-- ficam no front (src/utils/futebol-premissas.ts), porque são copy e decisão de
-- produto, não dado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_premissas(p_fixture_id bigint)
RETURNS TABLE(
  market          text,
  outcome         text,
  line_value      double precision,
  pts_premissas   bigint,
  penalidades_pts bigint,
  acesas          text[],
  apagadas        text[],
  penalidades     text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  -- Resultado (1X2)
  select 'match_winner'::text,
         p.outcome,
         null::double precision,
         p.pts_premissas,
         p.penalidades_1x2_pts,
         array_remove(array[
           case when p.forma                 then 'forma' end,
           case when p.mando                 then 'mando' end,
           case when p.superioridade_tabela  then 'superioridade_tabela' end,
           case when p.forca_mismatch        then 'forca_mismatch' end,
           case when p.superioridade_xg      then 'superioridade_xg' end,
           case when p.h2h_favoravel         then 'h2h_favoravel' end,
           case when p.desfalque_adversario  then 'desfalque_adversario' end
         ], null),
         array_remove(array[
           case when not p.forma                then 'forma' end,
           case when not p.mando                then 'mando' end,
           case when not p.superioridade_tabela then 'superioridade_tabela' end,
           case when not p.forca_mismatch       then 'forca_mismatch' end,
           case when not p.superioridade_xg     then 'superioridade_xg' end,
           case when not p.h2h_favoravel        then 'h2h_favoravel' end,
           case when not p.desfalque_adversario then 'desfalque_adversario' end
         ], null),
         array_remove(array[
           case when p.pick_empate       then 'pick_empate' end,
           case when p.desfalque_proprio then 'desfalque_proprio' end
         ], null)
  from futebol.int_futebol_premissas_1x2 p
  where p.fixture_id = p_fixture_id

  union all

  -- Gols (Over/Under). As premissas dos dois lados vivem na mesma tabela; cada
  -- linha já é de um lado só (outcome Over ou Under), então listamos todas e o
  -- lado errado simplesmente nunca acende.
  select 'goals_over_under'::text,
         p.outcome,
         p.line_value,
         p.pts_premissas,
         p.penalidades_ou_pts,
         array_remove(array[
           case when p.defesas_firmes      then 'defesas_firmes' end,
           case when p.defesas_vazaveis    then 'defesas_vazaveis' end,
           case when p.ataque_combinado    then 'ataque_combinado' end,
           case when p.xg_baixo_combinado  then 'xg_baixo_combinado' end,
           case when p.xg_combinado_alto   then 'xg_combinado_alto' end,
           case when p.clean_sheets_altos  then 'clean_sheets_altos' end,
           case when p.ataques_fracos      then 'ataques_fracos' end,
           case when p.historico_under     then 'historico_under' end,
           case when p.historico_over      then 'historico_over' end,
           case when p.ambos_vazam         then 'ambos_vazam' end,
           case when p.ritmo_alto          then 'ritmo_alto' end,
           case when p.linha_subindo       then 'linha_subindo' end,
           case when p.linha_descendo      then 'linha_descendo' end
         ], null),
         array_remove(array[
           case when not p.defesas_firmes     then 'defesas_firmes' end,
           case when not p.defesas_vazaveis   then 'defesas_vazaveis' end,
           case when not p.ataque_combinado   then 'ataque_combinado' end,
           case when not p.xg_baixo_combinado then 'xg_baixo_combinado' end,
           case when not p.xg_combinado_alto  then 'xg_combinado_alto' end,
           case when not p.clean_sheets_altos then 'clean_sheets_altos' end,
           case when not p.ataques_fracos     then 'ataques_fracos' end,
           case when not p.historico_under    then 'historico_under' end,
           case when not p.historico_over     then 'historico_over' end,
           case when not p.ambos_vazam        then 'ambos_vazam' end,
           case when not p.ritmo_alto         then 'ritmo_alto' end,
           case when not p.linha_subindo      then 'linha_subindo' end,
           case when not p.linha_descendo     then 'linha_descendo' end
         ], null),
         array_remove(array[
           case when p.linha_extrema then 'linha_extrema' end
         ], null)
  from futebol.int_futebol_premissas_ou p
  where p.fixture_id = p_fixture_id

  union all

  -- Handicap asiático
  select 'asian_handicap'::text,
         p.outcome,
         p.line_value,
         p.pts_premissas,
         p.penalidades_ah_pts,
         array_remove(array[
           case when p.supremacia             then 'supremacia' end,
           case when p.tende_golear           then 'tende_golear' end,
           case when p.adversario_fragil_fora then 'adversario_fragil_fora' end,
           case when p.mando_forte            then 'mando_forte' end,
           case when p.sem_rodizio            then 'sem_rodizio' end,
           case when p.raramente_perde_por_2  then 'raramente_perde_por_2' end,
           case when p.defesa_fora_solida     then 'defesa_fora_solida' end
         ], null),
         array_remove(array[
           case when not p.supremacia             then 'supremacia' end,
           case when not p.tende_golear           then 'tende_golear' end,
           case when not p.adversario_fragil_fora then 'adversario_fragil_fora' end,
           case when not p.mando_forte            then 'mando_forte' end,
           case when not p.sem_rodizio            then 'sem_rodizio' end,
           case when not p.raramente_perde_por_2  then 'raramente_perde_por_2' end,
           case when not p.defesa_fora_solida     then 'defesa_fora_solida' end
         ], null),
         array_remove(array[
           case when p.favorito_irregular then 'favorito_irregular' end,
           case when p.handicap_alto      then 'handicap_alto' end
         ], null)
  from futebol.int_futebol_premissas_ah p
  where p.fixture_id = p_fixture_id

  union all

  -- Ambos marcam (BTTS)
  select 'btts'::text,
         p.outcome,
         null::double precision,
         p.pts_premissas,
         p.penalidades_btts_pts,
         array_remove(array[
           case when p.ambos_marcam     then 'ambos_marcam' end,
           case when p.ataque_dos_dois  then 'ataque_dos_dois' end,
           case when p.defesas_vazaveis then 'defesas_vazaveis' end,
           case when p.historico_btts   then 'historico_btts' end,
           case when p.defesa_forte     then 'defesa_forte' end,
           case when p.ataque_trava     then 'ataque_trava' end,
           case when p.historico_seco   then 'historico_seco' end
         ], null),
         array_remove(array[
           case when not p.ambos_marcam     then 'ambos_marcam' end,
           case when not p.ataque_dos_dois  then 'ataque_dos_dois' end,
           case when not p.defesas_vazaveis then 'defesas_vazaveis' end,
           case when not p.historico_btts   then 'historico_btts' end,
           case when not p.defesa_forte     then 'defesa_forte' end,
           case when not p.ataque_trava     then 'ataque_trava' end,
           case when not p.historico_seco   then 'historico_seco' end
         ], null),
         '{}'::text[]
  from futebol.int_futebol_premissas_btts p
  where p.fixture_id = p_fixture_id

  union all

  -- Dupla chance
  select 'double_chance'::text,
         p.outcome,
         null::double precision,
         p.pts_premissas,
         p.penalidades_dc_pts,
         array_remove(array[
           case when p.lado_coberto_forte   then 'lado_coberto_forte' end,
           case when p.equilibrio_defensivo then 'equilibrio_defensivo' end,
           case when p.adversario_limitado  then 'adversario_limitado' end,
           case when p.invicto_recente      then 'invicto_recente' end
         ], null),
         array_remove(array[
           case when not p.lado_coberto_forte   then 'lado_coberto_forte' end,
           case when not p.equilibrio_defensivo then 'equilibrio_defensivo' end,
           case when not p.adversario_limitado  then 'adversario_limitado' end,
           case when not p.invicto_recente      then 'invicto_recente' end
         ], null),
         '{}'::text[]
  from futebol.int_futebol_premissas_dc p
  where p.fixture_id = p_fixture_id

  order by 1, 4 desc, 2, 3;
$function$;

COMMENT ON FUNCTION public.get_futebol_fixture_premissas(bigint) IS
  'Mapa de premissas de um jogo nos 5 mercados, com as acesas E as apagadas, por candidato (mercado + saída + linha). Base da tela de jogo depois da revisão que trocou a porta de publicação de preço para contexto. Dois estados só: as colunas int_* não têm NULL, então premissa sem dado hoje é indistinguível de premissa apagada (T3 da recalibragem). Não devolve o limiar nem a métrica: só o booleano existe no mart (T5).';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_premissas(bigint) TO anon, authenticated, service_role;
