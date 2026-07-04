-- ============================================================
-- 076_backfill_knockout_team_names — nome real nos jogos propagados
-- ============================================================
-- A propagação do mata-mata (ingest-wc-scores) preenchia só o CÓDIGO
-- (home_team_code/away_team_code) e deixava o texto de exibição como
-- "Vencedor Jxx" — a UI mostra esse texto, então o card ficava sem o nome
-- do time mesmo com bandeira/sigla certas (bug visto nas oitavas).
--
-- A função foi corrigida pra propagar também o nome; esta migration faz o
-- backfill dos jogos já propagados: todo jogo de mata-mata com código real
-- cujo texto ainda é um descritor "Vencedor/Perdedor Jxx" recebe o nome
-- pt-BR do time (mesma fonte da 071: as linhas da fase de grupos).
--
-- Idempotente: depois do primeiro run, o texto deixa de casar com o padrão.
-- ============================================================
WITH names AS (
  SELECT code, max(nm) AS nm FROM (
    SELECT home_team_code AS code, home_team AS nm FROM wc_matches WHERE stage = 'group'
    UNION ALL
    SELECT away_team_code, away_team FROM wc_matches WHERE stage = 'group'
  ) t
  GROUP BY code
)
UPDATE wc_matches m
SET home_team = CASE
      WHEN m.home_team_code <> 'TBD' AND m.home_team ~* '^(Vencedor|Perdedor)\s+J\d+$'
        THEN COALESCE((SELECT nm FROM names WHERE code = m.home_team_code), m.home_team)
      ELSE m.home_team END,
    away_team = CASE
      WHEN m.away_team_code <> 'TBD' AND m.away_team ~* '^(Vencedor|Perdedor)\s+J\d+$'
        THEN COALESCE((SELECT nm FROM names WHERE code = m.away_team_code), m.away_team)
      ELSE m.away_team END
WHERE m.stage <> 'group'
  AND (
    (m.home_team_code <> 'TBD' AND m.home_team ~* '^(Vencedor|Perdedor)\s+J\d+$') OR
    (m.away_team_code <> 'TBD' AND m.away_team ~* '^(Vencedor|Perdedor)\s+J\d+$')
  );
