import { useQuery } from '@tanstack/react-query';
import {
  futebolDataService,
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
  type FutebolLeaders,
} from '@/services/futebol-data.service';

export function useFutebolFixtures(competition: Competition, season: number, round?: string | null) {
  return useQuery<FutebolFixture[]>({
    queryKey: ['futebol', 'fixtures', competition, season, round ?? 'all'],
    queryFn: () => futebolDataService.getFixtures(competition, season, round),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
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
