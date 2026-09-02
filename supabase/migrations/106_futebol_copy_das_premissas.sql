-- ============================================================================
-- 106 · A copy das premissas passa a ter uma fonte só
-- ============================================================================
-- Spec: tech-lamjav/prop-play-predictor#272
--
-- O QUE MOTIVOU
-- Uma DM de oportunidade anunciou um Handicap +0,5 com o motivo "Raramente perde
-- por 2 gols ou mais". Num +0,5 a aposta morre em QUALQUER derrota, então a margem
-- da derrota não responde nada.
--
-- Medido antes de decidir: a premissa em si funciona. Gradada contra o placar dos
-- 90 minutos, no lado azarão, ela separa em todas as linhas de meio gol (inclusive
-- +0,5), e o efeito sobrevive ao controle por faixa de odd acima de 1,30. Ela é um
-- atalho para solidez defensiva. Logo o defeito era a FRASE, não o cálculo.
--
-- Ao investigar, três defeitos de apresentação, todos medidos no dev:
--   · 27 de 36 premissas tinham texto DIFERENTE entre a tela e a DM
--   · a DM mostrava a evidência mais fraca: 12.736 linhas de azarão exibiam a
--     premissa de 3 pontos tendo a de 10 disponível, porque ela imprime o primeiro
--     item do array e a ordem era a ordem em que o SQL foi escrito
--   · a DM mostrava a `favorito_irregular` em 4.268 linhas, e a tela esconde essa
--     premissa de propósito (acende em 43% das linhas e vale zero ponto)
--   · seis frases visíveis tinham travessão, que a régua de copy do produto proíbe
--
-- NADA DE NOTA MUDA AQUI. Nenhuma premissa é criada, removida ou repesada, e nenhum
-- ponto se move. É tudo texto e ordem de exibição, e é essa fronteira que permite
-- subir isto em paralelo ao redesenho do Score (task [A]).
--
-- O QUE MAIS ESTA MIGRATION ENCERRA
-- Estas três funções não tinham definição verbatim em migration nenhuma: a 099, a
-- 104 e a 105 liam a definição VIVA com `pg_get_functiondef` e a patcheavam por
-- substituição de string. A 099 até registra o risco: "o corpo muda quando a A1 do
-- Score mexer nele". A partir daqui as três nascem do repositório, e o corpo delas
-- veio do `docs/futebol-prod-deploy.sql`, conferido rótulo por rótulo contra o
-- banco de desenvolvimento em 20/08 (39 rótulos, mesma ordem, nas três).
--
-- `create or replace` e não `drop`: nenhuma assinatura muda, então os grants
-- existentes sobrevivem e o front não precisa de deploy sincronizado.
--
-- COMO CONFERIR DEPOIS DE APLICAR (seção 8 do shape file tem o mesmo)
--   select public.futebol_copy('evidencia', 'asian_handicap', 'away',
--            '{"raramente_perde_por_2":"true","defesa_fora_solida":"true"}'::jsonb);
--   -- espera: {"Defesa sólida jogando fora","Quando perde, perde apertado"}
--   -- (a de 10 pontos primeiro; era exatamente o que estava invertido)
--
--   select count(*) from public.futebol_premissa_copy;  -- espera 103
-- ============================================================================

-- ── A copy das premissas, uma vez só ────────────────────────────────────────
-- Antes desta tabela, o texto de cada premissa existia em DUAS fontes
-- independentes: o catálogo do app (`src/utils/futebol-premissas.ts`), que serve a
-- tela, e a cascata de `case when` dentro destas três RPCs, que serve a DM do
-- Telegram. Medido em 20/08: de 36 premissas presentes nas duas, 27 tinham TEXTO
-- DIFERENTE. Ninguém viu porque nada comparava as duas.
--
-- E a cascata era a TERCEIRA cópia verbatim de si mesma, como o comentário da
-- migration 102 já registrava: "mercado novo agora mexe em três RPCs".
--
-- Agora o catálogo do app é a fonte, esta tabela é a projeção dele no banco, e a
-- guarda `futebol-copy-paridade.test.ts` quebra o PR quando os dois se afastam.
create table if not exists public.futebol_premissa_copy (
  tipo   text    not null check (tipo in ('evidencia', 'contra', 'aviso')),
  market text    not null,
  slug   text    not null,
  -- 'any' é o texto neutro; 'home'/'away' só existem onde a frase muda de verdade.
  mando  text    not null check (mando in ('any', 'home', 'away')),
  -- Posição na fila. É o que conserta o defeito de origem: a DM mostra o PRIMEIRO
  -- item do array, e a ordem da cascata era a ordem em que ela foi escrita. No
  -- azarão do handicap, 12.736 linhas mostravam a premissa de 3 pontos tendo a de
  -- 10 pontos disponível.
  ordem  integer not null,
  texto  text    not null,
  primary key (tipo, market, slug, mando)
);

-- RLS ligada e SEM policy, de propósito: nada acessa esta tabela direto. As três
-- RPCs são SECURITY DEFINER e leem como dono, então a ausência de policy é o que
-- garante que ninguém leia por fora.
alter table public.futebol_premissa_copy enable row level security;

