-- ============================================================
-- 084_opportunity_bet_logging — registrar aposta da "oportunidade do dia"
-- ============================================================
-- Item 15 do Marco 1: o daily de oportunidades (notify-opportunities) ganha,
-- por pick, um botão "📋 Registrar no Betinho". Um toque cria a aposta pendente
-- — fechando o loop Análise → Betinho → auto-liquidação, sem digitar nada.
--
-- O bot já sabe o pick (jogo/mercado/odd) e quem tocou; o único dado que falta
-- é o STAKE. Resolvido por BOTÕES (decisão de produto 10/07): [1 unidade]
-- [½ unidade] [Outro valor]. "Outro valor" usa force_reply do Telegram — a
-- resposta vem AMARRADA à pergunta (stake_prompts), então o webhook a
-- interpreta como valor daquele pick, e NÃO cai no fluxo de "extrair aposta
-- nova" (evita o textão de ajuda). Sem orquestrador de estado conversacional.
--
-- 083 (onboarding) e 084 (knockout_score_basis) já ocupadas → esta é a 085.
-- ============================================================

-- Picks oferecidos no daily (referenciados pelo callback_data regbet:<id>).
-- Compartilhados entre usuários (o daily manda os mesmos top-3 pra todos), então
-- 1 linha por pick por dia — upsert idempotente por (dia, jogo, aposta).
CREATE TABLE IF NOT EXISTS public.daily_opportunity_picks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_date         date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  fixture_id        bigint,
  sport             text NOT NULL DEFAULT 'Futebol',
  league            text,
  betting_market    text,
  match_description text NOT NULL,
  bet_description   text NOT NULL,
  odds              numeric NOT NULL,
  match_date        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sent_date, fixture_id, bet_description)
);
COMMENT ON TABLE public.daily_opportunity_picks IS
  'Picks do daily de oportunidades, referenciados pelo botão "Registrar no Betinho" (callback regbet:<id>).';
ALTER TABLE public.daily_opportunity_picks ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role (edge functions)

-- Mapa force_reply → pick: quando o bot pergunta "quanto?" (Outro valor),
-- guarda a mensagem da pergunta; a resposta do usuário chega como reply a ela.
CREATE TABLE IF NOT EXISTS public.stake_prompts (
  chat_id    text NOT NULL,
  message_id bigint NOT NULL,
  pick_id    uuid NOT NULL REFERENCES public.daily_opportunity_picks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, message_id)
);
COMMENT ON TABLE public.stake_prompts IS
  'Amarra a resposta de force_reply ("quanto?") ao pick, pra o webhook não tratar o valor como aposta nova.';
ALTER TABLE public.stake_prompts ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role
