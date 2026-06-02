-- ============================================================
-- wc_team_map — de↔para entre o team id da API-Sports e o nosso team_code
-- ============================================================
-- A ingestão (placar via fixtures, elencos via squads) recebe da API-Sports um
-- team id NUMÉRICO. O nosso `wc_matches`/`wc_players` usa código FIFA de 3 letras
-- em português (ESP, JPN, NED...). Os códigos de 3 letras DA API não servem como
-- chave: divergem dos nossos (Spain=SPA, Japan=JAP) e ainda colidem (Australia e
-- Austria ambos "AUS"; Iran e Iraq ambos "IRA"). Por isso o mapa é por team id.
--
-- Validado em 2026-06-01 contra /teams?league=1&season=2026 (48 seleções) e o
-- nosso seed de wc_matches (48 seleções) — casamento 48/48, sem órfãos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wc_team_map (
  api_team_id integer PRIMARY KEY,
  team_code   text NOT NULL UNIQUE,
  api_name    text NOT NULL          -- nome em inglês da API (referência/debug)
);

ALTER TABLE public.wc_team_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_team_map_public_read" ON public.wc_team_map;
CREATE POLICY "wc_team_map_public_read" ON public.wc_team_map
  FOR SELECT USING (true);
-- Escrita: só service_role (ingestão). Sem policy de write = bloqueado p/ authenticated/anon.

INSERT INTO public.wc_team_map (api_team_id, team_code, api_name) VALUES
  (1532, 'ALG', 'Algeria'),
  (26,   'ARG', 'Argentina'),
  (20,   'AUS', 'Australia'),
  (775,  'AUT', 'Austria'),
  (1,    'BEL', 'Belgium'),
  (1113, 'BIH', 'Bosnia & Herzegovina'),
  (6,    'BRA', 'Brazil'),
  (5529, 'CAN', 'Canada'),
  (1533, 'CPV', 'Cape Verde Islands'),
  (8,    'COL', 'Colombia'),
  (1508, 'COD', 'Congo DR'),
  (3,    'CRO', 'Croatia'),
  (5530, 'CUW', 'Curaçao'),
  (770,  'CZE', 'Czech Republic'),
  (2382, 'ECU', 'Ecuador'),
  (32,   'EGY', 'Egypt'),
  (10,   'ENG', 'England'),
  (2,    'FRA', 'France'),
  (25,   'GER', 'Germany'),
  (1504, 'GHA', 'Ghana'),
  (2386, 'HAI', 'Haiti'),
  (22,   'IRN', 'Iran'),
  (1567, 'IRQ', 'Iraq'),
  (1501, 'CIV', 'Ivory Coast'),
  (12,   'JPN', 'Japan'),
  (1548, 'JOR', 'Jordan'),
  (16,   'MEX', 'Mexico'),
  (31,   'MAR', 'Morocco'),
  (1118, 'NED', 'Netherlands'),
  (4673, 'NZL', 'New Zealand'),
  (1090, 'NOR', 'Norway'),
  (11,   'PAN', 'Panama'),
  (2380, 'PAR', 'Paraguay'),
  (27,   'POR', 'Portugal'),
  (1569, 'QAT', 'Qatar'),
  (23,   'KSA', 'Saudi Arabia'),
  (1108, 'SCO', 'Scotland'),
  (13,   'SEN', 'Senegal'),
  (1531, 'RSA', 'South Africa'),
  (17,   'KOR', 'South Korea'),
  (9,    'ESP', 'Spain'),
  (5,    'SWE', 'Sweden'),
  (15,   'SUI', 'Switzerland'),
  (28,   'TUN', 'Tunisia'),
  (777,  'TUR', 'Türkiye'),
  (7,    'URU', 'Uruguay'),
  (2384, 'USA', 'USA'),
  (1568, 'UZB', 'Uzbekistan')
ON CONFLICT (api_team_id) DO UPDATE
  SET team_code = EXCLUDED.team_code, api_name = EXCLUDED.api_name;
