-- ============================================================
-- 071_backfill_round_of_32_real_teams — preenche os 16-avos reais
-- ============================================================
-- Backfill one-off dos 16 jogos dos 16-avos (match_number 73..88) com os times
-- REAIS, agora que a fase de grupos encerrou.
--
-- Fonte dos confrontos:
--   - 1º/2º de cada grupo: classificação final (wc_matches, stage='group').
--   - 8 melhores 3ºs: grupos B,D,E,F,I,J,K,L (7 com 4pts + SEN/I, melhor de 3pts
--     por saldo +2). Alocação aos slots conforme a tabela oficial da FIFA
--     (Anexo C, combinação {B,D,E,F,I,J,K,L}) — conferida com os descritores de
--     elegibilidade de cada jogo (ex.: J80 "3º Grupo EHIJK" → K; J87 "DEIJL" → L).
--
-- Idempotente: só reescreve as linhas listadas em `assign`. Não toca no R16+
-- (esses continuam "Vencedor Jxx" e resolvem conforme os jogos finalizam).
-- ============================================================
WITH assign(match_number, home_code, away_code) AS (
  VALUES
    (73, 'RSA', 'CAN'),  -- 2ºA × 2ºB
    (74, 'GER', 'PAR'),  -- 1ºE × 3º(D)
    (75, 'NED', 'MAR'),  -- 1ºF × 2ºC
    (76, 'BRA', 'JPN'),  -- 1ºC × 2ºF
    (77, 'FRA', 'SWE'),  -- 1ºI × 3º(F)
    (78, 'CIV', 'NOR'),  -- 2ºE × 2ºI
    (79, 'MEX', 'ECU'),  -- 1ºA × 3º(E)
    (80, 'ENG', 'COD'),  -- 1ºL × 3º(K)
    (81, 'USA', 'BIH'),  -- 1ºD × 3º(B)
    (82, 'BEL', 'SEN'),  -- 1ºG × 3º(I)
    (83, 'POR', 'CRO'),  -- 2ºK × 2ºL
    (84, 'ESP', 'AUT'),  -- 1ºH × 2ºJ
    (85, 'SUI', 'ALG'),  -- 1ºB × 3º(J)
    (86, 'ARG', 'CPV'),  -- 1ºJ × 2ºH
    (87, 'COL', 'GHA'),  -- 1ºK × 3º(L)
    (88, 'AUS', 'EGY')   -- 2ºD × 2ºG
),
-- nome de exibição (pt-BR) a partir das linhas de grupo, por código
names AS (
  SELECT code, max(nm) AS nm FROM (
    SELECT home_team_code AS code, home_team AS nm FROM wc_matches WHERE stage = 'group'
    UNION ALL
    SELECT away_team_code, away_team FROM wc_matches WHERE stage = 'group'
  ) t
  GROUP BY code
)
UPDATE wc_matches m
SET home_team_code = a.home_code,
    away_team_code = a.away_code,
    home_team = COALESCE(hn.nm, m.home_team),
    away_team = COALESCE(an.nm, m.away_team)
FROM assign a
LEFT JOIN names hn ON hn.code = a.home_code
LEFT JOIN names an ON an.code = a.away_code
WHERE m.match_number = a.match_number
  AND m.stage = 'round_of_32';
