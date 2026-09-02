import { useMemo, useState, useEffect } from 'react';
import { usePostHog } from '@posthog/react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolValueBoard, useFutebolValueHistory, useFutebolAccess, useFutebolFixturesMulti, useFutebolAlertedPicks, useFutebolCompetitions, useVitrine } from '@/hooks/use-futebol-data';
import { useFutebolPublicationAlerts } from '@/hooks/use-futebol-publication-alerts';
import FutebolDayStepper from '@/components/FutebolDayStepper';
import { Blur, FutebolAccessBanner } from '@/components/futebol/FutebolGate';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import { AlertasPublicacaoAtalho, AlertasPublicacaoCartao, AlertasPublicacaoStatus } from '@/components/futebol/AlertasPublicacao';
import { FaixasLegenda } from '@/components/futebol/FaixasLegenda';
import { OportunidadesFiltros, type MarketFilter } from '@/components/futebol/OportunidadesFiltros';
import { draftFromBoardRow } from '@/components/futebol/registrar-aposta-utils';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import { competitionLabel, sortCompetitions, fixtureScopesFor } from '@/utils/futebol-competitions';
import {
  pickLabel, marketLabel, fmtEdgeScore,
  faixaBadgeCls, faixaWord, faixaTone, chancePct, edgeToneCls,
  opcoesDeFaixa, passaNoFiltroDeFaixas, versaoDaJanela, ehDestaque, compararOportunidades,
  FAIXAS_FILTRO_PADRAO, type Faixa,
} from '@/utils/futebol-score';
import { settleFutebol, resultBadge, resumoDoDia, type BetResult } from '@/utils/futebol-settlement';
import { mercadoEstaOculto } from '@/utils/futebol-mercados-ocultos';
import { mergeBoardAndHistory, historyWindow, HISTORY_WINDOW_DAYS } from '@/utils/futebol-history';
import { oppKey, oportunidadesDoDia, type OppLike } from '@/utils/futebol-registradas';
import { parseUtc, brtDayOf, brtDateStr, fmtTime, hasKickoffPassed, addDays } from '@/utils/futebol-datas';
import { onboardingHref, ONBOARDING_SRC_ALERTAS_FUTEBOL } from '@/utils/onboarding-return';
import { useNow } from '@/hooks/use-now';
import type { FutebolValueBoardRow, FutebolAlertedPick, FutebolFixture } from '@/services/futebol-data.service';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUT_OPP_TOUR_ID, makeFutebolOportunidadesSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { useDemoFutebolBoard } from '@/components/onboarding/demo/use-demo-futebol';

const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN']);

