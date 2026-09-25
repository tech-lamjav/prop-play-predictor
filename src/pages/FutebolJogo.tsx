import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { FutebolAccessBanner } from '@/components/futebol/FutebolGate';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import { type JogoInfo } from '@/components/futebol/jogo-info';
import { FaixaPartida } from '@/components/futebol/FaixaPartida';
import { BancadaMercados } from '@/components/futebol/BancadaMercados';
import { CampoEscalacao } from '@/components/futebol/CampoEscalacao';
import { EstatisticasDoJogo } from '@/components/futebol/EstatisticasDoJogo';
import { Chip } from '@/components/futebol/Chip';
import { Skeleton } from '@/components/ui/skeleton';
import { useVitrine, useFutebolFixtureDetail, useFutebolFixtureExtras, useFutebolMatchupTendencies, useFutebolFixtureValue, useFutebolFixtureCortadas, useFutebolH2H, useFutebolFixtureHistorico, useFutebolFixtureInjuries, useFutebolFixturePremissas, useFutebolTeamProfile, useFutebolAccess, useJogosComPlacarFresco } from '@/hooks/use-futebol-data';
import { useNow } from '@/hooks/use-now';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  computeMatchupTendencies,
} from '@/utils/futebol-tendencias';
import { type SaidaPreferida } from '@/utils/futebol-leitura';
import {
  pickLabel, marketLabel, valorVerdict, fmtEdgeScore,
  faixaWord, faixaBadgeCls, chancePct,
} from '@/utils/futebol-score';
import { settleFutebol, resultBadge, isHit, type BetResult } from '@/utils/futebol-settlement';
import { escalacaoExibida, rotuloEscalacao } from '@/utils/futebol-escalacao';
import { escalacaoDoTime, ultimoJogoDoTime } from '@/utils/futebol-escalacao-referencia';
import { formatadorDeData, isFinished, isLive, brtDayOf, fmtDayShort } from '@/utils/futebol-datas';
import { PARAMS_DA_SAIDA } from '@/utils/futebol-links';
import type {
  FutebolEvent, FutebolFormResult, FutebolInjury, FutebolLineupPlayer, FutebolPlayerStat, FutebolTeamStats, FutebolFixtureValueRow, FutebolTeamProfile, FutebolScopeResult, FutebolScopeStats, ProfileScope, Competition,
} from '@/services/futebol-data.service';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUT_JOGO_TOUR_ID, makeFutebolJogoSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { demoFixtureDetail, demoTeamSeason, demoAwaySeason } from '@/components/onboarding/demo/futebol';
import { useDemoFixtureValueRows } from '@/components/onboarding/demo/use-demo-futebol';

/**
 * A bancada fica lado a lado a partir de 1280px (o breakpoint `xl` do grid). O
 * tour usa isto pra decidir se o balão cabe ao lado do alvo ou se precisa ir por
 * cima: empilhada, a folha do mercado é mais alta que a tela.
 */
const BANCADA_MQ = '(min-width: 1280px)';
/**
 * O celular, para efeito de "onde a análise cai na tela".
 *
 * É o mesmo corte do `md` do Tailwind, que é onde a página deixa de empilhar:
 * daí para cima a bancada já entra no primeiro quadro e não há nada para
 * rolar. O número aparece aqui e não inline porque um corte de layout escrito
 * à mão dentro de um efeito é o tipo de coisa que sai de sincronia com o CSS
 * sem ninguém notar.
 */
const CELULAR_MQ = '(max-width: 767px)';

