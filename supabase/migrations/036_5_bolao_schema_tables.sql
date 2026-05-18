-- ============================================================
-- BOLÃO COPA 2026 — Schema baseline (1/5): tabelas + indexes
-- ============================================================
-- Formaliza no repo o schema criado manualmente em staging via SQL Editor.
-- Em staging (já existe): CREATE TABLE IF NOT EXISTS pula sem efeito.
-- Em prod virgem: cria do zero.
--
-- Ordem das migrations 036_5 -> 036_9 (sub-grupo da baseline):
--   036_5 tabelas + indexes      (este)
--   036_6 RPCs auxiliares        (precisa rodar antes do RLS)
--   036_7 RLS + policies         (depende de get_user_bolao_ids)
--   036_8 RPCs principais        (24 funções de negócio)
--   036_9 seed wc_matches        (104 partidas)
--
-- Depois disso, 037+ aplica normalmente as alterações incrementais.
-- ============================================================

-- ─── Sequences ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.wc_matches_id_seq;

-- ─── Tabelas ────────────────────────────────────────────────

-- wc_matches: 104 partidas da Copa (independente do bolão; uma cópia global)
CREATE TABLE IF NOT EXISTS public.wc_matches (
  id integer PRIMARY KEY DEFAULT nextval('public.wc_matches_id_seq'),
  match_number integer NOT NULL,
  stage text NOT NULL DEFAULT 'group',
  group_name text,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_team_code text NOT NULL,
  away_team_code text NOT NULL,
  match_date date NOT NULL,
  match_time_brasilia time NOT NULL,
  venue text,
  city text,
  home_score integer,
  away_score integer,
  is_finished boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.wc_matches_id_seq OWNED BY public.wc_matches.id;

-- boloes: instância do bolão (1 dono, N membros)
CREATE TABLE IF NOT EXISTS public.boloes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  invite_code text NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  max_participants integer NOT NULL DEFAULT 20,
  is_premium boolean NOT NULL DEFAULT false,
  scoring_exact integer NOT NULL DEFAULT 3,
  scoring_result integer NOT NULL DEFAULT 1,
  scoring_preset text,
  custom_color text,
  custom_banner_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_closed boolean NOT NULL DEFAULT false,
  champion_enabled boolean NOT NULL DEFAULT true,
  special_predictions_enabled boolean NOT NULL DEFAULT true,
  champion_points integer NOT NULL DEFAULT 10,
  special_predictions_config jsonb NOT NULL DEFAULT
    '{"finalist": true, "round_of_32": true, "semifinalist": true, "quarterfinalist": true}'::jsonb,
  special_predictions_points jsonb NOT NULL DEFAULT
    '{"finalist": 10, "round_of_32": 1, "semifinalist": 5, "quarterfinalist": 3}'::jsonb,
  scoring_weights jsonb,
  prediction_deadline_mode text NOT NULL DEFAULT 'per_round',
  CONSTRAINT boloes_prediction_deadline_mode_check
    CHECK (prediction_deadline_mode = ANY (
      ARRAY['per_match','per_day','per_round','per_stage','tournament_start']
    ))
);

-- bolao_members: relação N:N entre boloes e users
CREATE TABLE IF NOT EXISTS public.bolao_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bolao_id, user_id)
);

-- bolao_predictions: palpite de placar por partida
CREATE TABLE IF NOT EXISTS public.bolao_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id integer NOT NULL REFERENCES public.wc_matches(id) ON DELETE CASCADE,
  predicted_home_score integer NOT NULL,
  predicted_away_score integer NOT NULL,
  points_earned integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bolao_id, user_id, match_id)
);

-- bolao_special_predictions: campeão / finalistas / semis / quartas / R32
CREATE TABLE IF NOT EXISTS public.bolao_special_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction_type text NOT NULL,
  predicted_team_code text NOT NULL,
  points_earned integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bolao_special_predictions_prediction_type_check
    CHECK (prediction_type = ANY (
      ARRAY['champion','finalist','semifinalist','quarterfinalist','round_of_32']
    )),
  CONSTRAINT bolao_special_predictions_unique
    UNIQUE (bolao_id, user_id, prediction_type, predicted_team_code)
);

-- bolao_insights: cravou solo, contra a maré, streak, etc.
CREATE TABLE IF NOT EXISTS public.bolao_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id integer REFERENCES public.wc_matches(id) ON DELETE SET NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- bolao_subscriptions: Stripe Premium (FK ON DELETE SET NULL preserva histórico contábil)
CREATE TABLE IF NOT EXISTS public.bolao_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bolao_id uuid REFERENCES public.boloes(id) ON DELETE SET NULL,
  type text NOT NULL,
  stripe_session_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- ─── Indexes ────────────────────────────────────────────────

-- bolao_insights
CREATE INDEX IF NOT EXISTS idx_bolao_insights_bolao
  ON public.bolao_insights USING btree (bolao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bolao_insights_user_unseen
  ON public.bolao_insights USING btree (user_id, seen, created_at DESC);

-- bolao_members
CREATE INDEX IF NOT EXISTS idx_bolao_members_bolao
  ON public.bolao_members USING btree (bolao_id);
CREATE INDEX IF NOT EXISTS idx_bolao_members_user
  ON public.bolao_members USING btree (user_id);

-- bolao_predictions
CREATE INDEX IF NOT EXISTS idx_bolao_predictions_bolao
  ON public.bolao_predictions USING btree (bolao_id);
CREATE INDEX IF NOT EXISTS idx_bolao_predictions_match
  ON public.bolao_predictions USING btree (match_id);
CREATE INDEX IF NOT EXISTS idx_bolao_predictions_user
  ON public.bolao_predictions USING btree (user_id);

-- bolao_subscriptions
CREATE INDEX IF NOT EXISTS idx_bolao_subscriptions_bolao
  ON public.bolao_subscriptions USING btree (bolao_id)
  WHERE (bolao_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_bolao_subscriptions_user
  ON public.bolao_subscriptions USING btree (user_id);

-- boloes
CREATE INDEX IF NOT EXISTS idx_boloes_invite_code
  ON public.boloes USING btree (invite_code);
CREATE INDEX IF NOT EXISTS idx_boloes_owner
  ON public.boloes USING btree (owner_id);

-- wc_matches
CREATE INDEX IF NOT EXISTS idx_wc_matches_date
  ON public.wc_matches USING btree (match_date);
CREATE INDEX IF NOT EXISTS idx_wc_matches_group
  ON public.wc_matches USING btree (group_name)
  WHERE (group_name IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_wc_matches_stage
  ON public.wc_matches USING btree (stage);
