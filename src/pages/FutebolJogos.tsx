import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarOff, ChevronDown } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { FixtureRow } from '@/components/futebol/FixtureRow';
import { AgendaDateStrip } from '@/components/futebol/AgendaDateStrip';
import { JogoResumoPanel } from '@/components/futebol/JogoResumoPanel';
import {
  useFutebolFixturesByDay,
  useFutebolFixtureDays,
  useFutebolValueBoard,
  useFutebolValueHistory,
  useFutebolAccess,
  useVitrine,
} from '@/hooks/use-futebol-data';
import type { FutebolFixtureByDay, FutebolValueBoardRow } from '@/services/futebol-data.service';
import { addDays, brtToday, fmtDayHeader } from '@/utils/futebol-datas';
import { groupBoardByFixture } from '@/utils/futebol-score';
import { sufixoDeLeitura } from '@/utils/futebol-leitura';
import { mergeBoardAndHistory } from '@/utils/futebol-history';
import { hrefDaSaida } from '@/utils/futebol-links';
import { competitionLabel, sortCompetitions } from '@/utils/futebol-competitions';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUT_JOGOS_TOUR_ID, makeFutebolJogosSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { useDemoFutebolBoard } from '@/components/onboarding/demo/use-demo-futebol';
import {
  demoFutebolNumeros,
  demoFutebolPremissas,
  makeDemoAgenda,
} from '@/components/onboarding/demo/futebol';

/**
 * Agenda de jogos por DIA, multi-liga.
 *
 * Antes esta tela era campeonato → rodada → dia, o que obrigava o usuário a saber em
 * qual competição estava o jogo antes de achar o jogo, e "Rodada 21" atravessa três
 * datas. Agora o eixo é o dia, e a competição é só agrupamento dentro dele.
 *
 * O que era rodada, temporada, classificação e artilheiros mudou pra
 * /futebol/campeonato/:slug, onde esses conceitos fazem sentido (são por liga).
 *
 * Dados: uma chamada get_futebol_fixtures_by_day por dia (~16 KB no pior dia do
 * mart) no lugar das 8 chamadas de temporada inteira que o useFutebolFixturesMulti
 * fazia (~850 KB). O dia vem em BRT do banco, então jogo de 21:30 não escorrega
 * mais pro dia seguinte.
 */

/** Breakpoint do painel. Casado com o `lg:` do grid: se divergir, o clique abre um painel invisível. */
const PANEL_MQ = '(min-width: 1024px)';

