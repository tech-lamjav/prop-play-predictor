-- ============================================================================
-- 152 — o placar fresco, para o painel parar de amanhecer sem resultado
-- ============================================================================
-- O QUE FOI MEDIDO, em 18/09/2026:
--
-- O painel mostrava "10 de 19 sem resultado" no dia anterior. As 19 vinham de
-- DOIS jogos, os dois presos em `2H` onze horas depois de terem acabado —
-- Atlético Torque × Cienciano e Flamengo × Independiente del Valle.
--
-- A causa são duas fontes para o mesmo fato:
--
--   · `public.fixtures` é do COLETOR, que pergunta o placar de 2 em 2 minutos
--     enquanto o jogo rola. Ali o Flamengo já estava `FT` com 1×1 na hora.
--   · `futebol.fact_fixtures` é o ESPELHO, carregado pelo pipeline de analytics.
--     Ali ele seguia em segundo tempo — e é o espelho que todas as RPCs do
--     painel leem.
--
-- Entre o jogo acabar de madrugada e o espelho recarregar, o assinante vê a
-- oportunidade sem resultado. Era isso que o PM via toda manhã.
--
-- ⚠️ POR QUE UMA FUNÇÃO NOVA, E NÃO MEXER NAS QUATRO QUE JÁ EXISTEM.
-- Status e placar aparecem em `get_futebol_value_board`, `get_futebol_value_history`,
-- `get_futebol_fixtures` e `get_futebol_fixtures_by_day`. Reescrever o corpo das
-- quatro — que vivem no DDL manual — é o tipo de mudança em que se ressuscita
-- uma versão antiga por engano. Esta função ACRESCENTA uma leitura pequena e
-- deixa as quatro como estão: a tela pede o placar fresco dos jogos que ela já
-- tem na mão e sobrepõe o que o espelho deu.
--
-- ⚠️ O ESPELHO CONTINUA SENDO A FOTO DO APITO, e isso não muda. O que esta
-- função devolve é FATO de jogo encerrado: placar final e status terminal. Nota,
-- faixa e vantagem — o que é leitura point-in-time — seguem vindo de lá.
--
-- ⚠️ SÓ JOGO ENCERRADO. Jogo em andamento não entra: o painel não liquida com
-- placar parcial, e devolver `2H` com 1×0 convidaria exatamente isso.
--
-- Não resolve sozinha o caso do Torque: a Sul-Americana está com `enabled =
-- false` em `leagues_config`, então o coletor nem acompanha aquele jogo e não
-- existe placar fresco para ele em lugar nenhum. Ligar as competições que o
-- painel publica é a outra metade, e é decisão de produto — está escrita na
-- issue, não aqui.
-- ============================================================================

create or replace function public.get_futebol_placar_fresco(p_fixture_ids bigint[])
returns table(
  fixture_id   bigint,
  status_short text,
  goals_home   integer,
  goals_away   integer
)
language sql
stable
security definer
set search_path to ''
as $function$
  select f.fixture_id, f.status_short, f.goals_home, f.goals_away
    from public.fixtures f
   where f.fixture_id = any(p_fixture_ids)
     -- Terminal, e nada além disso. `PST`, `CANC` e companhia também são fim de
     -- linha, mas não têm placar para liquidar: a tela já sabe dizer "adiado".
     and f.status_short in ('FT', 'AET', 'PEN')
     and f.goals_home is not null
     and f.goals_away is not null;
$function$;

comment on function public.get_futebol_placar_fresco(bigint[]) is
  'Placar final dos jogos que o coletor já fechou, para a tela não esperar o espelho recarregar. Só status terminal com placar; o resto vem do espelho, que segue sendo a foto do apito.';

revoke execute on function public.get_futebol_placar_fresco(bigint[]) from public;
-- No Supabase o schema public dá EXECUTE explícito a anon e authenticated em toda
-- função nova (privilégio padrão), e o revoke de PUBLIC não tira isso (issue #408).
revoke execute on function public.get_futebol_placar_fresco(bigint[]) from anon, authenticated;
-- Quem chama é o navegador do assinante, como nas outras RPCs do painel.
grant execute on function public.get_futebol_placar_fresco(bigint[]) to anon, authenticated, service_role;