-- Travessão é proibido em copy visível (régua do produto), e cinco dos oito avisos
-- nasceram com um. A regra vira constraint porque regra que depende de alguém ler
-- não é regra.
alter table public.futebol_premissa_copy drop constraint if exists futebol_premissa_copy_sem_travessao;
alter table public.futebol_premissa_copy add  constraint futebol_premissa_copy_sem_travessao
  check (texto not like '%' || chr(8212) || '%' and texto not like '%' || chr(8211) || '%');

-- Semente idempotente: a tabela é uma projeção do catálogo, então ela é reescrita
-- inteira em vez de sofrer upsert linha por linha. Assim premissa REMOVIDA do
-- catálogo também desaparece daqui.
delete from public.futebol_premissa_copy;
insert into public.futebol_premissa_copy (tipo, market, slug, mando, ordem, texto) values
  ('evidencia', 'goals_over_under', 'defesas_firmes', 'any', 1, 'Defesas firmes dos dois lados'),
  ('evidencia', 'goals_over_under', 'defesas_vazaveis', 'any', 2, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'goals_over_under', 'ataque_combinado', 'any', 3, 'Os dois somam muitos gols'),
  ('evidencia', 'goals_over_under', 'xg_baixo_combinado', 'any', 4, 'Os dois criam pouca chance de gol'),
  ('evidencia', 'goals_over_under', 'xg_combinado_alto', 'any', 5, 'Os dois criam muita chance de gol'),
  ('evidencia', 'goals_over_under', 'clean_sheets_altos', 'any', 6, 'Os dois passam muitos jogos sem sofrer gol'),
  ('evidencia', 'goals_over_under', 'corroboracao_ambos', 'any', 7, 'As principais casas e o modelo da API apontam o mesmo lado'),
  ('evidencia', 'goals_over_under', 'linha_sharp_confirma', 'any', 8, 'As principais casas vêm baixando a odd desse lado'),
  ('evidencia', 'goals_over_under', 'ataques_fracos', 'any', 9, 'Ataques fracos dos dois lados'),
  ('evidencia', 'goals_over_under', 'historico_under', 'any', 10, 'Histórico de jogo com poucos gols'),
  ('evidencia', 'goals_over_under', 'ambos_vazam', 'any', 11, 'Os dois sofrem gol quase todo jogo'),
  ('evidencia', 'goals_over_under', 'ritmo_alto', 'any', 12, 'Jogo de ritmo alto'),
  ('evidencia', 'goals_over_under', 'historico_over', 'any', 13, 'Histórico de jogo com muitos gols'),
  ('evidencia', 'goals_over_under', 'linha_subindo', 'any', 14, 'Mercado puxando a linha pra cima'),
  ('evidencia', 'goals_over_under', 'linha_descendo', 'any', 15, 'Mercado puxando a linha pra baixo'),
  ('evidencia', 'goals_over_under', 'modelo_api_concorda', 'any', 16, 'Modelo da API concorda com esse lado'),
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
  ('evidencia', 'match_winner', 'corroboracao_ambos', 'any', 4, 'As principais casas e o modelo da API apontam o mesmo lado'),
  ('evidencia', 'match_winner', 'linha_sharp_confirma', 'any', 5, 'As principais casas vêm baixando a odd desse lado'),
  ('evidencia', 'match_winner', 'forca_mismatch', 'any', 6, 'Ataque forte contra defesa frágil do adversário'),
  ('evidencia', 'match_winner', 'superioridade_xg', 'any', 7, 'Cria mais chances de gol que o adversário'),
  ('evidencia', 'match_winner', 'h2h_favoravel', 'any', 8, 'Leva vantagem no histórico do confronto'),
  ('evidencia', 'match_winner', 'desfalque_adversario', 'any', 9, 'Adversário com desfalque de titular importante'),
  ('evidencia', 'match_winner', 'modelo_api_concorda', 'any', 10, 'Modelo da API concorda com esse lado'),
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
  ('evidencia', 'asian_handicap', 'corroboracao_ambos', 'any', 4, 'As principais casas e o modelo da API apontam o mesmo lado'),
  ('evidencia', 'asian_handicap', 'linha_sharp_confirma', 'any', 5, 'As principais casas vêm baixando a odd desse lado'),
  ('evidencia', 'asian_handicap', 'sem_rodizio', 'any', 6, 'Deve entrar com força máxima'),
  ('evidencia', 'asian_handicap', 'raramente_perde_por_2', 'any', 7, 'Quando perde, perde apertado'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'any', 8, 'Adversário fraco fora de casa'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'away', 8, 'Adversário fraco em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'any', 9, 'Manda muito bem em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'away', 9, 'Vai muito bem fora de casa'),
  ('evidencia', 'asian_handicap', 'modelo_api_concorda', 'any', 10, 'Modelo da API concorda com esse lado'),
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
  ('evidencia', 'btts', 'corroboracao_ambos', 'any', 8, 'As principais casas e o modelo da API apontam o mesmo lado'),
  ('evidencia', 'btts', 'linha_sharp_confirma', 'any', 9, 'As principais casas vêm baixando a odd desse lado'),
  ('evidencia', 'btts', 'modelo_api_concorda', 'any', 10, 'Modelo da API concorda com esse lado'),
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
  ('evidencia', 'double_chance', 'corroboracao_ambos', 'any', 5, 'As principais casas e o modelo da API apontam o mesmo lado'),
  ('evidencia', 'double_chance', 'linha_sharp_confirma', 'any', 6, 'As principais casas vêm baixando a odd desse lado'),
  ('evidencia', 'double_chance', 'modelo_api_concorda', 'any', 7, 'Modelo da API concorda com esse lado'),
  ('contra', 'double_chance', 'lado_coberto_forte', 'any', 1, 'A força do lado coberto não entrou como sinal a favor'),
  ('contra', 'double_chance', 'adversario_limitado', 'any', 2, 'A campanha do adversário não entrou como sinal a favor'),
  ('aviso', 'double_chance', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'double_chance', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'double_chance', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'double_chance', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco');

-- ── Os dois helpers ─────────────────────────────────────────────────────────
-- Junta num objeto só tudo que pode acender numa linha, e resolve a precedência da
-- corroboração.
--
-- O nome da coluna booleana nas tabelas de premissa É o slug, então não existe
-- cascata de `case when` para escrever: as chaves do jsonb já são os slugs. É por
-- isso que a premissa nova passa a custar uma linha de semente e nada mais.
--
-- A corroboração é o único caso que não é "slug aceso vira texto": são dois sinais
-- e três frases (as duas individuais e uma combinada). As três chaves saem daqui
-- já resolvidas, e por vir DEPOIS no `||` elas vencem as do `v`.
create or replace function public.futebol_flags(
  p_v jsonb, p_p jsonb, p_o jsonb, p_ah jsonb, p_bt jsonb, p_dc jsonb
) returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select coalesce(p_v, '{}'::jsonb)
      || coalesce(p_p, '{}'::jsonb)
      || coalesce(p_o, '{}'::jsonb)
      || coalesce(p_ah, '{}'::jsonb)
      || coalesce(p_bt, '{}'::jsonb)
      || coalesce(p_dc, '{}'::jsonb)
      || jsonb_build_object(
           'corroboracao_ambos',
             coalesce((p_v->>'modelo_api_concorda')::boolean, false)
             and coalesce((p_v->>'linha_sharp_confirma')::boolean, false),
           'modelo_api_concorda',
             coalesce((p_v->>'modelo_api_concorda')::boolean, false)
             and not coalesce((p_v->>'linha_sharp_confirma')::boolean, false),
           'linha_sharp_confirma',
             coalesce((p_v->>'linha_sharp_confirma')::boolean, false)
             and not coalesce((p_v->>'modelo_api_concorda')::boolean, false)
         )
$function$;

-- Traduz as flags acesas para a copy, na ordem certa.
--
-- `contra` procura 'false' em vez de 'true', e é por isso que NULL não gera contra:
-- em jsonb um booleano nulo vira null, que não casa com 'false'. É o mesmo
-- comportamento do `not coalesce(x, true)` que a cascata usava, e continua honrando
-- a ADR 0003 (dado faltante diagnostica, não elimina).
--
-- O `distinct on` com o desempate pelo mando escolhe a variante específica quando
-- ela existe e cai no texto neutro quando não existe.
create or replace function public.futebol_copy(
  p_tipo text, p_market text, p_mando text, p_flags jsonb
) returns text[]
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(array_agg(t.texto order by t.ordem), array[]::text[])
  from (
    select distinct on (c.slug) c.ordem, c.texto
    from public.futebol_premissa_copy c
    join jsonb_each_text(p_flags) f on f.key = c.slug
    where c.tipo = p_tipo
      and c.market = p_market
      and c.mando in ('any', coalesce(p_mando, 'any'))
      and f.value = case when p_tipo = 'contra' then 'false' else 'true' end
    order by c.slug, (c.mando <> 'any') desc
  ) t
$function$;

grant execute on function public.futebol_flags(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.futebol_copy(text, text, text, jsonb) to anon, authenticated, service_role;

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
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_value_board()
 RETURNS TABLE(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, score integer, faixa text, evidencias text[], premissas_sem_dado integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int, v.score::int, v.faixa,
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
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_value_history(p_from date, p_to date)
 RETURNS TABLE(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, score integer, faixa text, evidencias text[], premissas_sem_dado integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with pit as (
    select distinct on (h.opportunity_key)
      h.fixture_id, h.market, h.outcome, h.line_value, h.edge,
      h.best_odd, h.best_book, h.avg_odd, h.n_casas, h.janela_usada,
      h.prob_justa_fechamento, h.pts_valor, h.pts_premissas, h.pts_corroboracao,
      h.penalidades, h.score, h.faixa,
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
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int, v.score::int, v.faixa,
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
$function$

;