function useHasPanel(): boolean {
  const [has, setHas] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(PANEL_MQ).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(PANEL_MQ);
    const onChange = (e: MediaQueryListEvent) => setHas(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return has;
}

/**
 * Intervalo da régua, quantizado no mês do dia escolhido (com folga de 7 dias pras
 * pontas). Quantizar importa: se o intervalo fosse "dia ± 15", cada clique de seta
 * mudaria a query key e refetcharia. Assim, andar dentro do mês reusa o cache.
 */
function monthRange(dayKey: string): { from: string; to: string } {
  const [y, m] = dayKey.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: addDays(`${y}-${mm}-01`, -7),
    to: addDays(`${y}-${mm}-${String(ultimoDia).padStart(2, '0')}`, 7),
  };
}

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function FutebolJogos() {
  const hasPanel = useHasPanel();
  const [params, setParams] = useSearchParams();

  const diaParam = params.get('dia');
  const dia = DIA_RE.test(diaParam ?? '') ? (diaParam as string) : brtToday();
  const jogoParam = Number(params.get('jogo')) || null;

  const { from, to } = useMemo(() => monthRange(dia), [dia]);
  const { data: fixtures, isLoading, isError } = useFutebolFixturesByDay(dia);
  const { data: dias } = useFutebolFixtureDays(from, to);
  // O carregando do board é separado do carregando dos jogos do dia: a agenda
  // consegue listar o confronto antes de saber se ele tem leitura, e é isso que
  // ela deve fazer. O que ela não pode é contar "0 com leitura" nem escrever
  // "sem leitura ainda" enquanto a resposta não chegou — isso é conclusão.
  const { data: boardCorrente, isLoading: boardCarregando } = useFutebolValueBoard();
  const { data: histRows, isLoading: histCarregando } = useFutebolValueHistory();
  const { vitrine } = useVitrine();
  const { data: access } = useFutebolAccess();

  // A agenda lia SÓ o board, e o board some no apito (migration 102). Resultado:
  // o jogo que começou virava "sem leitura ainda, odds entram perto do jogo" —
  // com o painel ao lado exibindo a leitura daquele mesmo jogo, e a tela de
  // Oportunidades listando as oportunidades dele. Uma tela desmentia a outra.
  //
  // A correção é ler o que Oportunidades já lia: board para o que ainda não
  // apitou, foto do apito para o que já passou. A mesma função, para as duas
  // telas contarem a mesma história do mesmo dia.
  const board = useMemo(
    () => mergeBoardAndHistory(boardCorrente ?? [], histRows ?? [], Date.now(), vitrine),
    [boardCorrente, histRows, vitrine],
  );

  const jogosTour = useOnboardingTour(FUT_JOGOS_TOUR_ID, { enabled: !isLoading && !isError });
  const isDemo = jogosTour.run;
  // No tour os dados são de mentira e chegam prontos: não há espera a mostrar.
  // As DUAS fontes contam: desde que a agenda passou a somar a foto do apito, o
  // board sozinho responde antes e a tela concluía "sem leitura ainda" para o
  // jogo encerrado — a conclusão prematura que o esqueleto existe para evitar —,
  // trocando por pick meio segundo depois. Mesma regra da home (FutebolHoje).
  const leituraCarregando = isDemo ? false : boardCarregando || histCarregando;

  const effFixtures = useMemo<FutebolFixtureByDay[]>(
    () => (isDemo ? makeDemoAgenda(dia) : (fixtures ?? [])),
    [isDemo, dia, fixtures],
  );

  // A demonstração herda a escala do produto (#333). Aqui a janela É o board:
  // a agenda não recorta por dia o que já veio do dia, e é dele que a leitura
  // de cada confronto sai.
  const demoBoard = useDemoFutebolBoard(board);

  const bestByFixture = useMemo(() => {
    const m = new Map<number, FutebolValueBoardRow>();
    if (isDemo) {
      demoBoard.forEach((r) => m.set(r.fixture_id, r));
      return m;
    }
    groupBoardByFixture(board || []).forEach((bf) => m.set(bf.fixtureId, bf.best));
    return m;
  }, [board, isDemo, demoBoard]);

  const jogosPorDia = useMemo(() => {
    const m = new Map<string, number>();
    (dias ?? []).forEach((d) => m.set(d.day_brt, Number(d.jogos)));
    return m;
  }, [dias]);

  /** Jogos do dia agrupados por competição, na ordem canônica das ligas. */
  const grupos = useMemo(() => {
    const byComp = new Map<string, FutebolFixtureByDay[]>();
    effFixtures.forEach((f) => {
      const k = f.competition || '—';
      if (!byComp.has(k)) byComp.set(k, []);
      byComp.get(k)!.push(f);
    });
    // Ordena por horário dentro da liga. A RPC já devolve ordenado, mas o front não
    // deveria depender disso pra desenhar certo (os dados de exemplo do tour vêm na
    // ordem do array, não do relógio).
    return sortCompetitions([...byComp.keys()]).map(
      (c) =>
        [
          c,
          [...byComp.get(c)!].sort((a, b) => (a.kickoff_utc ?? '').localeCompare(b.kickoff_utc ?? '')),
        ] as const,
    );
  }, [effFixtures]);

  const selected = useMemo(
    () => effFixtures.find((f) => f.fixture_id === jogoParam) ?? null,
    [effFixtures, jogoParam],
  );

  // Jogo que não existe no dia (link velho, ou o usuário trocou o dia na mão) não
  // pode deixar `?jogo=` pendurado na URL.
  useEffect(() => {
    if (jogoParam && !isLoading && !selected && effFixtures.length > 0) {
      const next = new URLSearchParams(params);
      next.delete('jogo');
      setParams(next, { replace: true });
    }
  }, [jogoParam, selected, isLoading, effFixtures.length, params, setParams]);

  // Durante o tour, o painel da direita não pode estar vazio: o passo fala do
  // resumo e apontava para um "clique num jogo da lista". Escolhe sozinho o jogo
  // de melhor leitura do dia (ou o primeiro, se nenhum tiver preço) só enquanto o
  // tour roda; fora dele o vazio continua sendo o estado inicial, porque a
  // escolha é do usuário.
  useEffect(() => {
    if (!jogosTour.run || !hasPanel || jogoParam || !effFixtures.length) return;
    const melhor = [...effFixtures].sort(
      (a, b) => (bestByFixture.get(b.fixture_id)?.score ?? -1) - (bestByFixture.get(a.fixture_id)?.score ?? -1),
    )[0];
    if (melhor) setParams({ dia, jogo: String(melhor.fixture_id) }, { replace: true });
  }, [jogosTour.run, hasPanel, jogoParam, effFixtures, bestByFixture, dia, setParams]);

  const selectDay = (d: string) => {
    // replace pra seta de dia não empilhar histórico; o jogo selecionado cai fora
    // porque ele pertencia ao dia anterior.
    setParams({ dia: d }, { replace: true });
  };

  /**
   * O que o clique SIMPLES faz na linha: abrir o painel.
   *
   * Só existe quando há painel. Em tela estreita não há, e aí não interceptamos
   * nada — o `<Link>` da linha navega sozinho para a tela do jogo, que é o mesmo
   * destino do clique do meio. A versão anterior cancelava o link para chamar
   * `navigate` na mesma URL do `href`, o que funcionava e não servia para nada.
   */
  const abrirPainel = (f: FutebolFixtureByDay) => {
    // push: o voltar do navegador fecha o painel, que é o que o usuário espera.
    setParams({ dia, jogo: String(f.fixture_id) });
  };

  const closePanel = () => setParams({ dia }, { replace: true });

  /** Dia mais próximo com jogo, pra oferecer saída num dia vazio. */
  const proximoComJogo = useMemo(() => {
    const comJogo = (dias ?? []).filter((d) => Number(d.jogos) > 0).map((d) => d.day_brt);
    const depois = comJogo.find((d) => d > dia);
    if (depois) return depois;
    return [...comJogo].reverse().find((d) => d < dia) ?? null;
  }, [dias, dia]);

  const total = effFixtures.length;
  /** Quantos jogos do dia têm leitura com preço: é o que o resumo do dia promete. */
  const comLeitura = effFixtures.filter((f) => bestByFixture.has(f.fixture_id)).length;

  /**
   * Campeonatos recolhidos. Em dia cheio (16 jogos em 4 ligas) o usuário quase
   * sempre quer varrer uma liga por vez. O estado é por sessão de tela e some ao
   * trocar de dia, porque cada dia tem a sua lista.
   */
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  useEffect(() => setRecolhidos(new Set()), [dia]);
  const alternarGrupo = (comp: string) =>
    setRecolhidos((s) => {
      const n = new Set(s);
      if (n.has(comp)) n.delete(comp);
      else n.add(comp);
      return n;
    });
  const jogosSteps = useMemo(() => makeFutebolJogosSteps({ hasPanel }), [hasPanel]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={FUT_JOGOS_TOUR_ID} steps={jogosSteps} run={jogosTour.run} onFinish={jogosTour.finish} />

      {/* Barra do dia: faixa areia colada no cabeçalho, com título, resumo do dia e
          a régua de datas à direita (protótipo "Futebol Jogos"). O bege é o rótulo
          da página; o conteúdo abaixo é que fica branco. */}
      <div style={{ background: 'var(--canvas-2)', borderBottom: '1px solid #ded2b6' }}>
        <div className="max-w-[1240px] w-full mx-auto px-4 md:px-6 py-2.5 flex items-center gap-x-3 gap-y-2 flex-wrap">
          <h1 className="font-display text-[17px] font-bold tracking-tight text-ink">Jogos</h1>
          {isDemo && <DemoBadge />}
          <span className="text-[12.5px]" style={{ color: '#6b6350' }}>
            {isLoading
              ? 'carregando…'
              : total === 0
                ? 'nenhum jogo neste dia'
                : `${total} ${total === 1 ? 'jogo' : 'jogos'} · ${grupos.length} ${grupos.length === 1 ? 'campeonato' : 'campeonatos'}${sufixoDeLeitura(leituraCarregando, comLeitura)}`}
          </span>
          <div className="ml-auto min-w-0" data-tour="fut-jogos-datas">
            <AgendaDateStrip selectedDay={dia} onSelectDay={selectDay} jogosPorDia={jogosPorDia} />
          </div>
        </div>
      </div>

      {/* A faixa do dia é rótulo, não parte do card: sem respiro embaixo dela, a
          lista e o painel pareciam grudados na régua de datas. */}
      <div className="max-w-[1240px] w-full mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 flex-1 w-full">
        {isDemo && (
          <div className="mb-4">
            <DemoRibbon show />
          </div>
        )}

        {isError ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-status-danger">
            Erro ao carregar os jogos.
          </div>
        ) : (
          // 50/50 da Direção B: a lista não precisa de mais da metade (times
          // empilhados cabem), e o painel deixa de parecer um encosto.
          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <div data-tour="fut-jogos-lista" className="min-w-0">
              {isLoading ? (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />
                  ))}
                </div>
              ) : total === 0 ? (
                <div className="bg-white rounded-[20px] p-12 text-center" style={{ border: '1px solid #ded2b6' }}>
                  <CalendarOff className="w-6 h-6 mx-auto" style={{ color: '#c4bda8' }} />
                  <p className="text-[13.5px] mt-2.5" style={{ color: '#6b6350' }}>Nenhum jogo em {fmtDayHeader(dia)}.</p>
                  {proximoComJogo && (
                    <button
                      onClick={() => selectDay(proximoComJogo)}
                      className="mt-3 h-9 px-4 rounded-rebrand-sm text-xs font-semibold bg-forest text-canvas hover:bg-forest-2 transition inline-flex items-center gap-1.5"
                    >
                      Ir para {fmtDayHeader(proximoComJogo)}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                /* Card ÚNICO com as ligas como sub-headers, em vez de um card por
                   liga: menos moldura repetida, a lista vira uma coisa só. O nome
                   da liga é o link pra página do campeonato. */
                <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: '1px solid #ded2b6' }}>
                  {grupos.map(([comp, jogos]) => {
                    const recolhido = recolhidos.has(comp);
                    return (
                      <div key={comp}>
                        {/* O cabeçalho recolhe o campeonato; a seta ao lado do nome
                            abre a página dele. Duas ações separadas, cada uma no seu
                            alvo, em vez de um clique com dois significados. */}
                        <div
                          className="px-4 py-2 flex items-center gap-2"
                          style={{ background: 'var(--canvas-2)', borderTop: '1px solid #ded2b6', borderBottom: '1px solid #ded2b6' }}
                        >
                          <button
                            onClick={() => alternarGrupo(comp)}
                            aria-expanded={!recolhido}
                            className="min-w-0 flex items-center gap-1.5 bg-transparent border-0 p-0 py-1 -my-1 cursor-pointer text-left"
                          >
                            <ChevronDown
                              className="w-3.5 h-3.5 shrink-0 transition-transform"
                              style={{ color: '#8d8672', transform: `rotate(${recolhido ? -90 : 0}deg)` }}
                            />
                            <span
                              className="text-[10.5px] uppercase tracking-[0.16em] font-bold truncate"
                              style={{ color: '#6b6350' }}
                            >
                              {competitionLabel(comp)}
                            </span>
                          </button>
                          <Link
                            to={`/futebol/campeonato/${comp}`}
                            aria-label={`Abrir ${competitionLabel(comp)}`}
                            className="shrink-0 w-5 h-5 grid place-items-center rounded hover:text-forest transition"
                            style={{ color: '#8d8672' }}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                          <span className="ml-auto text-[10.5px] shrink-0 tabular-nums" style={{ color: '#8d8672' }}>
                            {jogos.length} {jogos.length === 1 ? 'jogo' : 'jogos'}
                            {sufixoDeLeitura(
                              leituraCarregando,
                              jogos.filter((j) => bestByFixture.has(j.fixture_id)).length,
                            )}
                          </span>
                        </div>
                        {!recolhido &&
                          jogos.map((f) => (
                            <FixtureRow
                              key={f.fixture_id}
                              fixture={f}
                              best={bestByFixture.get(f.fixture_id) ?? null}
                              leituraCarregando={leituraCarregando}
                              selected={f.fixture_id === jogoParam}
                              // A linha mostra o pick; o link leva a ELE, e não
                              // ao desempate padrão da tela do jogo (#344).
                              to={hrefDaSaida(f.fixture_id, bestByFixture.get(f.fixture_id))}
                              onClick={hasPanel ? () => abrirPainel(f) : undefined}
                              locked={isDemo ? false : !access?.unlocked}
                            />
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Painel só no desktop. Em mobile o clique já navegou pra tela cheia. */}
            {hasPanel && (
              <div data-tour="fut-jogos-painel" className="min-w-0 lg:sticky lg:top-4">
                {selected ? (
                  <JogoResumoPanel
                    fixture={selected}
                    best={bestByFixture.get(selected.fixture_id) ?? null}
                    leituraCarregando={leituraCarregando}
                    onClose={closePanel}
                    demo={
                      isDemo ? { premissas: demoFutebolPremissas, numeros: demoFutebolNumeros } : undefined
                    }
                  />
                ) : (
                  <div className="bg-white rounded-[20px] p-10 text-center" style={{ border: '1px solid #ded2b6' }}>
                    <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: '#8d8672' }}>
                      Resumo do jogo
                    </div>
                    <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#6b6350' }}>
                      Clique num jogo da lista para ver por que aquela é a leitura, sem sair da agenda.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
