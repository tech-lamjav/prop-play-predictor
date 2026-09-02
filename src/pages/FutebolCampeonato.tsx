import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FixtureRow } from '@/components/futebol/FixtureRow';
import { LigaCrest } from '@/components/futebol/LigaCrest';
import { ReguaRodadas } from '@/components/futebol/ReguaRodadas';
import { StandingsTable } from '@/components/futebol/StandingsTable';
import { ScorersCard } from '@/components/futebol/ScorersCard';
import {
  useFutebolFixtures,
  useFutebolStandings,
  useFutebolLeaders,
  useFutebolValueBoard,
  useFutebolCompetitions,
} from '@/hooks/use-futebol-data';
import type { Competition, FutebolFixture, FutebolValueBoardRow } from '@/services/futebol-data.service';
import { brtDayOf, fmtDayHeader, isFinished } from '@/utils/futebol-datas';
import { groupBoardByFixture } from '@/utils/futebol-score';
import { sufixoDeLeitura } from '@/utils/futebol-leitura';
import { hrefDaSaida, hrefDoJogo } from '@/utils/futebol-links';
import { settleFutebol, isHit } from '@/utils/futebol-settlement';
import { competitionLabel, sortCompetitions } from '@/utils/futebol-competitions';
import { ChaveamentoBracket } from '@/components/futebol/ChaveamentoBracket';
import { GruposFase } from '@/components/futebol/GruposFase';
import { ehCampeonatoDePontos, ehMataMata, rodadaLonga } from '@/utils/futebol-rodadas';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUT_CAMPEONATO_TOUR_ID, makeFutebolCampeonatoSteps } from '@/components/onboarding/tours';

/**
 * Um campeonato: rodada a rodada, classificação e artilheiros.
 *
 * É o que saiu da /futebol/jogos quando ela virou agenda por dia. Rodada e
 * temporada são conceitos POR LIGA (rodada de ligas diferentes não se alinha),
 * então o lugar deles é aqui, não numa lista multi-liga.
 *
 * Desenho do protótipo "Futebol Campeonato": faixa areia com o brasão e os
 * números da temporada, régua de rodadas no lugar do stepper, e as duas colunas
 * (jogos da rodada · tabela e artilheiros) que no celular viram três abas. Saiu
 * a fileira de nove pills de liga, que estourava a linha, e saíram os dois
 * modais.
 *
 * Campeonatos e temporadas vêm da RPC get_futebol_competitions, não de lista fixa
 * no front. A lista fixa escondia a champions_league e as temporadas 2025 de La
 * Liga, Premier, Libertadores e Sul-Americana.
 */

const DEFAULT_COMP = 'brasileirao';

/**
 * Duas colunas (jogos + tabela/chave) ou abas? Casado com o `lg:` do grid, e não
 * com o breakpoint de 768px do useIsMobile: entre 768 e 1024 a tela já está em
 * abas, e o tour apontaria para a coluna escondida.
 */
const COLUNAS_MQ = '(min-width: 1024px)';

