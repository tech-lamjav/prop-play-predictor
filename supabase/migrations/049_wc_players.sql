-- ============================================================
-- wc_players — elencos da Copa (dados de referência globais)
-- ============================================================
-- Populada pela ingestão de squads da API-Sports (edge function ingest-wc-squads).
-- Base pros palpites de jogador (artilheiro/goleiro/craque/revelação).
--
-- birth_date vem do endpoint players/profiles (NÃO do squads, que só dá age) —
-- por isso é nullable; é enriquecido num 2º passo e só é essencial pro filtro de
-- elegibilidade do Melhor Jovem (nascidos >= 2005-01-01, a confirmar).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wc_players (
  player_id    bigint PRIMARY KEY,                 -- id da API-Sports
  player_name  text NOT NULL,
  api_team_id  integer NOT NULL REFERENCES public.wc_team_map(api_team_id),
  team_code    text NOT NULL,                      -- nosso código (denormalizado, via wc_team_map)
  position     text,                               -- Goalkeeper/Defender/Midfielder/Attacker
  shirt_number integer,
  birth_date   date,                               -- nullable até enriquecer via profiles
  photo_url    text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wc_players_team_code_idx ON public.wc_players (team_code);
CREATE INDEX IF NOT EXISTS wc_players_position_idx  ON public.wc_players (position);

ALTER TABLE public.wc_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_players_public_read" ON public.wc_players;
CREATE POLICY "wc_players_public_read" ON public.wc_players
  FOR SELECT USING (true);
-- Escrita: só service_role (ingestão). Sem policy de write = bloqueado p/ authenticated/anon.
