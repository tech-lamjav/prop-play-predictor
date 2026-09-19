import { useQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { brtToday } from '@/utils/futebol-datas';
import { HISTORY_WINDOW_DAYS, historyWindow } from '@/utils/futebol-history';
import { ocultosAgora, type MercadoOculto } from '@/utils/futebol-mercados-ocultos';
import { comPlacarFresco, idsSemFecho, type JogoComPlacar } from '@/utils/futebol-placar-fresco';
import type { LimiarDeValor } from '@/utils/futebol-corte-de-valor';
import type { Saida } from '@/utils/futebol-saida';
import type { FixtureScope } from '@/utils/futebol-competitions';
import {
  futebolDataService,
  type FutebolAccess,
  type Competition,
  type FutebolFixture,
  type FutebolFixtureByDay,
  type FutebolFixtureDay,
  type FutebolFixturePremissas,
  type FutebolFixtureReasonContractRow,
  type FutebolFixtureDisponibilidade,
  type FutebolFixtureNumeros,
  type FutebolFixtureInsumo,
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
  type FutebolFixtureValueComCortadas,
  type FutebolAlertedPick,
  type FutebolPlacarFresco,
} from '@/services/futebol-data.service';

/**
 * Acesso ao módulo Futebol (reverse trial 48 horas, sem cartão).
 * O RPC inicia o relógio no 1º acesso logado e devolve o estado atual.
 * Key por usuário pra refazer ao logar/deslogar.
 */
/**
 * Quem está perguntando, para entrar na chave de cache.
 *
 * ⚠️ TODA consulta que o banco fecha por acesso precisa disto na chave. As
 * RPCs guardadas por `futebol_acesso_do_chamador` devolvem a linha com as
 * colunas nulas para quem não tem acesso, e o React Query não sabe que a
 * resposta dependia de QUEM perguntou: sem o usuário na chave, a cópia
 * buscada antes do login segue servindo depois dele.
 *
 * Foi assim que quem criava conta via o chip do cabeçalho dizer "Teste · 48h"
 * — porque `get_futebol_access` já era keyed por usuário e refazia — com a
 * lista inteira cadeada ao lado, porque o board não era. Duas respostas do
 * mesmo banco discordando na mesma tela, até o cache vencer em 5 minutos.
 */
function useChaveDoUsuario(): string {
  const { user } = useAuth();
  return user?.id ?? 'anon';
}

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
  const quem = useChaveDoUsuario();
  return useQuery<FutebolFixturePremissas[]>({
    queryKey: ['futebol', 'fixture-premissas', fixtureId, quem],
    queryFn: () => futebolDataService.getFixturePremissas(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Desde quando cada saída está publicada, por oportunidade (issue #300). */
export function useFutebolFixtureDisponibilidade(fixtureId: number | undefined) {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolFixtureDisponibilidade[]>({
    queryKey: ['futebol', 'fixture-disponivel-desde', fixtureId, quem],
    queryFn: () => futebolDataService.getFixtureDisponibilidade(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Motivos já agrupados pelo backend para qualquer saída cotada da Bancada. */
export function useFutebolFixtureReasonContract(fixtureId: number | undefined) {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolFixtureReasonContractRow[]>({
    queryKey: ['futebol', 'fixture-reason-contract', fixtureId, quem],
    queryFn: () => futebolDataService.getFixtureReasonContract(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
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

/** O valor que cada premissa comparou, direto do mart (#464). Vazio é normal. */
export function useFutebolFixtureInsumos(fixtureId: number | undefined) {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolFixtureInsumo[]>({
    queryKey: ['futebol', 'fixture-insumos', fixtureId, quem],
    queryFn: () => futebolDataService.getFixtureInsumos(fixtureId as number),
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
export function useFutebolFixturesMulti(scopes: FixtureScope[]) {
  return useQueries({
    queries: scopes.map(({ competition, season }) => ({
      queryKey: ['futebol', 'fixtures', competition, season, 'all'],
      queryFn: () => futebolDataService.getFixtures(competition, season),
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
    // O achatamento mora no `combine` porque um useMemo aqui fora não tem como
    // ficar correto: a lista de competições cresce quando o catálogo chega, e um
    // array de dependências de tamanho variável é o que o React proíbe —
    // depender de `results` cru seria pior ainda, já que é um array novo a cada
    // render e o memo nunca casaria. O react-query faz structural sharing dos
    // resultados e só reexecuta o `combine` quando algum deles muda de fato.
    combine: (results) => ({
      isLoading: results.some((r) => r.isLoading),
      data: results.flatMap((r, i) =>
        (r.data ?? []).map((f) => ({ ...f, competition: scopes[i].competition }))
      ),
    }),
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
  const quem = useChaveDoUsuario();
  return useQuery<FutebolOddsRow[]>({
    queryKey: ['futebol', 'odds', fixtureId, quem],
    queryFn: () => futebolDataService.getFixtureOdds(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolFixturePrediction(fixtureId: number | undefined) {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolPrediction | null>({
    queryKey: ['futebol', 'prediction', fixtureId, quem],
    queryFn: () => futebolDataService.getFixturePrediction(fixtureId as number),
    enabled: !!fixtureId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolOddsBoard() {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolOddsBoardRow[]>({
    queryKey: ['futebol', 'odds-board', quem],
    queryFn: () => futebolDataService.getOddsBoard(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFutebolValueBoard() {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolValueBoardRow[]>({
    queryKey: ['futebol', 'value-board', quem],
    queryFn: () => futebolDataService.getValueBoard(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * O passado, na foto do apito.
 *
 * `dias` é quantos dias para trás, contando hoje. O padrão são os 30 que o
 * stepper do painel navega; quem mostra um dia só pede um dia, porque a janela
 * É o custo da consulta — a conta e os números medidos estão em
 * `historyWindow`, no futebol-history.ts.
 *
 * ⚠️ `refetchInterval` de 5 minutos, e ele é ESSENCIAL, não higiene. A RPC corta
 * em `kickoff < now()` no BANCO (migration 102), então a linha de um jogo só
 * passa a existir aqui depois do apito dele. Sem rebuscar, o jogo das 16h nunca
 * entra em `histRows` numa aba aberta desde as 15h, e a fusão do
 * `futebol-history.ts` cai no board por falta de candidato — que é exatamente o
 * defeito que a fusão existe para consertar. O `useNow` move o relógio; este
 * intervalo move os dados. Um sem o outro não resolve.
 *
 * A defasagem máxima passa a ser de 5 minutos na lista. A tela de detalhe não
 * tem essa defasagem: ela busca na navegação e a RPC dela já decide por kickoff.
 *
 * Ver migrations 101 e 102.
 */
export function useFutebolValueHistory(dias = HISTORY_WINDOW_DAYS) {
  // Dia de BRASÍLIA, não UTC. A primeira versão disto usava `toISOString()`, que
  // dá a data em UTC: depois das 21h de Brasília o "hoje" já virava o dia
  // seguinte e a janela inteira andava um dia, escondendo o jogo da noite.
  const hoje = brtToday();
  const { from, to } = historyWindow(hoje, dias);
  return useQuery<FutebolValueBoardRow[]>({
    queryKey: ['futebol', 'value-history', from, to],
    queryFn: () => futebolDataService.getValueHistory(from, to),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Tudo que foi alertado no Telegram nos últimos 90 dias (poucas linhas: 1 a 3
 * picks por dia). Buscado de uma vez porque o seletor de dias precisa saber
 * quais dias tiveram alerta, inclusive os que o mart já não guarda. Ver 091.
 */
export function useFutebolAlertedPicks() {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolAlertedPick[]>({
    queryKey: ['futebol', 'alerted-picks', quem],
    queryFn: () => futebolDataService.getAlertedPicks(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * O placar dos jogos que o coletor já fechou e o espelho ainda não.
 *
 * Existe porque o painel lê o espelho, que recarrega no ritmo do pipeline: jogo
 * que acaba de madrugada amanhece sem resultado na tela, e o sócio via "10 de 19
 * sem resultado" no dia anterior. Só é chamada quando sobra jogo sem placar no
 * dia mostrado — dia inteiro fechado não gasta consulta.
 *
 * O `refetchInterval` é o que faz o resultado APARECER com a tela aberta. Sem
 * ele o `staleTime` curto não busca nada sozinho (ver o cabeçalho de
 * `use-now.ts`: o tique move o relógio, não os dados), e o jogo que acabou às
 * 23h só ganharia placar no F5. Dois minutos é o passo do coletor.
 *
 * O `placeholderData` segura o que já veio enquanto a lista de ids muda: a
 * chave muda junto, e sem isso a linha pisca de volta para "sem resultado".
 */
export function useFutebolPlacarFresco(fixtureIds: number[]) {
  const ids = [...fixtureIds].sort((a, b) => a - b);
  return useQuery<FutebolPlacarFresco[]>({
    queryKey: ['futebol', 'placar-fresco', ids],
    queryFn: () => futebolDataService.getPlacarFresco(ids),
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (anterior) => anterior,
  });
}

/**
 * Os jogos que a tela já tem, com o placar do coletor sobreposto onde o espelho
 * ainda não fechou (issue #479).
 *
 * É o caminho curto para qualquer superfície que mostre placar: entra a lista
 * que a tela ia desenhar, sai a mesma lista com o resultado dos jogos que
 * acabaram. Quem decide a quem perguntar é `futebol-placar-fresco.ts`, num lugar
 * só, e não cada tela por conta própria.
 *
 * `agoraMs` vem de fora de propósito: a regra do repositório é um instante só
 * para a tela inteira (ver `use-now.ts`). Dois relógios discordam na virada do
 * dia, e esta função escolhe jogos justamente pelo relógio.
 */
export function useJogosComPlacarFresco<T extends JogoComPlacar>(
  jogos: readonly T[] | undefined,
  agoraMs: number,
): T[] {
  const lista = useMemo(() => jogos ?? [], [jogos]);
  const ids = useMemo(() => idsSemFecho(lista, agoraMs), [lista, agoraMs]);
  const { data } = useFutebolPlacarFresco(ids);
  return useMemo(() => comPlacarFresco(lista, data), [lista, data]);
}

const opcoesDoValorDoJogo = (fixtureId: number | undefined, quem: string) => ({
  queryKey: ['futebol', 'fixture-value', fixtureId, quem] as const,
  queryFn: () => futebolDataService.getFixtureValue(fixtureId as number),
  enabled: !!fixtureId,
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
});

export function useFutebolFixtureValue(fixtureId: number | undefined) {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolFixtureValueComCortadas, Error, FutebolFixtureValueRow[]>({
    ...opcoesDoValorDoJogo(fixtureId, quem),
    select: (d) => d.linhas,
  });
}

/**
 * As saídas que o corte de valor removeu deste jogo (#432).
 *
 * MESMA queryKey do `useFutebolFixtureValue`, de propósito: é uma busca só, e as
 * duas listas nascem da mesma resposta. Separá-las em duas buscas abriria a
 * janela em que a tela tem as linhas e ainda não tem as cortadas — e nessa
 * janela ela anuncia como leitura exatamente o que estamos escondendo.
 *
 * Quem consome isto só pode PERGUNTAR se uma saída está aqui. Não há o que
 * exibir: a lista não carrega Score nem vantagem.
 */
export function useFutebolFixtureCortadas(fixtureId: number | undefined) {
  const quem = useChaveDoUsuario();
  return useQuery<FutebolFixtureValueComCortadas, Error, Saida[]>({
    ...opcoesDoValorDoJogo(fixtureId, quem),
    select: (d) => d.cortadas,
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

/**
 * Os mercados fora da VITRINE — não fora do board.
 *
 * A lista vem do banco para que devolver um mercado à tela seja um UPDATE e não
 * um release. Fica aqui, e não em constante, porque o detalhe do jogo monta a
 * prateleira a partir do CATÁLOGO de mercados e não do board: sem esta lista o
 * mercado escondido continuaria como chip, com barra de Score e sem odd, que é
 * pior do que não ter escondido. Ver prop-play-predictor#324.
 */
export function useFutebolMercadosOcultos() {
  return useQuery<MercadoOculto[]>({
    queryKey: ['futebol', 'mercados-ocultos'],
    queryFn: () => futebolDataService.getVitrine(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * O corte de valor por mercado (migration 144), com a data de vigência.
 *
 * O board e o detalhe do jogo já chegam cortados do serviço. Quem precisa disto
 * na tela é o HISTÓRICO e o placar, que mostram o passado e decidem por data.
 */
export function useFutebolLimiaresDeValor() {
  return useQuery<LimiarDeValor[]>({
    queryKey: ['futebol', 'limiares-de-valor'],
    queryFn: () => futebolDataService.getLimiaresDeValor(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * A vitrine, do jeito que a tela precisa dela: a lista E se ela já chegou.
 *
 * Existe porque as três telas que a consomem repetiam o mesmo par — o hook, o
 * `?? []` memoizado e o comentário — e porque o `isLoading` importa tanto
 * quanto a lista: renderizar antes de a vitrine chegar mostra o mercado
 * escondido por um instante, e ele some depois. Ver prop-play-predictor#324.
 */
export function useVitrine(): {
  vitrine: MercadoOculto[];
  ocultos: string[];
  limiares: LimiarDeValor[];
  isLoading: boolean;
} {
  const { data, isLoading } = useFutebolMercadosOcultos();
  // O corte de valor faz parte da vitrine: é outra forma de uma linha não estar
  // na tela. O `isLoading` soma os dois pelo mesmo motivo de sempre — renderizar
  // antes de o corte chegar mostraria a linha cortada por um instante.
  const { data: dadosDoCorte, isLoading: carregandoCorte } = useFutebolLimiaresDeValor();
  // Memoizados: o fallback e o .map criam array novo a cada render e
  // envenenariam as dependencias de todo useMemo que os recebe.
  const vitrine = useMemo(() => data ?? [], [data]);
  // Só os nomes, para quem decide sobre o presente e não precisa da data — e
  // por isso só os que estão fora AGORA: o mercado que voltou está na tela.
  const ocultos = useMemo(() => ocultosAgora(vitrine), [vitrine]);
  const limiares = useMemo(() => dadosDoCorte ?? [], [dadosDoCorte]);
  return { vitrine, ocultos, limiares, isLoading: isLoading || carregandoCorte };
}