function useDuasColunas(): boolean {
  const [tem, setTem] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(COLUNAS_MQ).matches : true,
  );
  useEffect(() => {
    const mql = window.matchMedia(COLUNAS_MQ);
    const onChange = (e: MediaQueryListEvent) => setTem(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return tem;
}

const d1 = (n: number) => n.toFixed(1).replace('.', ',');
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Estatistica({ rotulo, valor, unidade }: { rotulo: string; valor: string; unidade: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] uppercase tracking-[0.14em] font-bold" style={{ color: '#8d8672' }}>
        {rotulo}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[18px] leading-none font-semibold tabular-nums text-ink">{valor}</span>
        <span className="text-[11px]" style={{ color: '#8d8672' }}>
          {unidade}
        </span>
      </div>
    </div>
  );
}

export default function FutebolCampeonato() {
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();

  const competition = (slug || DEFAULT_COMP) as Competition;
  const { data: comps } = useFutebolCompetitions();

  /** Temporadas que a liga realmente tem no mart, mais recente primeiro. */
  const seasons = useMemo(() => {
    const s = (comps ?? []).filter((c) => c.competition === competition).map((c) => Number(c.season));
    return [...new Set(s)].sort((a, b) => b - a);
  }, [comps, competition]);

  const seasonParam = Number(params.get('s')) || null;
  const season = seasonParam && seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? 2026);

  const ligas = useMemo(() => sortCompetitions([...new Set((comps ?? []).map((c) => c.competition))]), [comps]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [aba, setAba] = useState<'rodada' | 'tabela' | 'artilheiros'>('rodada');
  const duasColunas = useDuasColunas();
  const [menuLiga, setMenuLiga] = useState(false);

  const { data: fixtures, isLoading, isError } = useFutebolFixtures(competition, season);
  const { data: standings, isLoading: loadingStandings } = useFutebolStandings(competition, season, true);
  const { data: leaders, isLoading: loadingLeaders } = useFutebolLeaders(competition, season, true);
  // Mesma regra da agenda: enquanto o board não respondeu, a linha não conclui
  // "sem leitura ainda" e o contador não afirma um total.
  const { data: board, isLoading: leituraCarregando } = useFutebolValueBoard();

  const bestByFixture = useMemo(() => {
    const m = new Map<number, FutebolValueBoardRow>();
    groupBoardByFixture(board || []).forEach((bf) => m.set(bf.fixtureId, bf.best));
    return m;
  }, [board]);

  const rounds = useMemo(() => {
    const seen: string[] = [];
    (fixtures ?? []).forEach((f) => {
      if (f.round && !seen.includes(f.round)) seen.push(f.round);
    });
    return seen;
  }, [fixtures]);
  const porPontos = useMemo(() => ehCampeonatoDePontos(rounds), [rounds]);

  // Abre na rodada do PRÓXIMO jogo, não na mais próxima do relógio. A diferença
  // aparece em copa: na quarta-feira depois das oitavas, o jogo mais próximo em
  // horas ainda é o de ontem, e a tela abria numa fase que já acabou em vez das
  // quartas, que é o que a pessoa foi ver. Terminada a temporada, cai na última.
  // `Date.now()` na hora do efeito, não numa const de módulo: a versão antiga era
  // avaliada no import e errava o dia em aba aberta de véspera.
  useEffect(() => {
    const list = fixtures ?? [];
    if (!list.length || !rounds.length) return;
    const agora = Date.now();
    const quando = (f: FutebolFixture) => {
      const raw = f.kickoff_utc || f.date_utc;
      if (!raw) return NaN;
      return new Date(raw.includes('T') ? `${raw}Z` : `${raw}T00:00:00Z`).getTime();
    };

    let alvo: string | null = null;
    let melhor = Infinity;
    for (const f of list) {
      const t = quando(f);
      if (isNaN(t) || t < agora) continue;
      if (t < melhor) {
        melhor = t;
        alvo = f.round;
      }
    }
    if (!alvo) {
      let ultimo = -Infinity;
      for (const f of list) {
        const t = quando(f);
        if (!isNaN(t) && t > ultimo) {
          ultimo = t;
          alvo = f.round;
        }
      }
    }
    const idx = rounds.indexOf(alvo as string);
    setRoundIdx(idx >= 0 ? idx : 0);
  }, [fixtures, rounds]);

  const currentRound = rounds[roundIdx];

  /** Jogos da rodada agrupados por dia BRT (não por date_utc, que é data UTC). */
  const groups = useMemo(() => {
    const list = (fixtures ?? []).filter((f) => f.round === currentRound);
    const byDay = new Map<string, FutebolFixture[]>();
    list.forEach((f) => {
      const k = brtDayOf(f.kickoff_utc) ?? f.date_utc ?? '—';
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(f);
    });
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [fixtures, currentRound]);

  const jogosDaRodada = useMemo(() => groups.flatMap(([, g]) => g), [groups]);

  /** Os números da temporada, calculados dos jogos que já terminaram. */
  const estat = useMemo(() => {
    const fim = (fixtures ?? []).filter(
      (f) => isFinished(f.status_short) && f.goals_home != null && f.goals_away != null,
    );
    if (!fim.length) return null;
    const n = fim.length;
    const soma = (fn: (f: FutebolFixture) => boolean) => fim.filter(fn).length / n;
    return {
      n,
      gols: fim.reduce((s, f) => s + (f.goals_home ?? 0) + (f.goals_away ?? 0), 0) / n,
      over: soma((f) => (f.goals_home ?? 0) + (f.goals_away ?? 0) > 2.5),
      mando: soma((f) => (f.goals_home ?? 0) > (f.goals_away ?? 0)),
      btts: soma((f) => (f.goals_home ?? 0) > 0 && (f.goals_away ?? 0) > 0),
    };
  }, [fixtures]);

  /** O resumo da rodada aberta: quantas leituras existem, ou quantas bateram. */
  const resumoRodada = useMemo(() => {
    const comLeitura = jogosDaRodada.filter((f) => bestByFixture.has(f.fixture_id));
    const encerrada = jogosDaRodada.length > 0 && jogosDaRodada.every((f) => isFinished(f.status_short));
    const rotulo = encerrada ? (porPontos ? 'Rodada encerrada' : 'Fase encerrada') : porPontos ? 'Nesta rodada' : 'Nesta fase';

    // Enquanto o board não respondeu, `bestByFixture` está vazio e "sem leitura
    // nesta rodada" seria a mesma conclusão prematura que a linha evita. "Sem
    // jogos" não: essa não depende do board, e a rodada vazia é vazia agora.
    if (leituraCarregando && jogosDaRodada.length) {
      return { rotulo, valor: '', texto: 'carregando…' };
    }
    if (!comLeitura.length) {
      return {
        rotulo,
        valor: '—',
        texto: jogosDaRodada.length ? `sem leitura ${porPontos ? 'nesta rodada' : 'nesta fase'}` : 'sem jogos',
      };
    }
    if (encerrada) {
      const bateram = comLeitura.filter((f) => {
        const b = bestByFixture.get(f.fixture_id)!;
        const r = settleFutebol(b, f.goals_home, f.goals_away);
        return r != null && isHit(r);
      }).length;
      return { rotulo, valor: `${bateram}/${comLeitura.length}`, texto: 'leituras bateram' };
    }
    const melhor = comLeitura.reduce((m, f) => Math.max(m, bestByFixture.get(f.fixture_id)!.score), 0);
    return {
      rotulo,
      valor: String(comLeitura.length),
      texto: melhor ? `com leitura · melhor Score ${melhor}` : 'com leitura',
    };
  }, [jogosDaRodada, bestByFixture, porPontos, leituraCarregando]);

  const nTimes = standings?.length ?? new Set((fixtures ?? []).map((f) => f.home_team_id)).size;
  const ondeEstamos = currentRound
    ? porPontos
      ? `${rodadaLonga(currentRound).toLowerCase()} de ${rounds.length}`
      : rodadaLonga(currentRound)
    : null;
  const subtitulo = [`Temporada ${season}`, nTimes ? `${nTimes} times` : null, ondeEstamos].filter(Boolean).join(' · ');
  // No celular a linha não cabe inteira e o fim dela, que é onde está a rodada,
  // era justamente o pedaço que sumia no "…".
  const subtituloCurto = [String(season), ondeEstamos].filter(Boolean).join(' · ');

  // Mata-mata não tem tabela; liga sem tabela é coleta que ainda não veio. A
  // distinção importa: um é assim mesmo, o outro é pendência nossa.
  const vazioTabela = porPontos
    ? { titulo: 'Classificação ainda não coletada', texto: 'Entra assim que a competição passar pela coleta.' }
    : { titulo: 'Competição de mata-mata', texto: 'Sem tabela de pontos, o que vale é o chaveamento de cada fase.' };
  const vazioArtilheiros = { titulo: 'Artilheiros ainda não coletados', texto: 'Entram assim que a competição passar pela coleta.' };

  const campTour = useOnboardingTour(FUT_CAMPEONATO_TOUR_ID, { enabled: !isLoading && !isError });
  const campSteps = useMemo(
    () => makeFutebolCampeonatoSteps({ hasRounds: rounds.length > 0, ehCopa: !porPontos, isMobile: !duasColunas }),
    [rounds.length, porPontos, duasColunas],
  );

  /** O endereço da página do time, com a liga e a temporada em que ele foi visto. */
  const hrefDoTime = (id: number) => `/futebol/time/${id}?c=${competition}&s=${season}`;
  const setSeason = (s: number) => setParams({ s: String(s) }, { replace: true });

  const listaJogos = (
    <div className="flex flex-col gap-4 min-w-0">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full bg-canvas-2 rounded-rebrand-lg" />
        ))
      ) : !jogosDaRodada.length ? (
        <div
          className="bg-white rounded-rebrand-lg px-8 py-11 text-center"
          style={{ border: '1px dashed #ded2b6' }}
        >
          <div
            className="w-9 h-9 mx-auto rounded-rebrand-sm grid place-items-center"
            style={{ background: '#f8f4ea', border: '1px solid #e5d9bd', color: '#c4bda8' }}
          >
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="mt-3.5 text-[15px] font-semibold text-ink">Nenhum jogo nesta rodada</div>
          <div className="mt-1.5 text-[12.5px] leading-relaxed max-w-[380px] mx-auto" style={{ color: '#8d8672' }}>
            O calendário desta competição pode não ter entrado na coleta ainda.
          </div>
        </div>
      ) : (
        groups.map(([day, games]) => {
          const comLeitura = games.filter((f) => bestByFixture.has(f.fixture_id)).length;
          return (
            <div key={day} className="bg-white rounded-rebrand-lg overflow-hidden" style={{ border: '1px solid #ded2b6' }}>
              <div
                className="px-4 py-2.5 flex items-center justify-between gap-2"
                style={{ background: '#f4eddc', borderBottom: '1px solid #ded2b6' }}
              >
                <span className="text-[10.5px] uppercase tracking-[0.16em] font-bold" style={{ color: '#6b6350' }}>
                  {fmtDayHeader(day)}
                </span>
                <span className="text-[10.5px]" style={{ color: '#8d8672' }}>
                  {games.length} {games.length === 1 ? 'jogo' : 'jogos'}
                  {sufixoDeLeitura(leituraCarregando, comLeitura)}
                </span>
              </div>
              {games.map((f) => (
                <FixtureRow
                  key={f.fixture_id}
                  fixture={f}
                  best={bestByFixture.get(f.fixture_id) ?? null}
                  leituraCarregando={leituraCarregando}
                  // Sem `onClick`: aqui não há painel, então o clique simples vai
                  // para o mesmo lugar que o do meio e o `<Link>` basta.
                  to={hrefDaSaida(f.fixture_id, bestByFixture.get(f.fixture_id))}
                />
              ))}
            </div>
          );
        })
      )}
    </div>
  );

  // "após N rodadas" pelo time que mais jogou: com jogo adiado, os times têm
  // números diferentes, e o maior é o que responde "a tabela está em que altura".
  const rodadasJogadas = (standings ?? []).reduce((m, r) => Math.max(m, r.played), 0);
  const legendaTabela = rodadasJogadas
    ? `após ${rodadasJogadas} ${rodadasJogadas === 1 ? 'rodada' : 'rodadas'}`
    : undefined;

  // O que vai na coluna da direita depende de onde a competição está:
  //  - pontos corridos: a classificação, sempre;
  //  - copa na fase de grupos: as tabelas dos grupos, que é a pergunta do
  //    momento (a chave ali seria uma parede de "a definir");
  //  - copa no mata-mata: a chave.
  const temMataMata = rounds.some((r) => ehMataMata(r));
  const naFaseDeGrupos = !porPontos && /group stage/i.test(currentRound ?? '');
  const temGrupos = (standings ?? []).some((r) => /^group\s/i.test(r.group_name ?? ''));

  const chave =
    !porPontos && temMataMata ? (
      <ChaveamentoBracket
        fixtures={fixtures ?? []}
        rounds={rounds}
        idxSelecionado={roundIdx}
        competition={competition}
        // O chaveamento mostra confronto, não pick: sem filtro, mas pelo
        // módulo — URL de jogo montada à mão foi como a #344 começou.
        hrefDoJogo={hrefDoJogo}
      />
    ) : null;
  const grupos = <GruposFase rows={standings} loading={loadingStandings} hrefDoTime={hrefDoTime} />;
  const tabela = (
    <StandingsTable
      rows={standings}
      loading={loadingStandings}
      hrefDoTime={hrefDoTime}
      legenda={legendaTabela}
      vazio={vazioTabela}
    />
  );
  const artilheiros = <ScorersCard leaders={leaders} loading={loadingLeaders} vazio={vazioArtilheiros} />;
  const painelDireita = porPontos ? tabela : naFaseDeGrupos && temGrupos ? grupos : (chave ?? tabela);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack backTo="/futebol/campeonatos" />
      <OnboardingTour tourId={FUT_CAMPEONATO_TOUR_ID} steps={campSteps} run={campTour.run} onFinish={campTour.finish} />

      {/* Faixa do campeonato: o rótulo da página, em areia, com o brasão, os
          números da temporada e a troca de liga. */}
      <div data-tour="fut-camp-header" style={{ background: '#f4eddc', borderBottom: '1px solid #ded2b6' }}>
        <div className="max-w-[1240px] w-full mx-auto px-4 md:px-6 py-3.5 md:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="shrink-0 w-10 h-10 rounded-rebrand-sm grid place-items-center"
              style={{ background: '#fff', border: '1px solid #ded2b6' }}
            >
              <LigaCrest slug={competition} size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[19px] md:text-[22px] font-bold tracking-tight text-ink truncate">
                {competitionLabel(competition)}
              </h1>
              <div className="text-[11.5px] md:text-[12px] truncate" style={{ color: '#8d8672' }}>
                <span className="md:hidden">{subtituloCurto}</span>
                <span className="hidden md:inline">{subtitulo}</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Popover open={menuLiga} onOpenChange={setMenuLiga}>
                <PopoverTrigger asChild>
                  <button
                    className="h-8 px-3 rounded-rebrand-sm bg-white text-[12px] font-semibold text-ink inline-flex items-center gap-1.5"
                    style={{ border: `1px solid ${menuLiga ? '#0a3d2e' : '#ded2b6'}` }}
                  >
                    <span className="hidden sm:inline">{competitionLabel(competition)}</span>
                    <span className="sm:hidden">Trocar</span>
                    <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8d8672' }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={6}
                  className="theme-bolao w-[250px] p-0 rounded-rebrand-lg border-0 shadow-lg overflow-hidden"
                  style={{ background: '#fff', border: '1px solid #ded2b6' }}
                >
                  <div
                    className="px-3.5 py-2 text-[9.5px] uppercase tracking-[0.14em] font-bold"
                    style={{ background: '#fdfbf6', borderBottom: '1px solid #f1e9d6', color: '#8d8672' }}
                  >
                    Competição
                  </div>
                  <div className="max-h-[320px] overflow-y-auto minimal-scrollbar">
                    {ligas.map((c, i) => (
                      <Link
                        key={c}
                        to={`/futebol/campeonato/${c}`}
                        // Fechar o menu é efeito colateral da escolha, não a
                        // navegação em si — por isso não interceptamos: o
                        // `<Link>` navega e o menu fecha junto. No clique do meio
                        // o menu também fecha, o que é o certo: a aba nova levou
                        // a escolha e esta aqui volta ao estado neutro (#341).
                        onClick={() => setMenuLiga(false)}
                        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left"
                        style={{
                          background: c === competition ? '#f4eddc' : '#fff',
                          borderTop: i === 0 ? 'none' : '1px solid #f1e9d6',
                        }}
                      >
                        <LigaCrest slug={c} size={18} />
                        <span
                          className={`min-w-0 truncate text-[12.5px] text-ink ${c === competition ? 'font-bold' : 'font-medium'}`}
                        >
                          {competitionLabel(c)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {seasons.length > 1 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="hidden sm:inline-flex h-8 px-3 rounded-rebrand-sm bg-white text-[12px] font-semibold text-ink items-center gap-1.5 tabular-nums"
                      style={{ border: '1px solid #ded2b6' }}
                    >
                      {season}
                      <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8d8672' }} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={6}
                    className="theme-bolao w-[120px] p-0 rounded-rebrand-lg border-0 shadow-lg overflow-hidden"
                    style={{ background: '#fff', border: '1px solid #ded2b6' }}
                  >
                    {seasons.map((s, i) => (
                      <button
                        key={s}
                        onClick={() => setSeason(s)}
                        className="w-full px-3.5 py-2.5 text-left text-[12.5px] tabular-nums text-ink"
                        style={{
                          background: s === season ? '#f4eddc' : '#fff',
                          borderTop: i === 0 ? 'none' : '1px solid #f1e9d6',
                          fontWeight: s === season ? 700 : 500,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : (
                <span
                  className="hidden sm:inline-flex h-8 px-3 rounded-rebrand-sm bg-white text-[12px] font-semibold text-ink items-center tabular-nums"
                  style={{ border: '1px solid #ded2b6' }}
                >
                  {season}
                </span>
              )}

              <Link
                to="/futebol/jogos"
                className="hidden md:inline-flex h-8 px-3 rounded-rebrand-sm bg-white text-[12px] font-semibold text-ink items-center gap-1.5 hover:bg-canvas-2 transition"
                style={{ border: '1px solid #ded2b6' }}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Jogos do dia
              </Link>
            </div>
          </div>

          {/* Os números da temporada. Saem dos jogos já encerrados, então numa
              competição que ainda não começou eles simplesmente não aparecem. */}
          {estat && (
            <div
              className="mt-3.5 pt-3.5 grid grid-cols-2 md:flex md:items-center gap-3 md:gap-8"
              style={{ borderTop: '1px solid #e5d9bd' }}
            >
              <Estatistica rotulo="Média de gols" valor={d1(estat.gols)} unidade="por jogo" />
              <Estatistica rotulo="Mais de 2,5" valor={pct(estat.over)} unidade="dos jogos" />
              <Estatistica rotulo="Vitória do mandante" valor={pct(estat.mando)} unidade="na temporada" />
              <Estatistica rotulo="Ambos marcam" valor={pct(estat.btts)} unidade="dos jogos" />
              <div className="col-span-2 md:ml-auto md:pl-8" style={{ borderLeft: 'none' }}>
                <div className="text-[9.5px] uppercase tracking-[0.14em] font-bold" style={{ color: '#8d8672' }}>
                  {resumoRodada.rotulo}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span
                    className="text-[18px] leading-none font-semibold tabular-nums"
                    style={{ color: resumoRodada.valor === '—' ? '#c4bda8' : '#0a3d2e' }}
                  >
                    {resumoRodada.valor}
                  </span>
                  <span className="text-[11px]" style={{ color: '#6b6350' }}>
                    {resumoRodada.texto}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1240px] w-full mx-auto px-4 md:px-6 py-4 md:py-5 flex-1 min-w-0">
        {isError ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-status-danger">
            Erro ao carregar os jogos.
          </div>
        ) : (
          <>
            {rounds.length > 0 && (
              <div data-tour="fut-camp-rodada" className="mb-4">
                <ReguaRodadas
                  rounds={rounds}
                  idx={roundIdx}
                  onIdx={setRoundIdx}
                  jogosNaRodada={jogosDaRodada.length}
                  porPontos={porPontos}
                />
              </div>
            )}

            {/* Celular: três abas, porque tabela e artilheiros embaixo da lista de
                jogos ficam a uma rolagem inteira de distância. */}
            <div
              data-tour="fut-camp-abas"
              className="lg:hidden mb-3 inline-flex p-0.5 rounded-rebrand-sm"
              style={{ background: '#f1e9d6', border: '1px solid #e5d9bd' }}
            >
              {(['rodada', 'tabela', 'artilheiros'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  className="h-7 px-3 rounded-[7px] text-[12px] capitalize transition"
                  style={
                    aba === a
                      ? { background: '#fff', color: '#1a1d1a', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.06)' }
                      : { color: '#6b6350', fontWeight: 500 }
                  }
                >
                  {a === 'rodada'
                    ? porPontos
                      ? 'Rodada'
                      : 'Fase'
                    : a === 'tabela'
                      ? porPontos
                        ? 'Tabela'
                        : naFaseDeGrupos && temGrupos
                          ? 'Grupos'
                          : 'Chave'
                      : 'Artilheiros'}
                </button>
              ))}
            </div>

            <div className="hidden lg:grid grid-cols-[1.35fr_1fr] gap-5 items-start">
              {listaJogos}
              <div data-tour="fut-camp-tabela" className="flex flex-col gap-4 min-w-0">
                {painelDireita}
                {artilheiros}
              </div>
            </div>

            <div className="lg:hidden min-w-0">
              {aba === 'rodada' && listaJogos}
              {aba === 'tabela' &&
                (porPontos ? (
                  <StandingsTable
                    rows={standings}
                    loading={loadingStandings}
                    hrefDoTime={hrefDoTime}
                    compacto
                    legenda={legendaTabela}
                    vazio={vazioTabela}
                  />
                ) : (
                  painelDireita
                ))}
              {aba === 'artilheiros' && artilheiros}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