function useBancadaLadoALado(): boolean {
  const [lado, setLado] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(BANCADA_MQ).matches : true,
  );
  useEffect(() => {
    const mql = window.matchMedia(BANCADA_MQ);
    const onChange = (e: MediaQueryListEvent) => setLado(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return lado;
}


const SAO_PAULO_TZ = 'America/Sao_Paulo';

/**
 * Data e hora do apito, SEPARADAS.
 *
 * A faixa do jogo mostra as duas em lugares diferentes — a data na linha da
 * rodada, a hora no meio da grade —, então formatar "10/08, 18:30" e recortar
 * depois só criaria um formato para alguém quebrar sem perceber.
 */
function fmtDataEHora(raw: string | null): { data: string; hora: string } {
  if (!raw) return { data: '—', hora: '—' };
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return { data: raw, hora: '—' };
  const parte = (opcoes: Intl.DateTimeFormatOptions) =>
    formatadorDeData('pt-BR', { timeZone: SAO_PAULO_TZ, ...opcoes }).format(d);
  return {
    data: parte({ day: '2-digit', month: '2-digit' }),
    hora: parte({ hour: '2-digit', minute: '2-digit' }),
  };
}

function fmtDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(`${raw}T12:00:00Z`);
  if (isNaN(d.getTime())) return raw;
  return formatadorDeData('pt-BR', { timeZone: SAO_PAULO_TZ, day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
}

// Fases de mata-mata que a API manda em inglês. pt-BR sempre, inclusive aqui.
const FASE_PT: Record<string, string> = {
  'round of 32': '16-avos de final',
  'round of 16': 'Oitavas de final',
  'quarter-finals': 'Quartas de final',
  'semi-finals': 'Semifinal',
  final: 'Final',
  '3rd place final': 'Disputa de 3º lugar',
};

function prettyRound(round: string | null): string {
  if (!round) return '';
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  if (m) return `Rodada ${m[1]}`;
  return FASE_PT[round.trim().toLowerCase()] ?? round;
}

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}

function Crest({ name, logo }: { name: string; logo: string | null }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <img src={logo} alt={name} onError={() => setErr(true)} className="w-11 h-11 object-contain" loading="lazy" />;
  }
  return (
    <div className="w-11 h-11 rounded-full bg-canvas-2 border border-line flex items-center justify-center text-xs font-bold text-ink-2">
      {crestInitials(name)}
    </div>
  );
}

const FORM_COLORS: Record<string, string> = {
  W: 'bg-status-success text-canvas',
  D: 'bg-canvas-2 text-ink-2 border border-line',
  L: 'bg-status-danger text-canvas',
};

/** W/D/L da API em português. O DS é explícito: pt-BR sempre, inclusive em micro-rótulo. */
const RESULTADO_PT: Record<string, string> = { W: 'V', D: 'E', L: 'D' };

function FormChips({ form }: { form: FutebolFormResult[] }) {
  if (!form?.length) return <span className="text-xs text-ink-3">Sem histórico</span>;
  const ordered = [...form].reverse(); // antigo → recente
  return (
    <div className="flex gap-1">
      {ordered.map((g) => (
        <span
          key={g.fixture_id}
          title={`${g.side === 'home' ? 'contra' : 'fora, contra'} ${g.opponent} · ${g.goals_for} a ${g.goals_against}`}
          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${FORM_COLORS[g.result] || ''}`}
        >
          {RESULTADO_PT[g.result] ?? g.result}
        </span>
      ))}
    </div>
  );
}

/** Percentual, decimal ou contagem. O número decide sozinho como se escreve. */
type FormatoDaLinha = 'pct' | 'dec' | 'int';

/**
 * A caixa da partida encerrada.
 *
 * O mapa já existia neste arquivo e não era desenhado por ninguém desde que a
 * aba foi reorganizada: o dado chegava ao navegador pela mesma consulta do
 * detalhe do jogo e a tela o jogava fora. O rótulo perdeu o "(%)" porque o
 * valor já sai com o sinal.
 */
const STAT_ROWS: { key: keyof FutebolTeamStats; label: string; f: FormatoDaLinha }[] = [
  { key: 'ball_possession', label: 'Posse de bola', f: 'pct' },
  { key: 'expected_goals', label: 'Gols esperados', f: 'dec' },
  { key: 'total_shots', label: 'Finalizações', f: 'int' },
  { key: 'shots_on_goal', label: 'No gol', f: 'int' },
  { key: 'corner_kicks', label: 'Escanteios', f: 'int' },
  { key: 'fouls', label: 'Faltas', f: 'int' },
  { key: 'yellow_cards', label: 'Cartões amarelos', f: 'int' },
  { key: 'passes_pct', label: 'Passes certos', f: 'pct' },
];

function RatingBadge({ value }: { value: number }) {
  const cls = value >= 7.5 ? 'bg-forest text-canvas' : value >= 6.5 ? 'bg-canvas-2 text-ink border border-line' : 'bg-status-danger/15 text-status-danger';
  return <span className={`text-[10px] font-bold tabular-nums rounded px-1 py-0.5 ${cls}`}>{value.toFixed(1)}</span>;
}

const GOAL_SUFFIX: Record<string, string> = { Penalty: ' (pênalti)', 'Own Goal': ' (gol contra)' };

function eventMinute(e: FutebolEvent): string {
  if (e.minute == null) return '—';
  return e.minute_extra ? `${e.minute}+${e.minute_extra}'` : `${e.minute}'`;
}

const CARD = 'bg-white border border-line rounded-rebrand-xl';


// ---------- "O que olhar": Score vem PRONTO do backend (fact_value_opportunities) ----------
// Síntese "O que olhar neste jogo" — decide e PROVA a melhor aposta (Score do backend)
// Selo de resultado (jogo encerrado): Green / Meio green / Anulada / Meio red / Red.
// Cor + texto (não só cor) e um ponto pra reforçar o estado à distância.
function ResultBadge({ r, big }: { r: BetResult; big?: boolean }) {
  const b = resultBadge(r);
  const c = b.tone === 'won' ? { bg: '#dcefe2', fg: '#0a3d2e', dot: '#2f7d50' }
    : b.tone === 'push' ? { bg: '#eef0ec', fg: '#5a625a', dot: '#8a8f86' }
    : { bg: '#fbeeec', fg: '#b8341c', dot: '#b8341c' };
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.06em] ${big ? 'h-7 px-2.5 text-[11px]' : 'h-5 px-1.5 text-[10px]'}`}
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {b.label}
    </span>
  );
}

type LinhaComparada = { l: string; a: number; b: number; f: FormatoDaLinha };

/**
 * As barras espelhadas, e só elas.
 *
 * Saiu de dentro do card de temporada quando a caixa da partida encerrada
 * passou a precisar do mesmo desenho. É a terceira vez nesta tela que o mesmo
 * padrão aparece — série, barra e agora isto —, e nas duas anteriores a cópia
 * teria divergido em pixel sem ninguém notar, porque ninguém compara dois
 * cards lado a lado procurando diferença de padding.
 */
function BarrasComparadas({ rows, vazio }: { rows: LinhaComparada[]; vazio: string }) {
  if (!rows.length) return <p className="text-sm text-ink-3 text-center py-4">{vazio}</p>;
  const fmt = (v: number, f: FormatoDaLinha) =>
    f === 'pct' ? `${Math.round(v)}%` : f === 'int' ? String(Math.round(v)) : v.toFixed(1);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((s) => {
        const total = s.a + s.b;
        const aPct = total ? (s.a / total) * 100 : 50;
        return (
          <div key={s.l}>
            <div className="flex items-center justify-between text-[12px] tabular-nums mb-1">
              <span className="font-semibold text-forest">{fmt(s.a, s.f)}</span>
              <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-ink-3">{s.l}</span>
              <span className="font-semibold text-ink-2">{fmt(s.b, s.f)}</span>
            </div>
            <div className="flex items-center gap-1 h-2">
              <div className="flex-1 h-full rounded-l-full overflow-hidden flex justify-end bg-canvas-2"><div style={{ width: `${aPct}%`, background: 'var(--forest)', height: '100%' }} /></div>
              <div className="flex-1 h-full rounded-r-full overflow-hidden bg-canvas-2"><div style={{ width: `${100 - aPct}%`, background: 'var(--ink-3)', height: '100%' }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Geral, ou o mando que cada time tem NESTE jogo. */
type RecorteDoPerfil = 'geral' | 'mando';

/**
 * A base de jogos de um lado do card de temporada.
 *
 * ⚠️ São DUAS fontes, com contagens próprias. Gols marcados, gols sofridos e o
 * percentual de over saem de `results`; posse, finalizações e escanteios saem
 * de `stats_avg`, que só conta partida cujo boletim a fonte publicou — e ela
 * não publica todas. Declarar só a primeira faz a tela afirmar uma base que
 * METADE das linhas não teve, que é exatamente o defeito que esta linha existe
 * para não cometer.
 */
function baseDoLado(r?: FutebolScopeResult, s?: FutebolScopeStats): string {
  const jogos = r?.games;
  const comBoletim = s?.games;
  if (jogos == null && comBoletim == null) return '—';
  if (jogos == null) return `${comBoletim} com estatística`;
  const texto = `${jogos} ${jogos === 1 ? 'jogo' : 'jogos'}`;
  return comBoletim == null || comBoletim === jogos ? texto : `${texto} · ${comBoletim} com estatística`;
}

// Estatísticas comparadas da temporada (barras espelhadas) — médias via team_profile
function StatsCompare({ home, away }: { home?: FutebolTeamProfile; away?: FutebolTeamProfile }) {
  const [recorte, setRecorte] = useState<RecorteDoPerfil>('geral');
  // ⚠️ "Mando deste jogo" são recortes OPOSTOS: o mandante medido em casa e o
  // visitante medido fora. Por isso o rótulo nomeia a regra e não um lado — e
  // por isso não existe chip de "casa" solto, que para o visitante descreveria
  // jogos sem relação nenhuma com esta partida.
  const escopoMandante: ProfileScope = recorte === 'mando' ? 'casa' : 'geral';
  const escopoVisitante: ProfileScope = recorte === 'mando' ? 'fora' : 'geral';
  const hr = home?.results.find((r) => r.scope === escopoMandante);
  const ar = away?.results.find((r) => r.scope === escopoVisitante);
  const hs = home?.stats_avg.find((s) => s.scope === escopoMandante);
  const as = away?.stats_avg.find((s) => s.scope === escopoVisitante);
  const rows = [
    { l: 'Gols marcados / jogo', a: hr?.avg_gf, b: ar?.avg_gf, f: 'dec' },
    { l: 'Gols sofridos / jogo', a: hr?.avg_ga, b: ar?.avg_ga, f: 'dec' },
    { l: 'Posse de bola', a: hs?.avg_possession, b: as?.avg_possession, f: 'pct' },
    { l: 'Finalizações / jogo', a: hs?.avg_shots, b: as?.avg_shots, f: 'dec' },
    { l: 'Escanteios / jogo', a: hs?.avg_corners, b: as?.avg_corners, f: 'dec' },
    { l: '% jogos Over 2.5', a: hr?.over25_pct, b: ar?.over25_pct, f: 'pct' },
  ].filter((r) => r.a != null && r.b != null) as LinhaComparada[];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Chip ativo={recorte === 'geral'} onClick={() => setRecorte('geral')}>Geral</Chip>
        <Chip ativo={recorte === 'mando'} onClick={() => setRecorte('mando')}>Mando deste jogo</Chip>
      </div>
      {/* A BASE, sempre à vista, e no mesmo arranjo das barras: valor, rótulo,
          valor. Trocar o recorte muda quantos jogos sustentam cada número — no
          mando eles nem são os mesmos jogos dos dois lados — e um número que
          muda de base em silêncio é como "Flamengo em casa, 11 jogos" apareceu
          embaixo de um critério que somava dez. */}
      {(hr || ar || hs || as) && (
        <div className="flex items-center justify-between gap-2 text-[10.5px] tabular-nums">
          <span className="font-semibold text-forest">{baseDoLado(hr, hs)}</span>
          <span className="uppercase tracking-[0.1em] font-semibold text-ink-3 shrink-0">base</span>
          <span className="font-semibold text-ink-2">{baseDoLado(ar, as)}</span>
        </div>
      )}
      <BarrasComparadas
        rows={rows}
        vazio={recorte === 'mando' ? 'Sem médias para o mando deste confronto.' : 'Médias da temporada indisponíveis.'}
      />
    </div>
  );
}

/**
 * O que aconteceu NESTA partida, quando ela já terminou.
 *
 * É **estatística da partida**: fato público de futebol, e por isso vem da
 * mesma consulta aberta do detalhe do jogo, sem passar pelo portão. Não diz
 * nada sobre aposta, e não é insumo de premissa nenhuma.
 */
function CaixaDoJogo({ home, away }: { home?: FutebolTeamStats; away?: FutebolTeamStats }) {
  const rows = STAT_ROWS.map((r) => ({
    l: r.label,
    a: home?.[r.key] as number | null | undefined,
    b: away?.[r.key] as number | null | undefined,
    f: r.f,
  })).filter((r) => r.a != null && r.b != null) as LinhaComparada[];
  return <BarrasComparadas rows={rows} vazio="A fonte não publicou estatística desta partida." />;
}

export default function FutebolJogo() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // A saída que o usuário clicou em Oportunidades. Sem ela, a tela escolhia sozinha
  // a de maior Score do mercado, que nem sempre é a do card clicado.
  const preferida = useMemo((): SaidaPreferida | null => {
    const market = params.get(PARAMS_DA_SAIDA.mercado);
    const outcome = params.get(PARAMS_DA_SAIDA.saida);
    if (!market || !outcome) return null;
    const linha = params.get(PARAMS_DA_SAIDA.linha);
    const n = linha != null ? Number(linha) : NaN;
    return { market, outcome, line_value: Number.isFinite(n) ? n : null };
  }, [params]);
  const fid = fixtureId ? Number(fixtureId) : undefined;
  const { data, isLoading, isError } = useFutebolFixtureDetail(fid);
  const { data: extras, isLoading: extrasLoading } = useFutebolFixtureExtras(fid);
  const jogoTour = useOnboardingTour(FUT_JOGO_TOUR_ID, { enabled: !isLoading, delay: 1200 });
  const isDemo = jogoTour.run; // durante o tour, preenche a tela com exemplo

  const fixtureDoEspelho = isDemo ? demoFixtureDetail.fixture : data?.fixture;
  // O placar do coletor, quando o espelho ainda não fechou o jogo (issue #479).
  //
  // Um jogo só, e mesmo assim passa pela mesma função das listas: a regra de
  // quem precisa de placar fresco é uma, e uma tela que resolvesse "na mão"
  // acabaria com uma regra diferente das outras — foi assim que a versão
  // anterior desta mesma consulta nasceu pedindo pela temporada inteira.
  //
  // A lista de UM é memoizada porque o hook promete devolver o mesmo array
  // quando não há o que sobrepor — e um literal novo a cada render quebraria
  // essa promessa do lado de fora, refazendo o memo de quem vem depois.
  const agora = useNow();
  const soEsteJogo = useMemo(
    () => (isDemo || !fixtureDoEspelho ? [] : [fixtureDoEspelho]),
    [isDemo, fixtureDoEspelho],
  );
  const [fixtureFresco] = useJogosComPlacarFresco(soEsteJogo, agora);
  const fixture = fixtureFresco ?? fixtureDoEspelho;
  const { data: h2h, isLoading: h2hLoading } = useFutebolH2H(fixture?.home_team_id, fixture?.away_team_id);
  // O jogo a jogo dos dois times, para a aba de Estatísticas. Mesma consulta que
  // a bancada já faz para o gráfico das premissas, então sai do cache do
  // react-query sem ida extra à rede — e é fato público, sem portão.
  const { data: historico, isLoading: historicoCarregando } = useFutebolFixtureHistorico(fid);
  const { data: injuries } = useFutebolFixtureInjuries(fid);
  const { data: realTend } = useFutebolMatchupTendencies(
    fixture?.home_team_id, fixture?.away_team_id, fixture?.competition, fixture?.season
  );
  const tend = isDemo ? { home: demoTeamSeason, away: demoAwaySeason } : realTend;
  const tendencies = useMemo(() => {
    if (!fixture || !tend?.home || !tend?.away) return null;
    return computeMatchupTendencies(tend.home, tend.away, fixture.home_team_name, fixture.away_team_name);
  }, [tend, fixture]);
  // Score vem PRONTO do backend (fact_value_opportunities). 1X2 por enquanto.
  // A vitrine (#324) desce por prop para a FaixaPartida, que é de apresentação
  // e não tem consulta própria.
  const { ocultos } = useVitrine();
  const { data: realValueRows, isLoading: valorCarregando } = useFutebolFixtureValue(fid);
  // A demonstração herda a escala do produto (#333), derivada da MESMA janela
  // que a tela exibe. Memoizado porque a lista desce para filhos e para
  // dependências de outros useMemo: recriar o array a cada render invalidaria
  // todos eles sem que nada tivesse mudado.
  const demoValueRows = useDemoFixtureValueRows(realValueRows);
  const valueRows = isDemo ? demoValueRows : realValueRows;
  // As saídas que o corte de valor removeu (#432). Mesma resposta do serviço que
  // o `valueRows`, e por isso a mesma busca: as duas descem juntas para a faixa e
  // para a bancada, senão existe um instante em que a tela tem as linhas e não
  // tem as cortadas — e é justamente nele que ela anuncia o que escondemos.
  //
  // Na demonstração não há cortada nenhuma: as linhas são de exemplo e não
  // passaram por corte.
  const { data: cortadasDoJogo } = useFutebolFixtureCortadas(fid);
  const cortadas = useMemo(
    () => (isDemo ? [] : cortadasDoJogo ?? []),
    [isDemo, cortadasDoJogo],
  );
  const { data: access } = useFutebolAccess();
  const locked = isDemo ? false : !access?.unlocked;
  // Perfis (médias da temporada) dos dois times — pra "Estatísticas · temporada"
  const { data: homeProfile } = useFutebolTeamProfile(fixture?.home_team_id, fixture?.competition as Competition, fixture?.season as number);
  const { data: awayProfile } = useFutebolTeamProfile(fixture?.away_team_id, fixture?.competition as Competition, fixture?.season as number);
  const h2hHomeWins = h2h?.filter((m) => m.winner_team_id === fixture?.home_team_id).length ?? 0;
  const h2hAwayWins = h2h?.filter((m) => m.winner_team_id === fixture?.away_team_id).length ?? 0;
  const h2hDraws = h2h?.filter((m) => m.winner_team_id == null).length ?? 0;
  const h2hTotal = h2h?.length ?? 0;
  const h2hPct = (n: number) => (h2hTotal ? (n / h2hTotal) * 100 : 0);
  const stats = data?.stats || [];
  const home = stats.find((s) => s.team_side === 'home');
  const away = stats.find((s) => s.team_side === 'away');
  const finished = isFinished(fixture?.status_short);
  // Uma formatação só: a data e a hora saem juntas do mesmo instante.
  const quandoJoga = fmtDataEHora(fixture?.kickoff_utc ?? null);
  // "Já começou" inclui o jogo em andamento, não só o encerrado: depois do
  // apito não dá para prometer que a escalação "sai daqui a pouco".
  const jogoComecou = finished || isLive(fixture?.status_short);
  // Jogo em andamento CONTINUA mostrando a leitura, de propósito (decisão do
  // Victor, 17/08). Esconder tiraria informação de quem abriu a tela justamente
  // porque o jogo está rolando; o que faltava não era esconder, era DIZER que
  // já começou. Quem diz agora é a FaixaPartida, com o estado "Em andamento"
  // que ela não tinha (antes o jogo ao vivo aparecia como "Não começou").
  //
  // Isso importa mais depois da migration 101: durante o jogo o valor exibido é
  // a FOTO DO APITO, e sem o rótulo o leitor toma um preço congelado por preço
  // corrente.
  //
  // O `hasPlayed` que vivia aqui foi removido: ele desenhava a grade de duas
  // colunas do pós-jogo até o d939e0c (13/08) reorganizar a tela em torno das
  // premissas, e ficou órfão desde então, declarado e nunca usado. Quem exibe o
  // valor de um jogo que já começou hoje é a FaixaPartida e a BancadaMercados,
  // pelo `valueRows` — que a 101 passa a alimentar com a foto do apito, sem
  // precisar de mudança nelas.
  const showValue = !finished && !!valueRows && valueRows.length > 0;

  const playerStats = extras?.player_stats || [];
  const statsById = new Map<number, FutebolPlayerStat>(
    playerStats.filter((p) => p.player_id != null).map((p) => [p.player_id, p])
  );
  const destaques = playerStats
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, 3);

  const hasDescriptive = !!(
    home || away ||
    extras?.events?.length || extras?.lineup_players?.length ||
    (h2h && h2h.length) || extras?.form_home?.length || extras?.form_away?.length
  );

  // Três abas (Leitura & mercados · Escalações · Estatísticas) e o mercado
  // aberto na bancada.
  const [aba, setAba] = useState<'mercados' | 'escalacoes' | 'estatisticas'>('mercados');
  const bancadaLadoALado = useBancadaLadoALado();
  // Abre já no mercado do card clicado; sem link, no de gols, como sempre foi.
  const [mercadoAtivo, setMercadoAtivo] = useState(() => preferida?.market ?? 'goals_over_under');
  /**
   * Quem chega por um card de oportunidade cai NA análise, não no topo.
   *
   * O link já trazia a saída clicada e a bancada já abria no mercado certo —
   * só que no celular isso acontecia a uma tela e meia de rolagem abaixo da
   * dobra, então o trabalho estava feito e ninguém via. O assinante lia o
   * cabeçalho do jogo e voltava.
   *
   * Três condições, e todas importam:
   *  - `preferida`: só rola quem PEDIU uma saída. Entrar pela agenda ou pelo
   *    link direto do jogo é chegar para ver o jogo, e mover a tela debaixo
   *    de quem não pediu é o defeito que esta rolagem imita.
   *  - o celular: no desktop a bancada já está no primeiro quadro.
   *  - dado na mão: rolar com a bancada ainda vazia mira numa altura que o
   *    conteúdo vai empurrar, e a tela para no lugar errado.
   *
   * `jaRolou` porque isto é uma CHEGADA, não um comportamento: trocar de aba
   * ou de mercado refaz o efeito, e repetir a rolagem prenderia a tela.
   */
  const analiseRef = useRef<HTMLDivElement | null>(null);
  const jaRolou = useRef(false);
  useEffect(() => {
    if (jaRolou.current || !preferida) return;
    if (isLoading || valorCarregando) return;
    const alvo = analiseRef.current;
    if (!alvo) return;
    if (!window.matchMedia(CELULAR_MQ).matches) return;
    jaRolou.current = true;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
  }, [preferida, isLoading, valorCarregando]);
  const jogoInfo: JogoInfo | null = fixture
    ? {
        fixtureId: fid!,
        homeId: fixture.home_team_id,
        awayId: fixture.away_team_id,
        home: fixture.home_team_name,
        away: fixture.away_team_name,
        competition: fixture.competition,
        season: fixture.season,
        kickoffUtc: fixture.kickoff_utc,
        statusShort: fixture.status_short,
        goalsHome: fixture.goals_home,
        goalsAway: fixture.goals_away,
      }
    : null;

  // O tour fala do que está montado: a régua só existe nos mercados de linha, e
  // as premissas só quando a coleta trouxe alguma para este jogo. A query é a
  // mesma da bancada, então sai do cache do react-query, sem ida extra à rede.
  const { data: premissasDoJogo, isLoading: premissasCarregando } = useFutebolFixturePremissas(fid);
  // A leitura da faixa se apoia em DUAS fontes: as premissas e as linhas de
  // valor. Enquanto qualquer uma está em voo a faixa não tem como concluir
  // "Sem leitura ainda", então ela mostra o esqueleto. No tour não há espera:
  // os dados são de mentira e chegam prontos.
  const leituraCarregando = isDemo ? false : premissasCarregando || valorCarregando;
  const jogoSteps = useMemo(
    () =>
      makeFutebolJogoSteps({
        hasRegua: mercadoAtivo === 'goals_over_under' || mercadoAtivo === 'asian_handicap',
        hasPremissas: (premissasDoJogo?.length ?? 0) > 0,
        ladoALado: bancadaLadoALado,
      }),
    [mercadoAtivo, premissasDoJogo, bancadaLadoALado],
  );

  // ── Cards de contexto, montados uma vez e posicionados conforme o estado ──
  // Jogo FUTURO: h2h + estatísticas entram no trilho da direita (junto do veredito
  // e do modelo) e a escalação fica sob o mapa — um rail de consulta contínuo, em
  // vez de uma coluna direita que ficava VAZIA quando o jogo não tinha odd nem
  // modelo (caso Santos × Remo). Jogo ENCERRADO: grade original lá embaixo.
  // A fonte NÃO publica escalação provável. O que chega é a confirmada
  // (anunciada antes do apito) ou a real (registro pós-jogo). O rótulo é
  // derivado da fase, não fixo.
  //
  // As DUAS listas vêm filtradas pela fase exibida: elas podem estar em fases
  // diferentes (139 dos 8.071 jogos), e usar as listas cruas faria o card
  // anunciar "Escalação confirmada" com a formação do pós-jogo ao lado.
  const escalacao = escalacaoExibida(extras?.lineups, extras?.lineup_players);
  const rotulo = rotuloEscalacao(escalacao.fase, jogoComecou);

  // Sem escalação publicada, a aba mostrava um gramado vazio — e é justamente no
  // jogo por vir que ela seria útil, porque é o único em que se aposta. Na nossa
  // base a escalação só chega a partir do apito.
  //
  // Enquanto a coleta não roda antes do jogo, entra a escalação do ÚLTIMO jogo de
  // cada time, nomeada como tal. Some sozinha quando a de verdade chega, porque a
  // busca só é ligada enquanto falta escalação e o jogo não começou.
  const faltaEscalacao = !escalacao.jogadores.length && !jogoComecou;
  const ultimoDoMandante = faltaEscalacao ? ultimoJogoDoTime(extras?.form_home) : null;
  const ultimoDoVisitante = faltaEscalacao ? ultimoJogoDoTime(extras?.form_away) : null;

  // Duas RPCs a mais, e só neste caso: com escalação publicada os dois ids ficam
  // indefinidos e o hook não busca nada.
  const { data: extrasMandante } = useFutebolFixtureExtras(ultimoDoMandante?.fixture_id);
  const { data: extrasVisitante } = useFutebolFixtureExtras(ultimoDoVisitante?.fixture_id);

  const referenciaDe = (
    jogo: typeof ultimoDoMandante,
    extrasDoJogo: typeof extras,
    teamId: number | undefined,
    lado: 'home' | 'away',
  ) => {
    if (!jogo || !extrasDoJogo || teamId == null) return null;
    const jogadores = escalacaoDoTime(extrasDoJogo.lineup_players, teamId, lado);
    if (!jogadores.length) return null;
    const time = (extrasDoJogo.lineups || []).find((t) => t.team_id === teamId);
    return {
      jogadores,
      formacao: time?.formation ?? null,
      tecnico: time?.coach_name ?? null,
      adversario: jogo.opponent,
      dia: fmtDayShort(brtDayOf(jogo.date_utc)),
    };
  };

  const referencia = {
    home: referenciaDe(ultimoDoMandante, extrasMandante, fixture?.home_team_id, 'home'),
    away: referenciaDe(ultimoDoVisitante, extrasVisitante, fixture?.away_team_id, 'away'),
  };

  const escalacaoCard = fixture ? (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{rotulo.titulo}</div>
        {rotulo.subtitulo && <div className="text-[10px] text-ink-3 mt-0.5">{rotulo.subtitulo}</div>}
      </div>
      <div className="p-5">
        <CampoEscalacao
          times={escalacao.times}
          jogadores={escalacao.jogadores}
          injuries={injuries || []}
          homeName={fixture.home_team_name}
          awayName={fixture.away_team_name}
          homeId={fixture.home_team_id}
          awayId={fixture.away_team_id}
          // O texto do campo vazio vem do MESMO rótulo do cabeçalho. Escrito
          // duas vezes, o card já anunciou "quem entrou em campo" com o corpo
          // dizendo que a escalação sai daqui a pouco.
          vazio={rotulo.subtitulo ? `${rotulo.titulo} · ${rotulo.subtitulo}.` : `${rotulo.titulo}.`}
          referencia={referencia}
        />
      </div>
    </div>
  ) : null;

  const h2hCard = fixture ? (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      {/* A declaração não é enfeite. O confronto direto é uma série curta,
          espalhada por anos, às vezes com elenco e treinador trocados — e ele
          fica ao lado da leitura do modelo, que é onde um número vira razão de
          apostar sem ninguém ter dito que virou. O glossário define o termo
          exatamente assim: contexto, com o número de encontros à vista, e
          nunca evidência. */}
      <div className="px-5 py-3 border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Confrontos diretos</div>
        <div className="text-[10px] text-ink-3 mt-0.5">Contexto dos encontros anteriores. Não entra na leitura do modelo.</div>
      </div>
      <div className="p-5">
        {h2hLoading ? <p className="text-xs text-ink-3">Carregando…</p> : h2h && h2h.length ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[20px] font-semibold tabular-nums text-forest shrink-0">{h2hHomeWins}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-canvas-2">
                <div style={{ width: `${h2hPct(h2hHomeWins)}%`, background: 'var(--forest)' }} />
                <div style={{ width: `${h2hPct(h2hDraws)}%`, background: 'var(--ink-3)' }} />
                <div style={{ width: `${h2hPct(h2hAwayWins)}%`, background: '#b8341c' }} />
              </div>
              <span className="text-[20px] font-semibold tabular-nums shrink-0" style={{ color: '#b8341c' }}>{h2hAwayWins}</span>
            </div>
            <p className="text-[11px] mb-2 text-ink-3">{h2hTotal} confronto{h2hTotal === 1 ? '' : 's'} · {h2hHomeWins} {fixture.home_team_name} · {h2hDraws} empate · {h2hAwayWins} {fixture.away_team_name}</p>
            {h2h.slice(0, 6).map((m) => {
              const win = (m.goals_home ?? 0) > (m.goals_away ?? 0) ? 'home' : (m.goals_away ?? 0) > (m.goals_home ?? 0) ? 'away' : 'draw';
              return (
                <div key={m.fixture_id} className="grid grid-cols-[1fr_auto_60px] gap-2 items-center py-2 text-[12px] border-t border-line/60">
                  <span className="text-[11px] text-ink-3 truncate">{fmtDate(m.date_utc)} · {m.competition}</span>
                  <span className="font-semibold tabular-nums text-ink">{m.goals_home} × {m.goals_away}</span>
                  <span className="text-right text-[10px] font-bold uppercase" style={{ color: win === 'home' ? 'var(--forest)' : win === 'away' ? '#b8341c' : 'var(--ink-3)' }}>{win === 'home' ? 'Casa' : win === 'away' ? 'Fora' : 'Empate'}</span>
                </div>
              );
            })}
          </>
        ) : <p className="text-xs text-ink-3">Sem confrontos diretos no histórico.</p>}
      </div>
    </div>
  ) : null;

  // Só depois do apito: antes dele não existe estatística desta partida, e um
  // card vazio anunciando "como foi" no jogo por vir leria como defeito.
  const jogoCard = fixture && finished && (home || away) ? (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 flex items-center justify-between border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Como foi esta partida</div>
        <span className="text-[10px] flex items-center gap-2"><span className="text-forest font-semibold truncate max-w-[90px]">{fixture.home_team_name}</span><span className="text-ink-3 truncate max-w-[90px]">{fixture.away_team_name}</span></span>
      </div>
      <div className="p-5"><CaixaDoJogo home={home} away={away} /></div>
    </div>
  ) : null;

  const statsCard = fixture && (homeProfile || awayProfile) ? (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 flex items-center justify-between border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Estatísticas · temporada</div>
        <span className="text-[10px] flex items-center gap-2"><span className="text-forest font-semibold truncate max-w-[90px]">{fixture.home_team_name}</span><span className="text-ink-3 truncate max-w-[90px]">{fixture.away_team_name}</span></span>
      </div>
      <div className="p-5"><StatsCompare home={homeProfile} away={awayProfile} /></div>
    </div>
  ) : null;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={FUT_JOGO_TOUR_ID} steps={jogoSteps} run={jogoTour.run} onFinish={jogoTour.finish} />
      {/* 1480px pra bater com a agenda. Em max-w-6xl (1152) sobravam ~290px de ar
          numa tela de 1440, e todo bloco esticava na mesma largura. */}
      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 flex-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-10 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
          </div>
        ) : !fixture ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>
            Não foi possível carregar este jogo.
          </div>
        ) : (
          <>
            {isDemo && <div className="mb-4"><DemoRibbon show /></div>}

            {/* Protótipo "Futebol Jogo" (Claude Design): o confronto e a melhor
                leitura moram na MESMA faixa forest, colada no cabeçalho. Eram dois
                blocos disputando o topo da tela. */}
            {jogoInfo && (
              <div data-tour="fut-jogo-header">
                {isDemo && <div className="mb-2"><DemoBadge /></div>}
                <FaixaPartida
                  jogo={jogoInfo}
                  premissas={premissasDoJogo}
                  valueRows={valueRows}
                  cortadas={cortadas}
                  ocultos={ocultos}
                  leituraCarregando={leituraCarregando}
                  locked={locked}
                  rodada={prettyRound(fixture.round)}
                  estadio={fixture.venue_name ? `${fixture.venue_name}${fixture.venue_city ? `, ${fixture.venue_city}` : ''}` : null}
                  data={quandoJoga.data}
                  hora={quandoJoga.hora}
                  formHome={extrasLoading ? [] : extras?.form_home || []}
                  formAway={extrasLoading ? [] : extras?.form_away || []}
                  homeTeamId={fixture.home_team_id}
                  awayTeamId={fixture.away_team_id}
                  preferida={preferida}
                  onAbrirMercado={(slug) => {
                    setMercadoAtivo(slug);
                    setAba('mercados');
                  }}
                />
              </div>
            )}

            {!finished && showValue && <FutebolAccessBanner access={access} className="mt-5" />}

            {/* Três abas. A de Times fazia o papel de três coisas ao mesmo tempo:
                médias da temporada, confronto direto e escalação, empilhadas numa
                rolagem só. A escalação é a que o assinante procura perto do jogo, e
                ficava por último, embaixo de tudo.

                O antigo "Resumo" virou a própria faixa da partida mais a coluna de
                mercados, então deixou de ser uma aba. */}
            <div ref={analiseRef} className="mt-5 scroll-mt-20 flex items-center justify-between gap-4 flex-wrap">
              {/* Rola na horizontal no celular, como toda fileira desta casa
                  (a régua de datas da agenda, a coluna de mercados da bancada, a
                  régua de rodadas). Com duas abas cabia num aparelho de 360px;
                  com três, "Leitura & mercados" mais "Escalações" mais
                  "Estatísticas" passam de 370px contra os ~328px que sobram
                  depois do respiro da página, e a terceira era cortada pela
                  borda sem nada indicando que ela existe.

                `min-w-0` junto do `max-w-full`, e o par é obrigatório. Item de
                  flex nasce com `min-width: auto`, que o proíbe de encolher abaixo
                  do próprio conteúdo — e no CSS o `min-width` GANHA do
                  `max-width`. Com as três abas em `whitespace-nowrap`, o
                  conteúdo mínimo é a barra inteira, então o teto não valia nada e
                  ela seguia passando do respiro da página. É a mesma armadilha
                  que obriga o `min-w-0` para um `truncate` funcionar.

                  E `shrink-0` em cada botão, senão eles se espremem e o texto
                  quebra em duas linhas em vez de sair da vista. */}
              <div
                data-tour="fut-jogo-abas"
                className="inline-flex min-w-0 max-w-full overflow-x-auto no-scrollbar p-[3px] rounded-[11px]"
                style={{ background: 'var(--canvas-2)', border: '1px solid #ded2b6' }}
              >
                {(
                  [
                    ['mercados', 'Leitura & mercados'],
                    ['escalacoes', 'Escalações'],
                    ['estatisticas', 'Estatísticas'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setAba(k)}
                    className={`h-8 px-4 shrink-0 whitespace-nowrap rounded-lg text-[13px] cursor-pointer transition border-0 ${
                      aba === k ? 'bg-white text-ink font-semibold shadow-sm' : 'bg-transparent text-ink-2 font-medium'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[11.5px]" style={{ color: '#8d8672' }}>
                Leitura de risco, não recomendação de aposta
              </span>
            </div>

            <div className="mt-4">
              {aba === 'mercados' && (
                <BancadaMercados
                  jogo={jogoInfo}
                  valueRows={valueRows}
                  cortadas={cortadas}
                  tendencies={tendencies}
                  locked={locked}
                  mercadoAtivo={mercadoAtivo}
                  onMercado={setMercadoAtivo}
                  preferida={preferida}
                />
              )}

              {aba === 'escalacoes' && escalacaoCard}

              {aba === 'estatisticas' && (
                <div data-tour="fut-jogo-contexto" className="grid lg:grid-cols-[7fr_3fr] gap-5 items-start">
                  {/* 70/30: o gráfico é o que a aba veio mostrar e fica com a
                      coluna larga; as caixas de resumo sobem para a estreita em
                      vez de empilharem embaixo dele. No celular vira uma coluna
                      só, e o gráfico continua vindo primeiro. */}
                  <div className="min-w-0 flex flex-col gap-5">
                  {/* O jogo a jogo vem primeiro e ocupa a largura inteira: é o
                      que a aba veio mostrar, e é o único bloco daqui que deixa
                      CONFERIR um número em vez de aceitá-lo. As duas caixas de
                      resumo seguem embaixo, lado a lado como estavam. */}
                  {/* No jogo encerrado, o que aconteceu em campo vem antes de
                      qualquer média: é a coisa mais concreta da aba, e some
                      sozinho no jogo por vir. */}
                  {jogoCard}
                  {/* Nasce no mercado e na linha que a pessoa vinha lendo, para
                      a aba não recomeçar do zero. Daí em diante é independente:
                      a régua da bancada escolhe QUAL APOSTA ler, esta escolhe
                      onde cortar a cor, e acoplar as duas juntaria conceitos
                      diferentes. */}
                  <EstatisticasDoJogo
                    historico={historico}
                    carregando={historicoCarregando}
                    mercadoInicial={preferida?.market ?? mercadoAtivo}
                    linhaInicial={preferida?.line_value ?? null}
                  />
                  </div>
                  <div className="min-w-0 flex flex-col gap-5">
                    {statsCard}
                    {h2hCard}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
