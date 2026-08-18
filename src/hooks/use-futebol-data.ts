import { useQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  futebolDataService,
  type FutebolAccess,
  type Competition,
  type FutebolFixture,
  type FutebolFixtureByDay,
  type FutebolFixtureDay,
  type FutebolFixturePremissas,
  type FutebolFixtureNumeros,
  type FutebolFixtureHistorico,
  type FutebolCompetitionInfo,
  type FutebolFixtureDetail,
  type FutebolFixtureExtras,
  type FutebolH2HMeeting,
  type FutebolInjury,
  type FutebolStandingRow,
  type FutebolTeamProfile,
  type FutebolTeamSeason,
  type FutebolMatchupMarkets,
  type FutebolMatchupTendencies,
  type FutebolOddsRow,
  type FutebolOddsBoardRow,
  type FutebolPrediction,
  type FutebolLeaders,
  type FutebolValueBoardRow,
  type FutebolFixtureValueRow,
  type FutebolAlertedPick,
} from '@/services/futebol-data.service';

/**
 * Acesso ao módulo Futebol (reverse trial 7 dias, sem cartão).
 * O RPC inicia o relógio no 1º acesso logado e devolve o estado atual.
 * Key por usuário pra refazer ao logar/deslogar.
 */
export function useFutebolAccess() {
  const { user } = useAuth();
  return useQuery<FutebolAccess>({
    queryKey: ['futebol', 'access', user?.id ?? 'anon'],
    queryFn: () => futebolDataService.getAccess(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixtures(competition: Competition, season: number, round?: string | null) {
  return useQuery<FutebolFixture[]>({
    queryKey: ['futebol', 'fixtures', competition, season, round ?? 'all'],
    queryFn: () => futebolDataService.getFixtures(competition, season, round),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Agenda de UM dia (BRT) em todas as ligas. É o caminho novo da /futebol/jogos.
 * Prefira este ao useFutebolFixturesMulti quando a pergunta é "o que tem no dia X":
 * uma chamada de ~16 KB no pior dia, contra ~850 KB das 8 chamadas por liga.
 * `day` é chave `YYYY-MM-DD` (use brtToday()/addDays de utils/futebol-datas).
 */
export function useFutebolFixturesByDay(day: string | null | undefined, competitions?: string[] | null) {
  return useQuery<FutebolFixtureByDay[]>({
    queryKey: ['futebol', 'fixtures-by-day', day, competitions ?? 'all'],
    queryFn: () => futebolDataService.getFixturesByDay(day as string, competitions),
    enabled: !!day,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Dias com jogo no intervalo, pra régua de datas saber onde tem jogo e quantos. */
export function useFutebolFixtureDays(from: string | null | undefined, to: string | null | undefined) {
  return useQuery<FutebolFixtureDay[]>({
    queryKey: ['futebol', 'fixture-days', from, to],
    queryFn: () => futebolDataService.getFixtureDays(from as string, to as string),
    enabled: !!from && !!to,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Mapa de premissas do jogo (acesas e apagadas), nos 5 mercados. É o conteúdo
 * analítico que existe mesmo sem odd coletada, então não depende de preço.
 */
export function useFutebolFixturePremissas(fixtureId: number | undefined) {
  return useQuery<FutebolFixturePremissas[]>({
    queryKey: ['futebol', 'fixture-premissas', fixtureId],
    queryFn: () => futebolDataService.getFixturePremissas(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Números de temporada dos dois times, para embasar cada premissa com o dado real. */
export function useFutebolFixtureNumeros(fixtureId: number | undefined) {
  return useQuery<FutebolFixtureNumeros[]>({
    queryKey: ['futebol', 'fixture-numeros', fixtureId],
    queryFn: () => futebolDataService.getFixtureNumeros(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Jogo a jogo dos dois times: é o que sustenta o gráfico embaixo de cada premissa. */
export function useFutebolFixtureHistorico(fixtureId: number | undefined) {
  return useQuery<FutebolFixtureHistorico[]>({
    queryKey: ['futebol', 'fixture-historico', fixtureId],
    queryFn: () => futebolDataService.getFixtureHistorico(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Competições e temporadas que existem no mart. Cache longo: muda quando o Mateus
 * sobe liga nova, não a cada minuto.
 */
export function useFutebolCompetitions() {
  return useQuery<FutebolCompetitionInfo[]>({
    queryKey: ['futebol', 'competitions'],
    queryFn: () => futebolDataService.getCompetitions(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fixtures de VÁRIAS competições de uma vez (uma query por liga, em paralelo).
 * Achata tudo taggeando cada jogo com sua `competition`. Usado no /futebol
 * (Hoje) pra listar jogos de todas as ligas, não só de um allowlist fixo.
 */
export function useFutebolFixturesMulti(competitions: string[], season: number) {
  const results = useQueries({
    queries: competitions.map((competition) => ({
      queryKey: ['futebol', 'fixtures', competition, season, 'all'],
      queryFn: () => futebolDataService.getFixtures(competition, season),
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });
  const isLoading = results.some((r) => r.isLoading);
  // react-query faz structural sharing → o ref de r.data só muda quando o dado
  // muda; memoizar por esses refs evita reflatten a cada render.
  const dataRefs = results.map((r) => r.data);
  const data = useMemo(
    () =>
      results.flatMap((r, i) =>
        (r.data ?? []).map((f) => ({ ...f, competition: competitions[i] }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...dataRefs, competitions]
  );
  return { data, isLoading };
}

export function useFutebolFixtureDetail(fixtureId: number | undefined) {
  return useQuery<FutebolFixtureDetail>({
    queryKey: ['futebol', 'fixture', fixtureId],
    queryFn: () => futebolDataService.getFixtureDetail(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixtureExtras(fixtureId: number | undefined) {
  return useQuery<FutebolFixtureExtras>({
    queryKey: ['futebol', 'fixture-extras', fixtureId],
    queryFn: () => futebolDataService.getFixtureExtras(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixtureInjuries(fixtureId: number | undefined) {
  return useQuery<FutebolInjury[]>({
    queryKey: ['futebol', 'injuries', fixtureId],
    queryFn: () => futebolDataService.getFixtureInjuries(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolH2H(homeId: number | undefined, awayId: number | undefined) {
  return useQuery<FutebolH2HMeeting[]>({
    queryKey: ['futebol', 'h2h', homeId, awayId],
    queryFn: () => futebolDataService.getH2H(homeId as number, awayId as number),
    enabled: !!homeId && !!awayId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolStandings(competition: Competition, season: number, enabled = true) {
  return useQuery<FutebolStandingRow[]>({
    queryKey: ['futebol', 'standings', competition, season],
    queryFn: () => futebolDataService.getStandings(competition, season),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolTeamProfile(teamId: number | undefined, competition: Competition, season: number) {
  return useQuery<FutebolTeamProfile>({
    queryKey: ['futebol', 'team', teamId, competition, season],
    queryFn: () => futebolDataService.getTeamProfile(teamId as number, competition, season),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolMatchupTendencies(
  homeId: number | undefined,
  awayId: number | undefined,
  competition: Competition | undefined,
  season: number | undefined
) {
  return useQuery<FutebolMatchupTendencies>({
    queryKey: ['futebol', 'tendencies', homeId, awayId, competition, season],
    queryFn: () => futebolDataService.getMatchupTendencies(homeId as number, awayId as number, competition as Competition, season as number),
    enabled: !!homeId && !!awayId && !!competition && !!season,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixtureOdds(fixtureId: number | undefined) {
  return useQuery<FutebolOddsRow[]>({
    queryKey: ['futebol', 'odds', fixtureId],
    queryFn: () => futebolDataService.getFixtureOdds(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixturePrediction(fixtureId: number | undefined) {
  return useQuery<FutebolPrediction | null>({
    queryKey: ['futebol', 'prediction', fixtureId],
    queryFn: () => futebolDataService.getFixturePrediction(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolOddsBoard() {
  return useQuery<FutebolOddsBoardRow[]>({
    queryKey: ['futebol', 'odds-board'],
    queryFn: () => futebolDataService.getOddsBoard(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolValueBoard() {
  return useQuery<FutebolValueBoardRow[]>({
    queryKey: ['futebol', 'value-board'],
    queryFn: () => futebolDataService.getValueBoard(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * O passado, na foto do apito. Janela fixa de 30 dias, que é o que o stepper
 * navega.
 *
 * `staleTime` alto de propósito, e maior que o do board: isto é passado, então
 * só muda quando um jogo novo termina. O board tem 5 minutos porque odd mexe.
 *
 * Ver migration 101.
 */
export function useFutebolValueHistory(dias = 30) {
  const hoje = new Date();
  const de = new Date(hoje.getTime() - dias * 864e5);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return useQuery<FutebolValueBoardRow[]>({
    queryKey: ['futebol', 'value-history', dias, iso(hoje)],
    queryFn: () => futebolDataService.getValueHistory(iso(de), iso(hoje)),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Tudo que foi alertado no Telegram nos últimos 90 dias (poucas linhas: 1 a 3
 * picks por dia). Buscado de uma vez porque o seletor de dias precisa saber
 * quais dias tiveram alerta, inclusive os que o mart já não guarda. Ver 091.
 */
export function useFutebolAlertedPicks() {
  return useQuery<FutebolAlertedPick[]>({
    queryKey: ['futebol', 'alerted-picks'],
    queryFn: () => futebolDataService.getAlertedPicks(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixtureValue(fixtureId: number | undefined) {
  return useQuery<FutebolFixtureValueRow[]>({
    queryKey: ['futebol', 'fixture-value', fixtureId],
    queryFn: () => futebolDataService.getFixtureValue(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolLeaders(competition: Competition, season: number, enabled = true) {
  return useQuery<FutebolLeaders>({
    queryKey: ['futebol', 'leaders', competition, season],
    queryFn: () => futebolDataService.getLeaders(competition, season),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolTeamSeason(teamId: number | undefined, competition: Competition, season: number) {
  return useQuery<FutebolTeamSeason | null>({
    queryKey: ['futebol', 'team-season', teamId, competition, season],
    queryFn: () => futebolDataService.getTeamSeason(teamId as number, competition, season),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolMatchupMarkets(
  homeId: number | undefined,
  awayId: number | undefined,
  competition: Competition | undefined,
  season: number | undefined
) {
  return useQuery<FutebolMatchupMarkets>({
    queryKey: ['futebol', 'markets', homeId, awayId, competition, season],
    queryFn: () => futebolDataService.getMatchupMarkets(homeId as number, awayId as number, competition as Competition, season as number),
    enabled: !!homeId && !!awayId && !!competition && !!season,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
