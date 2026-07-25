import { useQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  futebolDataService,
  type FutebolAccess,
  type Competition,
  type FutebolFixture,
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
