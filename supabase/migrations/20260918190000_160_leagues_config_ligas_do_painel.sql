-- ============================================================================
-- 160 — as competições que o painel publica entram no coletor
-- ============================================================================
-- Issue #478. Registra no repositório uma decisão que já foi aplicada à mão em
-- PRODUÇÃO em 18/09/2026: ali estas oito linhas já estão `true`, e esta
-- migration é inócua. Ela existe pelos outros dois ambientes.
--
-- O QUE ESTAVA ERRADO
--
-- O seed da 082 deixou estas ligas desligadas de propósito, cada uma com a data
-- do próprio retorno escrita ao lado — "volta 15/08", "volta 22/08",
-- "volta 16/09". O comentário acima delas dizia: "as demais viram true na data
-- de retorno". As datas passaram e ninguém voltou. Não era trade-off de custo;
-- era um passo de implantação que ficou pela metade.
--
-- ⚠️ UMA DELAS TINHA CONDIÇÃO, E NÃO DATA. A Copa Sul-Americana (11) veio com
-- "volta 15/07 → habilitar quando odds cobrirem". A condição foi verificada
-- antes de ligar, e não presumida: o painel publica oportunidade dela há
-- semanas, com odd e Score — em 17/09 o Atlético Torque × Cienciano saiu no
-- daily com sete saídas, e a Atlético-MG × Santos, do dia 16, com cinco. As
-- odds cobrem.
--
-- E o painel PUBLICA oportunidade destas competições: elas aparecem na lista,
-- vão para o Telegram e entram no Placar da Metodologia. O coletor é que não as
-- acompanhava. Publicávamos aposta de jogo que não observávamos até o fim, e
-- isso cobrava em dois lugares:
--
--   · `public.fixtures` não tinha a partida, então a RPC do placar fresco
--     (migration 152) não tinha o que devolver e a oportunidade amanhecia sem
--     resultado na tela — o caso do Atlético Torque × Cienciano de 17/09;
--   · `notify-settlement` filtra por liga habilitada, então nestas oito o bot
--     NUNCA mandou a mensagem de liquidação. O assinante recebia a aposta e
--     nunca recebia o "deu green".
--
-- O CUSTO, MEDIDO ANTES DE LIGAR
--
-- O poll ao vivo é UMA chamada para todas as ligas juntas (`/fixtures?live=`
-- com os ids concatenados), e o cron de 2 em 2 minutos só dispara quando existe
-- jogo em janela de liga habilitada. O que cresce é o calendário diário: 1
-- chamada por liga, uma vez por dia, de cinco para treze.
--
-- ⚠️ SÓ A TEMPORADA 2026, que é a do seed da 082. Ligar por `league_id` sozinho
-- acenderia temporada que ninguém decidiu ligar — e a decisão aqui é sobre o
-- que o painel publica HOJE.
--
-- ⚠️ DEPOIS DE APLICAR, O CALENDÁRIO PRECISA RODAR. Habilitar só coloca a liga
-- na lista: quem popula `public.fixtures` é o `ingest-fixtures?mode=calendar`,
-- às 04:00 BRT. E o poll ao vivo não cobre a lacuna, porque o cron dele só
-- dispara se JÁ existe jogo em janela na tabela. Em produção isso foi resolvido
-- disparando o calendário à mão; nos outros ambientes, ou se espera a próxima
-- execução, ou se dispara igual:
--
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets
--              where name = 'ingest_fixtures_url') || '?mode=calendar',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
--                          where name = 'ingest_fixtures_cron_secret')),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 120000);
-- ============================================================================

-- ⚠️ E ELA GRITA SE NÃO ACHAR NINGUÉM. O `season = 2026` vem do seed; num
-- ambiente que já tenha virado a temporada, o `where` não casa com nada e a
-- migration passaria VERDE sem ligar liga nenhuma — o mesmo silêncio que deixou
-- estas oito desligadas por um mês. Zero linha é erro, e o deploy para.
do $$
declare
  ligadas integer;
begin
  update public.leagues_config
     set enabled = true
   where season = 2026
     and league_id in (
       2,    -- UEFA Champions League
       39,   -- Premier League (ENG)
       140,  -- La Liga (ESP)
       11,   -- Copa Sul-Americana
       135,  -- Serie A (ITA)
       78,   -- Bundesliga (ALE)
       61,   -- Ligue 1 (FRA)
       94    -- Primeira Liga (POR)
     );

  get diagnostics ligadas = row_count;

  if ligadas = 0 then
    raise exception
      'leagues_config: nenhuma das oito ligas existe na temporada 2026. A temporada virou? Confira `select league_id, season, enabled from public.leagues_config order by season desc` e refaça esta migration com a temporada certa.';
  end if;

  raise notice 'leagues_config: % linha(s) habilitada(s) na temporada 2026.', ligadas;
end
$$;
