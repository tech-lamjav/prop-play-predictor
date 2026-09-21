-- ============================================================================
-- 166 — a UEFA Nations League entra no coletor
-- ============================================================================
-- Issue #505. A competição estreia em 24/09/2026 às 18:45 UTC, corre até
-- 17/11 e depois fica dormente até março de 2027. Id 5 na API-Football, slug
-- `nations_league` no mart.
--
-- ⚠️ POR QUE 166, E NÃO 165. O número 165 está tomado pela branch do PR #501
-- (`fix/jogo-em-andamento-fala-o-mesmo`), que foi FECHADO sem mesclar e cuja
-- branch sobreviveu. A migration de lá não está na develop nem na main, então
-- o número está livre na prática — mas basta alguém ressuscitar aquela branch
-- para o deploy morrer com chave duplicada em `schema_migrations_pkey`, que é
-- por carimbo e por número. Pular um número custa nada; a colisão custa um
-- deploy inteiro, e já custou.
--
-- O QUE ESTA LINHA DESTRAVA
--
-- `public.leagues_config` é dado, não código: é ela que decide o que o coletor
-- multi-liga varre. Sem a linha, três coisas não acontecem para os jogos da
-- Nations League:
--
--   · o calendário diário não busca as partidas, então `public.fixtures` fica
--     sem elas — e sem fixture não há horário nem placar;
--   · o poll ao vivo não as acompanha, porque o cron de 2 em 2 minutos só
--     dispara se existe jogo em janela de liga HABILITADA;
--   · o `notify-settlement` filtra por liga habilitada (o mesmo caso que a 160
--     consertou para outras oito): o assinante receberia a aposta e NUNCA
--     receberia o "deu green".
--
-- ⚠️ A GUARDA AQUI NÃO É A DA 160, DE PROPÓSITO. Lá a migration era um UPDATE e
-- zero linha afetada significava "não achei ninguém", que é erro. Aqui é um
-- INSERT com `on conflict do nothing`, e zero linha inserida significa "a linha
-- já existe" — que é SUCESSO, não falha. Copiar aquela guarda ao pé da letra
-- criaria uma reprovação falsa no dia em que alguém tivesse inserido à mão.
-- Então o que se afirma no fim é o ESTADO desejado: a linha existe e está
-- habilitada. É isso que importa, e não quantas linhas este comando escreveu.
--
-- ⚠️ DEPOIS DE APLICAR, O CALENDÁRIO PRECISA RODAR — mesma pegadinha da 160.
-- Habilitar só coloca a liga na lista; quem popula `public.fixtures` é o
-- `ingest-fixtures?mode=calendar`, às 04:00 BRT. E o poll ao vivo não cobre a
-- lacuna, porque ele só dispara se JÁ existe jogo em janela na tabela. Com a
-- estreia em 24/09, esperar a execução automática é apertado: ou se dispara à
-- mão, ou se confere que a de 04:00 rodou antes do dia do jogo.
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
--
-- SÓ A TEMPORADA 2026, que é a do seed da 082 e a da estreia. A chave da tabela
-- é (league_id, season): ligar por id sozinho acenderia temporada que ninguém
-- decidiu ligar.
--
-- Os amistosos de seleção (league_id 10) são trabalho separado e ficam de fora,
-- como a #505 pede explicitamente.
-- ============================================================================

insert into public.leagues_config (league_id, season, name, enabled) values
  (5, 2026, 'UEFA Nations League', true)
on conflict (league_id, season) do nothing;

do $$
declare
  ligada boolean;
begin
  select enabled into ligada
    from public.leagues_config
   where league_id = 5 and season = 2026;

  if ligada is null then
    raise exception
      'leagues_config: a linha da Nations League (5, 2026) não existe depois do insert. A temporada virou? Confira `select league_id, season, enabled from public.leagues_config order by season desc` e refaça esta migration com a temporada certa.';
  end if;

  if not ligada then
    raise exception
      'leagues_config: a linha da Nations League (5, 2026) existe mas está DESABILITADA. Alguém a inseriu antes com enabled=false, e o `on conflict do nothing` respeitou. Ligue à mão e reaplique: `update public.leagues_config set enabled = true where league_id = 5 and season = 2026`.';
  end if;

  raise notice 'leagues_config: Nations League (5, 2026) habilitada.';
end
$$;