// O `kickoffMs`, o `brtDayStr` e o `TODAY_BRT` que moravam aqui eram cópia
// literal do que `futebol-datas.ts` já exporta como `parseUtc`, `brtDayOf` e
// `brtToday`. Saíram pelo mesmo motivo que as funções de calendário do PR #259
// não entraram: duas cópias de aritmética de fuso é como se erra fuso.
//
// O `TODAY_BRT` ainda violava a regra escrita em futebol-datas.ts ("chamar na
// hora do uso, não guardar em const de módulo"), e isso passou a MORDER quando
// esta tela ganhou o `mergeBoardAndHistory`, que lê o relógio a cada render:
// eram dois "hoje" diferentes, um congelado no import e outro vivo, que
// discordam na virada do dia. Agora existe um `hoje` só, no corpo do
// componente, e é o mesmo instante que alimenta a fusão.
/** `HH:MM` em BRT, com travessão quando não há horário. */
const fmtHour = (raw: string | null): string => fmtTime(raw) || '—';

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}
function Crest({ teamId, name, size = 20 }: { teamId: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';
const GRID = 'grid grid-cols-[56px_64px_1fr_140px_64px_80px_72px_28px] gap-3 items-center';

// Linha da tabela (desktop)
function OppRow({ o, onClick, muted, locked, result, homeGoals, awayGoals }: {
  o: OppLike; onClick: () => void; muted?: boolean; locked?: boolean;
  result?: BetResult | null; homeGoals?: number | null; awayGoals?: number | null;
}) {
  const pick = pickLabel(o, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  const showLock = !!locked && !result; // histórico (com resultado) é sempre visível
  const hasScore = homeGoals != null && awayGoals != null;
  // Sem os números do instante em que era oportunidade, mostra "—" em vez de
  // chutar faixa (faixaWord de vazio diria "Baixa", que seria falso).
  const badgeCls = o.faixa != null ? faixaBadgeCls(o.faixa) : 'bg-canvas-2 text-ink-3 border border-line';
  return (
    <button onClick={onClick} className={`${GRID} w-full text-left px-5 py-3 border-t border-line hover:bg-canvas-2 transition ${muted ? 'opacity-60' : ''}`}>
      <span className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[16px] w-10 h-9 ${badgeCls}`}>{o.score ?? '—'}</span>
      <span className={`px-1.5 h-5 w-fit inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${badgeCls}`}>{o.faixa != null ? faixaWord(o.faixa) : '—'}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <Crest teamId={o.home_team_id} name={o.home_team_name} size={20} />
          <Crest teamId={o.away_team_id} name={o.away_team_name} size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold tracking-tight text-ink truncate"><Blur active={showLock}>{pick}</Blur></span>
            {result && <ResultBadge r={result} />}
          </div>
          <div className="text-[11px] text-ink-3 truncate">
            {hasScore
              ? `${o.home_team_name} ${homeGoals} × ${awayGoals} ${o.away_team_name}`
              : `${o.home_team_name} × ${o.away_team_name}`}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
        <div className="text-[10px] mt-1 tabular-nums text-ink-3 truncate">{competitionLabel(o.competition)} · {fmtHour(o.kickoff_utc)}</div>
      </div>
      <div className="text-right tabular-nums text-[13px] font-semibold text-ink"><Blur active={showLock}>{chance != null ? `${chance}%` : '—'}</Blur></div>
      <div className="text-right tabular-nums text-[13px] font-semibold text-ink"><Blur active={showLock}>{o.best_odd.toFixed(2)}</Blur></div>
      <div className={`text-right tabular-nums text-[14px] font-bold ${edgeToneCls(o.edge)}`}><Blur active={showLock}>{o.edge != null ? fmtEdgeScore(o.edge) : '—'}</Blur></div>
      <ChevronRight className="w-4 h-4 text-ink-3 justify-self-end" />
    </button>
  );
}

// Card (mobile)
function OppMobileCard({ o, onClick, locked, result, homeGoals, awayGoals, canRegister = false }: {
  o: OppLike; onClick: () => void; locked?: boolean;
  result?: BetResult | null; homeGoals?: number | null; awayGoals?: number | null; canRegister?: boolean;
}) {
  const pick = pickLabel(o, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  const showLock = !!locked && !result;
  const hasScore = homeGoals != null && awayGoals != null;
  return (
    <div className="w-full rounded-rebrand-md bg-white border border-line overflow-hidden">
      <button onClick={onClick} className="w-full text-left p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex items-center -space-x-1 shrink-0 pt-0.5">
            <Crest teamId={o.home_team_id} name={o.home_team_name} size={24} />
            <Crest teamId={o.away_team_id} name={o.away_team_name} size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 h-5 inline-flex items-center rounded text-[9px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
              {o.faixa != null && (
                <span className={`px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(o.faixa)}`}>{faixaWord(o.faixa)}</span>
              )}
              {result && <ResultBadge r={result} />}
            </div>
            <div className="text-[15px] font-semibold tracking-tight mt-1.5 text-ink"><Blur active={showLock}>{pick}</Blur></div>
            <div className="text-[11px] text-ink-3 truncate">
              {hasScore
                ? `${o.home_team_name} ${homeGoals} × ${awayGoals} ${o.away_team_name} · ${fmtHour(o.kickoff_utc)}`
                : `${o.home_team_name} × ${o.away_team_name} · ${fmtHour(o.kickoff_utc)}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[8px] uppercase tracking-[0.14em] font-semibold text-ink-3">Score</div>
            <div className="text-[22px] font-bold tabular-nums tracking-tight leading-none text-forest">{o.score ?? '—'}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t border-line">
          {/* A cor do Valor sai de `edgeToneCls`, a mesma da linha do desktop:
              verde só quando positivo, neutro em zero ou negativo. Verde fixo
              aqui pintava de vantagem uma diferença que não existe. */}
          {[
            { label: 'Chance', valor: chance != null ? `${chance}%` : '—', cls: 'text-ink' },
            { label: 'Odd', valor: o.best_odd.toFixed(2), cls: 'text-ink' },
            { label: 'Valor', valor: o.edge != null ? fmtEdgeScore(o.edge) : '—', cls: edgeToneCls(o.edge) },
          ].map(({ label, valor, cls }) => (
            <div key={label}>
              <div className="text-[8px] uppercase tracking-[0.14em] font-semibold text-ink-3">{label}</div>
              <div className={`text-[13px] font-semibold tabular-nums leading-none mt-0.5 ${cls}`}><Blur active={showLock}>{valor}</Blur></div>
            </div>
          ))}
        </div>
      </button>
      {canRegister && (
        <div className="px-3.5 pb-3.5 -mt-0.5">
          <RegistrarApostaCTA variant="text" draft={draftFromBoardRow(o)} />
        </div>
      )}
    </div>
  );
}

function FaixaKpi({ n, label, tone }: { n: number; label: string; tone: 'alta' | 'media' | 'baixa' }) {
  const style = tone === 'alta' ? { background: '#dcefe2', color: '#0a3d2e' }
    : tone === 'media' ? { background: '#fef7df', color: '#9a6c00' }
    : { background: '#eef0ec', color: '#5a625a' };
  return (
    <div className="px-3 py-2 rounded-rebrand-sm text-center min-w-[62px]" style={style}>
      <div className="text-[18px] font-bold tabular-nums leading-none">{n}</div>
      <div className="text-[9px] uppercase tracking-[0.14em] font-bold mt-1">{label}</div>
    </div>
  );
}

// Selo de resultado (histórico): Bateu / Anulada / Não bateu (verde/cinza/vermelho).
function ResultBadge({ r }: { r: BetResult }) {
  const b = resultBadge(r);
  const style = b.tone === 'won' ? { background: '#dcefe2', color: '#0a3d2e' }
    : b.tone === 'push' ? { background: '#eef0ec', color: '#5a625a' }
    : { background: '#fbe3e8', color: '#be123c' };
  return (
    <span className="shrink-0 px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.06em]" style={style}>
      {b.label}
    </span>
  );
}

export default function FutebolOportunidades() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { data: rows, isLoading: lBoard } = useFutebolValueBoard();
  // A vitrine entra no gate de carregamento (#324): sem ela a lista renderiza
  // sem filtro e o mercado escondido aparece por um instante antes de sumir. O
  // board já vem filtrado do service, mas a fusão com o histórico e os picks
  // registrados reabrem o dia corrente.
  const { ocultos, isLoading: lVitrine } = useVitrine();
  const isLoading = lBoard || lVitrine;
  const { data: catalog } = useFutebolCompetitions();
  const { data: access } = useFutebolAccess();
  const { data: publicationAlerts, acknowledgeOnboarding, isAcknowledging } = useFutebolPublicationAlerts();
  // No primeiro contato, o cartão explica a novidade sozinho. Depois de
  // dispensado, ele dá lugar ao status compacto para não repetir a mesma ideia,
  // então o status espera exatamente enquanto o cartão está na tela.
  // Também exige enabled: o cartão afirma que os alertas estão ligados, e quem
  // já pausou veria essa frase logo acima do atalho dizendo o contrário.
  const showAlertCard = !!publicationAlerts?.telegramLinked
    && publicationAlerts.accessActive
    && publicationAlerts.enabled
    && !publicationAlerts.onboardingAcknowledged;
  // Sem acesso ativo o status continua: a preferência é persistente e some-la
  // deixaria quem perdeu o acesso sem saber se um dia ligou os alertas.
  const showAlertStatus = !!publicationAlerts?.telegramLinked && !showAlertCard;
  const oppTour = useOnboardingTour(FUT_OPP_TOUR_ID, { enabled: !isLoading });
  const isDemo = oppTour.run; // durante o tour, preenche a tela com exemplo
  const locked = isDemo ? false : !access?.unlocked;
  const [mercado, setMercado] = useState<MarketFilter>('all');
  const [faixasSelecionadas, setFaixasSelecionadas] = useState<Faixa[]>([...FAIXAS_FILTRO_PADRAO]);
  // Desligado por padrão: a lista é o retrato do dia, e esconder o que já entrou
  // em campo apagaria metade dele numa noite de sábado. Quem está caçando aposta
  // agora liga e vê só o que dá para acompanhar.
  const [soEmAberto, setSoEmAberto] = useState(false);
  // `null` significa todas: acompanha automaticamente as competições daquele dia.
  const [competicoesSelecionadas, setCompeticoesSelecionadas] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);

  // Dispensar o cartão é só marcar que a explicação foi lida; a preferência de
  // alerta continua onde estava. Um erro aqui não pode quebrar o painel: o
  // cartão simplesmente reaparece na próxima visita.
  const handleAcknowledgeAlerts = () => {
    acknowledgeOnboarding().catch(() => {});
  };

  // ── Board (presente e futuro) + histórico (passado, na foto do apito) ─────
  // As duas fontes viram UMA lista aqui, de uma vez, em vez de cada consumidor
  // (days, compsOnDay, dayRows, countByDay) ter que saber de onde veio a linha.
  // As duas RPCs devolvem as mesmas colunas na mesma ordem de propósito.
  //
  // Por que o passado não pode vir do board: ele é reconstruído do zero a cada
  // execução e não expurga jogo encerrado, então a linha de um jogo de junho
  // segue sendo reavaliada com o dado de HOJE. Medido em produção: 97% das
  // versões nasceram depois do apito, em média 668h depois. Ler o passado pelo
  // board mostra a nota recalculada semanas depois, não a que foi publicada, e
  // ainda contabiliza acerto de linha que ninguém podia ter apostado.
  // Ver migrations 101/102 e a ADR 0009 do analytics-engineering.
  //
  // A regra da fusão vive em futebol-history.ts, testada. O desempate de HOJE é
  // por kickoff: jogo que já começou vence pelo histórico, jogo que não começou
  // vence pelo board. É o que mantém esta lista contando a mesma história que a
  // tela de detalhe, que cai na foto do apito assim que o kickoff passa.
  const { data: histRows } = useFutebolValueHistory();
  // UM instante para a tela inteira: a fusão, o stepper e o horizonte de dias
  // futuros têm que concordar sobre que horas são, senão discordam na virada.
  // E ele ANDA (useNow), porque nada mais nesta tela provoca render.
  const agora = useNow();
  const hoje = brtDateStr(new Date(agora));
  // A janela do calendário é a mesma que a tela navega: o histórico para trás e
  // os dias futuros para a frente. É ela que decide quais temporadas carregar,
  // em vez de uma temporada cravada no código — na virada de temporada, cravar
  // uma só deixava o pick da outra sem fixture, sem placar e sem liquidação.
  const janelaDeFixtures = useMemo(() => ({
    from: historyWindow(hoje).from,
    to: addDays(hoje, HISTORY_WINDOW_DAYS),
  }), [hoje]);
  const fixtureScopes = useMemo(
    () => fixtureScopesFor(catalog, janelaDeFixtures, Number(hoje.slice(0, 4))),
    [catalog, janelaDeFixtures, hoje],
  );
  const { data: fixtures } = useFutebolFixturesMulti(fixtureScopes);
  const allRows = useMemo<FutebolValueBoardRow[]>(
    () => mergeBoardAndHistory(rows ?? [], histRows ?? [], agora, ocultos),
    [rows, histRows, agora, ocultos]
  );

  // Placar por fixture (pra liquidar os jogos já encerrados = histórico "bateu/não").
  const goalsMap = useMemo(() => {
    const m = new Map<number, { gh: number | null; ga: number | null }>();
    (fixtures ?? []).forEach((f) => m.set(f.fixture_id, { gh: f.goals_home, ga: f.goals_away }));
    return m;
  }, [fixtures]);
  // Fixture completo (escudo, nome, status) pra montar a linha de uma
  // oportunidade registrada que o board não tem mais.
  const fixtureMap = useMemo(() => {
    const m = new Map<number, FutebolFixture>();
    (fixtures ?? []).forEach((f) => m.set(f.fixture_id, f));
    return m;
  }, [fixtures]);

  const resultOf = (o: OppLike): BetResult | null => {
    if (!FINISHED_STATUS.has(o.status_short ?? '')) return null;
    const g = goalsMap.get(o.fixture_id);
    return g ? settleFutebol(o, g.gh, g.ga) : null;
  };

  // ── Oportunidades REGISTRADAS ─────────────────────────────────────────────
  // O mart é full-refresh e escolhe UMA janela de odds por jogo (t24h de manhã →
  // t15m no fechamento), então uma oportunidade que existiu durante o dia pode
  // não estar mais lá — foi o caso do "Palmeiras −0,25" de 22/07, que saiu no
  // daily e deu green. Ela FOI oportunidade de fato, então o registro entra na
  // lista do dia como qualquer outra, com os valores do momento em que era.
  // Fonte: daily_opportunity_picks via get_futebol_alerted_picks (migration 091).
  const { data: alertedRaw } = useFutebolAlertedPicks();
  // Sem market/outcome não há como casar com o board nem liquidar (linhas
  // anteriores ao 091 podem vir sem).
  const registradasAll = useMemo(
    () =>
      (alertedRaw ?? []).filter(
        (a) =>
          !!a.market &&
          !!a.outcome &&
          // A vitrine (#324) vale de hoje para a frente. Dia passado é registro
          // do que foi enviado e visto, e some-lo reescreveria o que o
          // assinante recebeu. Sem este corte, um Handicap alertado ANTES de o
          // mercado sair da vitrine voltava como linha do painel de hoje.
          (a.game_day < hoje || !mercadoEstaOculto(a.market, ocultos)),
      ),
    [alertedRaw, hoje, ocultos]
  );

  // Dias no stepper: dias COM oportunidade (board = passado + presente) + dias
  // FUTUROS com jogos agendados (fixtures, janela curta) — pra navegar pra frente
  // mesmo antes das odds entrarem (~24h antes do jogo).
  const days = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => { const d = brtDayOf(r.kickoff_utc); if (d) set.add(d); });
    // O registro do Telegram NÃO cria dia sozinho (decisão do Victor, 17/08).
    //
    // O snapshot do board começou em 27/07. Antes disso não existe foto do
    // apito de nada, então esses dias entrariam só com o 1 a 3 picks que o bot
    // mandou, sem Score, sem faixa e sem chance: uma tela de traços, com cara de
    // defeito, para dizer "não sabemos". Melhor não oferecer o dia.
    //
    // Nos dias que ENTRAM (têm foto do apito), o registro continua somando
    // linha normalmente, via dayRows. Ele não é redundante: dos 7 picks
    // enviados de 27/07 pra cá, só 1 ainda era oportunidade no apito.
    registradasAll.forEach((a) => { if (a.game_day >= hoje) set.add(a.game_day); });
    // O mesmo `agora` do resto da tela, e não um Date.now() próprio: com dois
    // relógios, o horizonte de dias futuros e a fusão discordam sobre quando o
    // jogo virou passado.
    const horizon = agora + 8 * 864e5; // ~8 dias à frente
    (fixtures ?? []).forEach((f) => {
      const t = parseUtc(f.kickoff_utc)?.getTime() ?? null;
      if (t != null && t > agora && t < horizon && !FINISHED_STATUS.has(f.status_short ?? '')) {
        const d = brtDayOf(f.kickoff_utc);
        if (d) set.add(d);
      }
    });
    return [...set].sort();
  }, [allRows, fixtures, registradasAll, agora, hoje]);
  // Default: hoje se houver; senão o próximo dia futuro; senão o último disponível.
  const selectedDay = (day && days.includes(day))
    ? day
    : (days.includes(hoje) ? hoje : (days.find((d) => d >= hoje) ?? days[days.length - 1]));
  const isPastDay = !!selectedDay && selectedDay < hoje;
  const isFutureDay = !!selectedDay && selectedDay > hoje;

  // Cada dia tem o seu elenco de ligas, e uma seleção feita ontem não descreve
  // hoje: manter aquelas ligas marcadas esconderia o dia inteiro. Depende do
  // `selectedDay`, não do `day` cru — o `day` pode apontar para um dia que saiu
  // da lista, e aí a tela troca de dia sem que este efeito rode.
  useEffect(() => {
    setCompeticoesSelecionadas(null);
  }, [selectedDay]);

  const compsOnDay = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach((r) => { if (brtDayOf(r.kickoff_utc) === selectedDay) s.add(r.competition); });
    registradasAll.forEach((a) => { if (a.game_day === selectedDay && a.league) s.add(a.league); });
    return s;
  }, [allRows, selectedDay, registradasAll]);

  const compOptions = sortCompetitions([...compsOnDay]).map((c) => ({ value: c, label: competitionLabel(c) }));

  // Lista do dia = board + oportunidades registradas que o board não tem mais.
  // Uma lista só: as duas são oportunidade daquele dia, a diferença é de onde
  // veio o número, não de natureza.
  const dayRows = useMemo<OppLike[]>(
    () => oportunidadesDoDia({
      doBoard: allRows.filter((r) => brtDayOf(r.kickoff_utc) === selectedDay),
      registradas: registradasAll,
      dia: selectedDay,
      fixturePorId: fixtureMap,
    }),
    [allRows, selectedDay, registradasAll, fixtureMap],
  );

  // A demonstração herda a escala do produto (#333). A janela passada aqui é a
  // MESMA que a tela exibe: herdar de outra faz o tour anunciar uma régua e a
  // legenda ao lado dele anunciar outra, que é o defeito inteiro de volta.
  const demoBoard = useDemoFutebolBoard(dayRows);

  const filtered = useMemo(
    () => dayRows.filter((r) => {
      if (mercado !== 'all' && r.market !== mercado) return false;
      // Sem faixa não dá pra classificar, então o filtro de faixa a esconde.
      if (!passaNoFiltroDeFaixas(faixasSelecionadas, r.faixa)) return false;
      if (competicoesSelecionadas && !competicoesSelecionadas.includes(r.competition)) return false;
      // Em aberto = o apito inicial ainda não soou. O status vem depois, e às
      // vezes atrasado, então quem manda é o relógio (ver futebol-datas.ts).
      if (
        soEmAberto &&
        (r.kickoff_utc == null ||
          hasKickoffPassed(r.kickoff_utc, new Date(agora)) ||
          FINISHED_STATUS.has(r.status_short ?? ''))
      )
        return false;
      return true;
    }),
    [dayRows, mercado, faixasSelecionadas, competicoesSelecionadas, soEmAberto, agora]
  );

  // Uma linha por oportunidade (sem colapsar por jogo), ranqueado por Score.
  // Registro sem Score vai primeiro: o daily só manda pick acima do corte e do
  // topo do ranking, então na hora do envio ela era das melhores do dia — o
  // número exato daquele instante é que não foi guardado.
  const realBestRows = useMemo(
    () => [...filtered].sort(compararOportunidades),
    [filtered]
  );
  const bestRows: OppLike[] = isDemo ? demoBoard : realBestRows;
  // A lista mostra o que o backend publicou. O corte local por número de Score
  // saiu na virada do Score de contexto (spec #301): a régua era calibrada para
  // a fórmula antiga e aplicá-la à escala nova classificaria errado.
  const comValor = bestRows;
  // A distribuição descreve o DIA, e por isso sai de dayRows e não de bestRows:
  // contar sobre a lista já filtrada faria o resumo dizer "Baixa 0" sempre que o
  // filtro escondesse a faixa Baixa, que é justamente o padrão.
  // Quantas o dia tem e o filtro escondeu. Serve ao estado vazio: sem isto ele
  // diz "não há oportunidade nesse dia" quando o que houve foi um filtro.
  const escondidasPeloFiltro = (isDemo ? demoBoard.length : dayRows.length) - bestRows.length;
  const distribuicao = isDemo ? demoBoard : dayRows;
  const nAlta = distribuicao.filter((o) => faixaTone(o.faixa ?? '') === 'alta' && o.faixa != null).length;
  const nMedia = distribuicao.filter((o) => o.faixa != null && faixaTone(o.faixa) === 'media').length;
  const nBaixa = distribuicao.filter((o) => o.faixa != null && faixaTone(o.faixa) === 'baixa').length;

  // Contagem de oportunidades COM VALOR por dia (badge do stepper).
  const countByDay = useMemo(() => {
    const byDay = new Map<string, FutebolValueBoardRow[]>();
    allRows.forEach((r) => {
      const d = brtDayOf(r.kickoff_utc);
      if (!d) return;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(r);
    });
    const out: Record<string, number> = {};
    // Conta o mesmo recorte que a lista abre por padrão (Alta e Média), senão o
    // selo promete um número que a tela não mostra ao ser aberta.
    byDay.forEach((rs, d) => { out[d] = rs.filter((o) => ehDestaque(o.faixa)).length; });
    // Registrada que o board não tem entra na conta, senão dia que só tem
    // registro apareceria zerado no seletor.
    registradasAll.forEach((a) => {
      const naLista = (byDay.get(a.game_day) ?? []).some(
        (r) => oppKey(r.fixture_id, r.market, r.outcome, r.line_value) === oppKey(a.fixture_id, a.market, a.outcome, a.line_value)
      );
      if (!naLista) out[a.game_day] = (out[a.game_day] ?? 0) + 1;
    });
    return out;
  }, [allRows, registradasAll]);

  // Resumo do dia passado. O denominador é o que foi PUBLICADO, e não o que
  // liquidou: contar só a linha com resultado fazia a manchete dizer "2 de 3"
  // num dia de seis, com as três sem fixture saindo da conta em silêncio (#323).
  const resumo = useMemo(
    () => (isPastDay
      ? resumoDoDia(comValor.map((o) => ({
        // Quem sabe se o fixture veio é o mapa, não o `kickoff_utc`: a linha do
        // board traz horário mesmo quando o calendário não trouxe o jogo.
        temFixture: fixtureMap.has(o.fixture_id),
        resultado: resultOf(o),
      })))
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPastDay, comValor, goalsMap, fixtureMap],
  );

  // Pick publicado num jogo que o calendário não trouxe é anomalia de catálogo,
  // e some do histórico sem barulho — foi assim que a #323 passou despercebida
  // até alguém conferir a mão. A tela mostra a pendência para quem está olhando
  // aquele dia; este evento é para quem não está.
  useEffect(() => {
    if (!resumo || resumo.semFixture === 0) return;
    posthog?.capture('futebol_pick_sem_fixture', {
      dia: selectedDay,
      sem_fixture: resumo.semFixture,
      publicadas: resumo.total,
    });
  }, [resumo, selectedDay, posthog]);

  // Esta tela lista uma linha por SAÍDA, não por mercado, e há jogos com duas
  // saídas cotadas no mesmo mercado. Navegando só com o id do jogo, clicar no card
  // da segunda abria a tela na primeira, e o pick que o usuário leu aqui virava
  // outro lá. O link carrega qual card foi clicado.
  const go = (o: OppLike) => {
    const q = new URLSearchParams({ mercado: o.market, saida: o.outcome });
    if (o.line_value != null) q.set('linha', String(o.line_value));
    navigate(`/futebol/jogo/${o.fixture_id}?${q}`);
  };
  const key = (o: OppLike) => `${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`;

  const oppSteps = useMemo(
    () => makeFutebolOportunidadesSteps({ hasDayBar: !isLoading && days.length > 0, hasBoard: bestRows.length > 0 }),
    [isLoading, days.length, bestRows.length],
  );

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={FUT_OPP_TOUR_ID} steps={oppSteps} run={oppTour.run} onFinish={oppTour.finish} />

      {/* Day stepper */}
      {!isLoading && days.length > 0 && (
        <div data-tour="fut-opp-datas" className="bg-white border-b border-line">
          <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-3">
            <FutebolDayStepper days={days} value={selectedDay} onChange={setDay} counts={countByDay} />
          </div>
        </div>
      )}

      {/* Header + KPIs de faixa */}
      <div className="bg-white border-b border-line">
        <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-5 md:py-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full min-w-0 sm:w-auto">
            <div className={`${LABEL} flex items-center gap-2`}>{isPastDay ? 'Histórico' : 'Oportunidades'}{isDemo && <DemoBadge />}</div>
            {/* Entra também quando NADA liquidou mas houve pendência: senão o
                dia em que todas ficam sem fixture não mostra nada, que é o pior
                caso do defeito e não o caso benigno. */}
            {isPastDay && resumo && (resumo.settled > 0 || resumo.pendentes > 0) ? (
              <>
                {resumo.settled > 0 ? (
                  <>
                    <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">{resumo.hit} de {resumo.settled} deram green</h1>
                    <p className="text-[13px] mt-1 text-ink-2">Resultado das oportunidades com valor deste dia{resumo.push > 0 ? ` · ${resumo.push} anulada${resumo.push === 1 ? '' : 's'}` : ''}</p>
                  </>
                ) : (
                  <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">Nenhuma oportunidade deste dia liquidou</h1>
                )}
                {/* A pendência aparece em vez de encolher o denominador. Dizer
                    "2 de 3" num dia de seis não é arredondamento: é a tela
                    escondendo justamente a linha que não fechou (#323).
                    Vale para as DUAS causas: contar só a falta de fixture
                    deixava o jogo adiado invisível, com o mesmo efeito. */}
                {resumo.pendentes > 0 ? (
                  <p className="text-[12px] mt-1 text-amber-2">
                    {resumo.pendentes} de {resumo.total} sem resultado
                    {resumo.semFixture > 0
                      ? ` · ${resumo.semFixture} sem jogo no calendário`
                      : ' · jogo adiado ou ainda sem placar'}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {/* O título não afirma "com valor" quando a pessoa pediu para
                    ver a faixa Baixa: ali ela está olhando o que o cenário NÃO
                    sustenta, e chamar aquilo de aposta com valor contradiz a
                    própria legenda. */}
                <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">
                  {comValor.length} {comValor.length === 1 ? 'oportunidade' : 'oportunidades'}
                  {faixasSelecionadas.length === 1 && faixasSelecionadas[0] === 'baixa'
                    ? ' em faixa baixa'
                    : faixasSelecionadas.includes('baixa') ? '' : ' com valor'}
                </h1>
                <p className="text-[13px] mt-1 text-ink-2">{isPastDay ? 'Resultado das oportunidades com valor deste dia' : 'Análises pré-jogo com Score, argumentos a favor e contra e preço de mercado para apoiar sua decisão.'}</p>
              </>
            )}
          </div>
          {/* Um nó só: no celular esta coluna vira a linha de baixo e o status
              ocupa a largura toda; no desktop ele senta ao lado dos KPIs. */}
          {(showAlertStatus || (!isLoading && distribuicao.length > 0)) && (
            <div className="flex items-end gap-2">
              {showAlertStatus && publicationAlerts && (
                <AlertasPublicacaoStatus estado={publicationAlerts} onOpenSettings={() => navigate('/settings')} />
              )}
              {!isLoading && distribuicao.length > 0 && (
                <div className="hidden sm:flex items-end gap-2">
                  <FaixaKpi n={nAlta} label="Alta" tone="alta" />
                  <FaixaKpi n={nMedia} label="Média" tone="media" />
                  <FaixaKpi n={nBaixa} label="Baixa" tone="baixa" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-4 flex-1">
        <DemoRibbon show={isDemo} />
        <FutebolAccessBanner access={access} />
        {publicationAlerts && (
          <>
            {showAlertCard && (
              <AlertasPublicacaoCartao
                onDismiss={handleAcknowledgeAlerts}
                isDismissing={isAcknowledging}
              />
            )}
            <AlertasPublicacaoAtalho
              estado={publicationAlerts}
              onConnect={() => navigate(onboardingHref(ONBOARDING_SRC_ALERTAS_FUTEBOL, '/futebol/oportunidades'))}
            />
          </>
        )}

        <OportunidadesFiltros
          mercado={mercado}
          onMercadoChange={setMercado}
          soEmAberto={soEmAberto}
          onSoEmAbertoChange={setSoEmAberto}
          faixasSelecionadas={faixasSelecionadas}
          onFaixasChange={setFaixasSelecionadas}
          competicoesSelecionadas={competicoesSelecionadas}
          onCompeticoesChange={setCompeticoesSelecionadas}
          competicaoOptions={compOptions}
        />

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
        ) : (isPastDay ? comValor.length === 0 : bestRows.length === 0) ? (
          <div className="rounded-rebrand-md bg-white border border-line p-6 text-center">
            {/* Quando o dia TEM oportunidade e a lista está vazia, quem esvaziou
                foi o filtro. Culpar o dado nesse caso manda a pessoa embora de
                uma tela que só precisava de um clique em Todas. */}
            <p className="text-sm text-ink-2">
              {escondidasPeloFiltro > 0 ? 'Nenhuma oportunidade nesse filtro.'
                : isPastDay ? 'Nenhuma oportunidade com valor nesse dia.'
                : isFutureDay ? 'Ainda sem oportunidades para este dia.'
                : 'Nenhum jogo com odds nesse filtro.'}
            </p>
            <p className="text-xs text-ink-3 mt-1">
              {escondidasPeloFiltro > 0
                ? `Este dia tem ${escondidasPeloFiltro} ${escondidasPeloFiltro === 1 ? 'oportunidade' : 'oportunidades'}${soEmAberto ? ' de jogos que já começaram ou em outro filtro. Desligue "Só jogos em aberto" para ver.' : ' em outra faixa ou mercado. Troque o filtro para ver.'}`
                : isPastDay ? 'Só listamos aqui as apostas que sinalizamos com valor.'
                : isFutureDay ? 'As odds costumam ser coletadas a partir de ~24h antes do jogo — as oportunidades aparecem aqui quando chegarem.'
                : 'As oportunidades aparecem quando há odds coletadas antes do jogo.'}
            </p>
          </div>
        ) : (
          <div data-tour="fut-opp-lista">
            {/* Tabela (desktop) */}
            <div className="hidden md:block rounded-rebrand-md overflow-hidden bg-white border border-line">
              <div className={`${GRID} px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3 bg-canvas-2`}>
                <div>Score ↓</div><div>Faixa</div><div>Aposta</div><div>Mercado</div>
                <div className="text-right">Chance</div><div className="text-right">Odd</div><div className="text-right">Valor</div><div />
              </div>
              {comValor.map((o) => {
                const res = resultOf(o);
                const g = goalsMap.get(o.fixture_id);
                return (
                  <div key={key(o)}>
                    <OppRow o={o} onClick={() => go(o)} locked={locked} result={res} homeGoals={g?.gh} awayGoals={g?.ga} />
                    {!isPastDay && !locked && !res && (
                      <div className="px-5 pb-2 -mt-0.5">
                        <RegistrarApostaCTA variant="text" draft={draftFromBoardRow(o)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden flex flex-col gap-2.5">
              {comValor.map((o) => {
                const res = resultOf(o);
                const g = goalsMap.get(o.fixture_id);
                return (
                  <OppMobileCard
                    key={key(o)}
                    o={o}
                    onClick={() => go(o)}
                    locked={locked}
                    result={res}
                    homeGoals={g?.gh}
                    awayGoals={g?.ga}
                    canRegister={!isPastDay && !locked && !res}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Banner honesto */}
        <div className="rounded-rebrand-md px-5 py-4 flex items-start gap-3" style={{ background: '#fef7df', border: '1px solid #fde68a' }}>
          <span className="mt-0.5 shrink-0" style={{ color: '#9a6c00' }}><AlertTriangle className="w-4 h-4" /></span>
          <div className="text-[12px] leading-relaxed" style={{ color: '#5a3c00' }}>
            <span className="font-semibold">Não é recomendação.</span> Valor = a odd paga acima da chance estimada. A régua separa o que tem valor claro do resto. Abaixo dela, não enxergamos vantagem.
          </div>
        </div>

        {/* Como ler o Score + Faixas */}
        <div data-tour="fut-opp-metodologia" className="grid md:grid-cols-2 gap-4 mt-2">
          <div className="rounded-rebrand-md bg-white border border-line p-4">
            <div className={LABEL}>Como ler o Score</div>
            <p className="text-[12px] text-ink-2 mt-2 leading-relaxed">
              O <b className="text-ink">Score (0–100)</b> resume <b className="text-ink">quanto do cenário desta linha foi confirmado pelas premissas do modelo</b>. Ele não é chance de acerto e não inclui odd ou preço. Os argumentos a favor e contra mostram o que sustenta a leitura; chance estimada, odd e valor aparecem ao lado, cada um com uma função diferente.
            </p>
          </div>
          <div className="rounded-rebrand-md bg-white border border-line p-4">
            <div className={LABEL}>Faixas</div>
            <FaixasLegenda opcoes={opcoesDeFaixa(versaoDaJanela(dayRows))} />
            <p className="text-[10px] text-ink-3 mt-3 leading-snug">
              As faixas organizam a leitura do cenário; não representam chance de acerto.
            </p>
            {/* Único lugar da tela que declara a natureza da cotação e o que
                está coberto. Sem isso a pessoa supõe que a odd é ao vivo. */}
            <p className="text-[10px] text-ink-3 mt-2 leading-snug">
              Odds pré-jogo (não ao vivo). Mercados: Resultado (1X2), Gols (Over/Under), Handicap asiático, Ambos marcam e Dupla chance; outros entram conforme liberados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
