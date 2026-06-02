-- ============================================================
-- wc_matches.api_fixture_id — link pro fixture id da API-Sports
-- ============================================================
-- A ingestão de placar atualiza wc_matches por este id. Mapeamento validado
-- (2026-06-01) contra /fixtures?league=1&season=2026: os 72 jogos de fase de
-- grupos casam 72/72 com o nosso seed por PAR DE TIMES (orientação home/away
-- idêntica). NÃO casar por data: a API é UTC e nosso match_date é BRT (28/72
-- caem em dia diferente). Mata-mata (32 jogos) ainda não carregou na API (times
-- TBD) — fica NULL e será populado pela ingestão quando os times resolverem.
-- ============================================================

ALTER TABLE public.wc_matches ADD COLUMN IF NOT EXISTS api_fixture_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS wc_matches_api_fixture_id_key
  ON public.wc_matches (api_fixture_id) WHERE api_fixture_id IS NOT NULL;

UPDATE public.wc_matches m
   SET api_fixture_id = f.fid
  FROM (VALUES
    (1489369,'MEX','RSA'),(1538999,'KOR','CZE'),(1539000,'CAN','BIH'),(1489370,'USA','PAR'),
    (1489373,'QAT','SUI'),(1489371,'BRA','MAR'),(1489372,'HAI','SCO'),(1539001,'AUS','TUR'),
    (1489374,'GER','CUW'),(1489376,'NED','JPN'),(1489375,'CIV','ECU'),(1539002,'SWE','TUN'),
    (1489380,'ESP','CPV'),(1489377,'BEL','EGY'),(1489379,'KSA','URU'),(1489378,'IRN','NZL'),
    (1489383,'FRA','SEN'),(1539016,'IRQ','NOR'),(1489381,'ARG','ALG'),(1489382,'AUT','JOR'),
    (1539003,'POR','COD'),(1489384,'ENG','CRO'),(1489385,'GHA','PAN'),(1489386,'UZB','COL'),
    (1539004,'CZE','RSA'),(1539005,'SUI','BIH'),(1489387,'CAN','QAT'),(1489388,'MEX','KOR'),
    (1489391,'USA','AUS'),(1489390,'SCO','MAR'),(1489389,'BRA','HAI'),(1539006,'TUR','PAR'),
    (1539007,'NED','SWE'),(1489393,'GER','CIV'),(1489392,'ECU','CUW'),(1489394,'TUN','JPN'),
    (1489397,'ESP','KSA'),(1489395,'BEL','IRN'),(1489398,'URU','CPV'),(1489396,'NZL','EGY'),
    (1489399,'ARG','AUT'),(1539017,'FRA','IRQ'),(1489401,'NOR','SEN'),(1489400,'JOR','ALG'),
    (1489404,'POR','UZB'),(1489402,'ENG','GHA'),(1489403,'PAN','CRO'),(1539008,'COL','COD'),
    (1489408,'SUI','CAN'),(1539009,'BIH','QAT'),(1489405,'MAR','HAI'),(1489406,'SCO','BRA'),
    (1539010,'CZE','MEX'),(1489407,'RSA','KOR'),(1489410,'ECU','GER'),(1489409,'CUW','CIV'),
    (1539011,'JPN','SWE'),(1489412,'TUN','NED'),(1539012,'TUR','USA'),(1489411,'PAR','AUS'),
    (1539074,'SEN','IRQ'),(1489416,'NOR','FRA'),(1489417,'URU','ESP'),(1489413,'CPV','KSA'),
    (1489414,'EGY','IRN'),(1489415,'NZL','BEL'),(1489420,'CRO','GHA'),(1489422,'PAN','ENG'),
    (1489419,'COL','POR'),(1539013,'COD','UZB'),(1489418,'ALG','AUT'),(1489421,'JOR','ARG')
  ) AS f(fid, home, away)
 WHERE m.stage = 'group'
   AND m.home_team_code = f.home
   AND m.away_team_code = f.away;
