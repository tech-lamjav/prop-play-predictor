-- ============================================================
-- 091_opportunity_alerted_history — histórico fiel do que foi ALERTADO
-- ============================================================
-- Contexto (task wdx6zet45g): o mart do futebol (fact_value_opportunities) é
-- full-refresh e escolhe UMA janela por jogo (t24h → t1h → t15m). O daily sai
-- às 10h BRT com a janela da manhã; até o jogo, o pick de valor pode virar.
-- Resultado: a tela de Oportunidades mostra o pick de FECHAMENTO, não o que a
-- pessoa recebeu no Telegram.
--
-- Caso real (22/07, Coritiba 1 × 3 Palmeiras): enviamos "Palmeiras −0,25", que
-- deu GREEN. O board fechou com Under 2,25 e Under 2,5, as duas RED. Ou seja,
-- hoje o histórico mostra red num dia em que o que mandamos deu green.
--
-- O registro do que foi enviado NÃO se perde: daily_opportunity_picks (085) já
-- guarda desde 21/07. Faltava só (a) o pick ESTRUTURADO, porque não se liquida
-- green/red a partir de texto ("Palmeiras −0,25"), e (b) uma RPC pro front ler
-- (a tabela é service_role-only).
--
-- O snapshot por janela no BigQuery (fact_value_opportunities_hist) é a outra
-- frente e está com o Mateus. Hoje ele não captura a janela da manhã (t24h =
-- 2 de 888 linhas), então não serve ainda pra reproduzir o alerta. Quando
-- capturar, entra como complemento: TODAS as oportunidades como estavam no
-- momento do envio, não só o pick que foi enviado.
-- ============================================================

-- ── 1. Pick estruturado + números do momento do envio ────────
-- Por que gravar Score/faixa/chance/valor aqui, se "já estão no mart": porque
-- NÃO estão. Tudo no pipeline é full-refresh e guarda uma janela por jogo, e a
-- janela da manhã é substituída pela de fechamento. Conferido em 29/07/2026:
-- `int_futebol_odds_devig` (onde vivem chance e edge por janela) tem t24h só
-- pros jogos FUTUROS; de jogo passado sobra apenas t15m. E `message_runs`
-- (telemetria do envio, que guardava top_score) não existe em produção. Ou seja,
-- se não gravar no instante do envio, o número morre.
ALTER TABLE public.daily_opportunity_picks
  ADD COLUMN IF NOT EXISTS market                text,
  ADD COLUMN IF NOT EXISTS outcome               text,
  ADD COLUMN IF NOT EXISTS line_value            double precision,
  ADD COLUMN IF NOT EXISTS janela_usada          text,
  ADD COLUMN IF NOT EXISTS score                 integer,
  ADD COLUMN IF NOT EXISTS faixa                 text,
  ADD COLUMN IF NOT EXISTS edge                  double precision,
  ADD COLUMN IF NOT EXISTS prob_justa_fechamento double precision;

COMMENT ON COLUMN public.daily_opportunity_picks.market IS
  'market do mart (match_winner, goals_over_under, asian_handicap, btts, double_chance). Liquidação em src/utils/futebol-settlement.ts.';
COMMENT ON COLUMN public.daily_opportunity_picks.outcome IS
  'outcome do mart (Home/Away/Draw, Over/Under, Yes/No, 1X/X2/12).';
COMMENT ON COLUMN public.daily_opportunity_picks.line_value IS
  'Linha na ótica do MANDANTE — mesma convenção do mart e do pickLabel (pro visitante o rótulo mostra o oposto).';
COMMENT ON COLUMN public.daily_opportunity_picks.janela_usada IS
  'Janela de odds que gerou o alerta (t24h/t1h/t15m). É exatamente o dado que o mart perde ao sobrescrever.';
COMMENT ON COLUMN public.daily_opportunity_picks.score IS
  'Score do pick no momento do envio (o do mart muda quando a janela vira).';
COMMENT ON COLUMN public.daily_opportunity_picks.faixa IS
  'Faixa (Alta/Média/Baixa) no momento do envio. Gravada em vez de derivada do score pra não depender dos limiares do front.';
COMMENT ON COLUMN public.daily_opportunity_picks.edge IS
  'Valor (edge, fração: 0.088 = +8,8%) no momento do envio. Não é recuperável depois: a devig sobrescreve a janela.';
COMMENT ON COLUMN public.daily_opportunity_picks.prob_justa_fechamento IS
  'Chance (prob justa devigada, 0..1) no momento do envio. Também não é recuperável depois.';

-- Nas 8 linhas anteriores a esta migration estes 4 campos ficam NULL: o dado do
-- instante do envio já não existe em nenhuma fonte (ver bloco acima). A tela
-- mostra "—" nelas em vez de exibir o número do fechamento, que contaria outra
-- história (o "Palmeiras −0,25" de 22/07, enviado como valor positivo, fechou
-- com edge −2,8% — foi por isso que saiu do board).

