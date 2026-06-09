import { useQuery } from '@tanstack/react-query';
import {
  futebolDataService,
  type Competition,
  type FutebolFixture,
  type FutebolFixtureDetail,
  type FutebolStandingRow,
  type FutebolTeamProfile,
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