-- ── 2. Backfill das linhas anteriores a esta migration ───────
-- Derivado do bet_description à mão: o mart já não tem o pick do 1492294, então
-- não há de onde puxar por join. Chave usada: (sent_date, fixture_id) — única em
-- todas elas. Guardado por `market is null` pra ser idempotente e nunca
-- sobrescrever o que o envio gravar daqui pra frente.
-- São 6 linhas em prod e 8 em staging (as duas de 13/07 e 19/07 só existem lá;
-- em prod esses UPDATEs não casam com nada e viram no-op).
--
-- Convenção da linha (ótica do mandante), conferida contra o placar real:
--   1520781 Avai 2×1 America   · Menos de 2,25   → Under  2.25  (total 3  → red)
--   1492294 Coritiba 1×3 Palm. · Palmeiras −0,25 → Away  +0.25  (diff −2 → GREEN)
--   1520783 Ceara 0×1 CRB      · Ceara −1,5      → Home  −1.5   (diff −1 → red)
--   1520796 Londrina 1×4 Novo. · Novorizontino +0,5 → Away −0.5 (diff −3 → GREEN)
--   1520795 Juventude × Avai   · Menos de 2,25   → Under  2.25  (jogo do dia)
--   1547787 Tigre × Nacional   · Menos de 2,25   → Under  2.25  (jogo do dia)
--   1581821 Spain × Belgium    · Vitória: Spain  → Home   (só staging)
--   1591866 Spain × Argentina  · Vitória: Spain  → Home   (só staging)
UPDATE public.daily_opportunity_picks SET market = 'match_winner', outcome = 'Home'
  WHERE market IS NULL AND sent_date = '2026-07-13' AND fixture_id = 1581821;
UPDATE public.daily_opportunity_picks SET market = 'match_winner', outcome = 'Home'
  WHERE market IS NULL AND sent_date = '2026-07-19' AND fixture_id = 1591866;
UPDATE public.daily_opportunity_picks SET market = 'goals_over_under', outcome = 'Under', line_value = 2.25
  WHERE market IS NULL AND sent_date = '2026-07-21' AND fixture_id = 1520781;
UPDATE public.daily_opportunity_picks SET market = 'asian_handicap', outcome = 'Away', line_value = 0.25
  WHERE market IS NULL AND sent_date = '2026-07-22' AND fixture_id = 1492294;
UPDATE public.daily_opportunity_picks SET market = 'asian_handicap', outcome = 'Home', line_value = -1.5
  WHERE market IS NULL AND sent_date = '2026-07-22' AND fixture_id = 1520783;
UPDATE public.daily_opportunity_picks SET market = 'asian_handicap', outcome = 'Away', line_value = -0.5
  WHERE market IS NULL AND sent_date = '2026-07-26' AND fixture_id = 1520796;
UPDATE public.daily_opportunity_picks SET market = 'goals_over_under', outcome = 'Under', line_value = 2.25
  WHERE market IS NULL AND sent_date = '2026-07-28' AND fixture_id = 1520795;
UPDATE public.daily_opportunity_picks SET market = 'goals_over_under', outcome = 'Under', line_value = 2.25
  WHERE market IS NULL AND sent_date = '2026-07-28' AND fixture_id = 1547787;

-- ── 3. RPC: o que foi alertado ───────────────────────────────
-- A tabela é service_role-only (RLS sem policy), então o front lê por aqui.
-- Sem gate de assinatura de propósito: o histórico com resultado já é visível
-- pra quem não assina (é a prova de entrega), igual ao resto da tela.
--
-- p_day null = todos os dias da janela (90d). É assim que o front usa: são
-- poucas linhas (1 a 3 picks por dia) e ele precisa saber QUAIS dias tiveram
-- alerta pra montar o seletor de dias. Isso importa porque o mart é
-- full-refresh e joga dias antigos fora — o 22/07, por exemplo, já não tem
-- nenhuma linha lá, e sem isto o dia do "Palmeiras −0,25" ficaria inalcançável.
CREATE OR REPLACE FUNCTION public.get_futebol_alerted_picks(p_day date DEFAULT NULL)
RETURNS TABLE(
  game_day              date,
  fixture_id            bigint,
  market                text,
  outcome               text,
  line_value            double precision,
  bet_description       text,
  betting_market        text,
  league                text,
  match_description     text,
  odds                  numeric,
  janela_usada          text,
  score                 integer,
  faixa                 text,
  edge                  double precision,
  prob_justa_fechamento double precision,
  sent_at               timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select coalesce((p.match_date at time zone 'America/Sao_Paulo')::date, p.sent_date) as game_day,
         p.fixture_id, p.market, p.outcome, p.line_value,
         p.bet_description, p.betting_market, p.league, p.match_description, p.odds,
         p.janela_usada, p.score, p.faixa, p.edge, p.prob_justa_fechamento, p.created_at
  from public.daily_opportunity_picks p
  where p.sport = 'Futebol'
    and coalesce((p.match_date at time zone 'America/Sao_Paulo')::date, p.sent_date)
        >= (now() at time zone 'America/Sao_Paulo')::date - 90
    and (p_day is null
         or coalesce((p.match_date at time zone 'America/Sao_Paulo')::date, p.sent_date) = p_day)
  order by game_day, p.created_at;
$function$;

COMMENT ON FUNCTION public.get_futebol_alerted_picks(date) IS
  'Picks do daily de oportunidades enviados nos últimos 90 dias (dia do JOGO, fuso BRT). p_day null = todos. Fonte do selo "enviado no Telegram" e do pick que saiu do board no histórico da tela de Oportunidades.';

GRANT EXECUTE ON FUNCTION public.get_futebol_alerted_picks(date) TO anon, authenticated, service_role;
