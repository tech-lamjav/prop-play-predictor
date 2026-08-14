import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixturePremissas, useFutebolFixtureNumeros } from '@/hooks/use-futebol-data';
import type { FutebolFixturePremissas, FutebolFixtureNumeros } from '@/services/futebol-data.service';
import {
  MERCADOS,
  PREMISSAS_OCULTAS,
  PORTA_PREMISSAS,
  contaQueValem,
  melhorCandidato,
  outcomeLabel,
  premissaDe,
  type MercadoInfo,
  type Premissa,
} from '@/utils/futebol-premissas';
import {
  evidenciaDe,
  ladoDaSaida,
  tilesDe,
  manchete,
  type Evidencia,
  type Tile as TileT,
} from '@/utils/futebol-evidencias';
import { fmtDayShort } from '@/utils/futebol-datas';
import type { MatchupTendencies } from '@/utils/futebol-tendencias';
import { settleFutebol, resultBadge, isHit } from '@/utils/futebol-settlement';

/** O placar do jogo encerrado, para liquidar cada mercado do mapa. */
export interface PlacarFinal {
  home: number | null;
  away: number | null;
}

/**
 * Distribuição de gols (Poisson sobre λ total). Transplantado do antigo card
 * "Nosso modelo de gols": era a peça reaproveitável dele, e agora vive onde ela
 * fala do assunto, a aba de Gols.
 */
function GoalDistChart({ lh, la }: { lh: number; la: number }) {
  const lambda = lh + la;
  const fact = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const pois = (k: number) => (Math.exp(-lambda) * Math.pow(lambda, k)) / fact(k);
  const bars = [0, 1, 2, 3].map((k) => ({ k: String(k), p: pois(k) }));
  const acc = bars.reduce((s, b) => s + b.p, 0);
  bars.push({ k: '4+', p: Math.max(0, 1 - acc) });
  const max = Math.max(...bars.map((b) => b.p), 0.001);
  return (
    <div>
      <div className="flex items-end gap-2 h-20">
        {bars.map((b) => (
          <div key={b.k} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[9px] text-ink-3 tabular-nums">{Math.round(b.p * 100)}%</span>
            <div className="w-full bg-forest/80 rounded-t" style={{ height: `${(b.p / max) * 100}%` }} />
            <span className="text-[10px] text-ink-2 font-semibold">{b.k}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-ink-3 mt-1.5 text-center">
        chance de cada total de gols · esperado {lambda.toFixed(1).replace('.', ',')}
      </p>
    </div>
  );
}

function SeloResultado({ market, outcome, line, placar }: { market: string; outcome: string; line: number | null; placar: PlacarFinal }) {
  const r = settleFutebol(market, outcome, line, placar.home, placar.away);
  if (!r) return null;
  const b = resultBadge(r);
  const cls =
    b.tone === 'won'
      ? 'bg-forest/10 text-forest'
      : b.tone === 'lost'
        ? ''
        : 'bg-canvas-2 text-ink-2';
  return (
    <span
      className={`px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.1em] ${cls}`}
      style={b.tone === 'lost' ? { background: '#fde2e7', color: '#9a1f2e' } : undefined}
    >
      {b.label}
    </span>
  );
}

/**
 * O mapa de premissas do jogo.
 *
 * Substitui "a aposta e o preço" como conteúdo principal: a revisão da metodologia
 * (docs/premissas-recalibragem.md) trocou a porta de publicação de preço para
 * contexto, então o pick é consequência e o contexto é o conteúdo.
 *
 * Duas coisas guiaram esta versão, as duas vindas da revisão de UI:
 *
 * 1. CADA PREMISSA MOSTRA O NÚMERO. Check e peso não são análise: "em boa fase" sem
 *    o dado é adjetivo. Cada premissa acesa vem com a frase que a sustenta, e as
 *    apagadas também, pra dar pra ver se faltou pouco ou muito.
 * 2. UM MERCADO POR VEZ. A versão anterior empilhava 5 mercados abertos, cada um com
 *    duas colunas de até 13 itens. Virou aba: o usuário lê um mercado inteiro sem
 *    rolar, e troca quando quiser.
 */

// `melhorCandidato` mudou pra utils/futebol-premissas: o painel da agenda também
// resume o jogo por ele.

/**
 * Stat tile do design system (components/patterns/StatMetric): label 9px em caixa
 * alta com tracking 0.16em, valor semibold com tracking negativo, sub 10px. Célula
 * de uma linha separada por borda à esquerda.
 */
function Tile({ t, primeiro }: { t: TileT; primeiro: boolean }) {
  return (
    <div className={`px-4 py-3 min-w-0 ${primeiro ? '' : 'border-l border-line'}`}>
      <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-2 truncate">{t.label}</div>
      <div
        className={`text-[22px] font-semibold tracking-[-0.02em] leading-none mt-1.5 tabular-nums ${
          t.forte ? 'text-forest' : 'text-ink'
        }`}
      >
        {t.valor}
      </div>
      {t.sub && <div className="text-[10px] text-ink-3 mt-1.5 truncate">{t.sub}</div>}
    </div>
  );
}

/**
 * Meter da porta de publicação. O trilho é um tom mais claro da MESMA cor do
 * preenchimento, não cinza neutro, pra o estado ser legível na barra inteira.
 */
function MeterPorta({ n, total, passa }: { n: number; total: number; passa: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0;
  return (
    <div className="shrink-0 w-[132px]">
      <div className="flex items-baseline gap-1.5 justify-end">
        <span className={`text-[30px] font-semibold leading-none tabular-nums ${passa ? 'text-forest' : 'text-ink-3'}`}>
          {n}
        </span>
        <span className="text-[13px] text-ink-3">de {total}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,61,46,0.12)' }}>
        <div
          className={`h-full rounded-full ${passa ? 'bg-forest' : 'bg-ink-3'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`text-[9px] uppercase tracking-[0.14em] font-bold mt-1.5 text-right ${
          passa ? 'text-forest' : 'text-ink-3'
        }`}
      >
        {passa ? 'entra no board' : `precisa de ${PORTA_PREMISSAS}`}
      </div>
    </div>
  );
}

/**
 * A premissa em uma linha. O número saiu daqui e subiu para os tiles: repetir a
 * mesma métrica em cada linha era o que deixava a tela pesada. Aqui fica o fato
 * ("aconteceu ou não") e a frase curta que o sustenta.
 */
function LinhaPremissa({
  p,
  acesa,
  evidencia,
}: {
  p: Premissa;
  acesa: boolean;
  evidencia: Evidencia | null;
}) {
  const semValor = p.peso === 0;
  return (
    <div className="py-2.5 border-t border-line/60 first:border-t-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-[3px] shrink-0">
          {acesa ? (
            <Check className={`w-3.5 h-3.5 ${semValor ? 'text-ink-3' : 'text-forest'}`} strokeWidth={3} />
          ) : (
            <span className="block w-3.5 h-3.5 rounded-full border-[1.5px] border-line-2" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] leading-snug ${acesa ? 'font-semibold text-ink' : 'text-ink-3'}`}>
              {p.label}
            </span>
            {semValor && acesa && (
              <span
                className="text-[9px] uppercase tracking-[0.1em] font-bold text-ink-3 bg-canvas-2 px-1.5 py-0.5 rounded"
                title={p.motivo}
              >
                já na odd
              </span>
            )}
          </span>
          {evidencia && (
            <span className={`block text-[11.5px] leading-snug mt-0.5 ${acesa ? 'text-ink-2' : 'text-ink-3'}`}>
              {evidencia.texto}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function PainelMercado({
  mercado,
  rows,
  numeros,
  home,
  away,
  tendencies,
  placar,
}: {
  mercado: MercadoInfo;
  rows: FutebolFixturePremissas[];
  numeros: FutebolFixtureNumeros[] | undefined;
  home: string;
  away: string;
  tendencies?: MatchupTendencies | null;
  placar?: PlacarFinal | null;
}) {
  const candidatos = useMemo(
    () =>
      rows
        .filter((r) => r.market === mercado.slug)
        .filter((r) => !(mercado.slug === 'asian_handicap' && r.line_value === 0)),
    [rows, mercado.slug],
  );
  const melhor = useMemo(() => melhorCandidato(rows, mercado.slug), [rows, mercado.slug]);
  const chave = (r: FutebolFixturePremissas) => `${r.outcome}|${r.line_value ?? ''}`;

  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [verOutras, setVerOutras] = useState(false);
  const [verApagadas, setVerApagadas] = useState(false);
  // Trocar de mercado zera a escolha, senão a saída de um vaza no outro.
  useEffect(() => {
    setEscolhido(null);
    setVerOutras(false);
    setVerApagadas(false);
  }, [mercado.slug]);

  const atual = candidatos.find((r) => chave(r) === escolhido) ?? melhor;
  if (!atual) {
    return (
      <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">
        Sem premissas calculadas para este mercado.
      </div>
    );
  }

  const lado = ladoDaSaida(mercado.slug, atual.outcome);
  const acesasSet = new Set(atual.acesas);
  const visiveis = mercado.premissas.filter((p) => !PREMISSAS_OCULTAS.has(p.slug));
  const totalQueValem = visiveis.filter((p) => p.peso == null || p.peso > 0).length;
  const nValem = contaQueValem(mercado.slug, atual.acesas);
  const passa = nValem >= PORTA_PREMISSAS;

  const ordena = (a: Premissa, b: Premissa) => (b.peso ?? 0) - (a.peso ?? 0);
  const acesas = visiveis.filter((p) => acesasSet.has(p.slug)).sort(ordena);
  const apagadas = visiveis.filter((p) => !acesasSet.has(p.slug)).sort(ordena);

  const penAtivas = (atual.penalidades ?? [])
    .filter((s) => !PREMISSAS_OCULTAS.has(s))
    .map((s) => premissaDe(mercado.slug, s))
    .filter(Boolean) as Premissa[];

  const tiles = tilesDe(mercado.slug, numeros, lado);
  const frase = manchete(
    atual.acesas,
    acesas.map((p) => p.slug),
    numeros,
    lado,
  );

  return (
    <div className="bg-white border border-line rounded-rebrand-md overflow-hidden">
      {/* Manchete + meter. Espelha o "Por quê" da /futebol: uma frase grande que diz
          o caso, e o número da porta ao lado. */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-3">
              {outcomeLabel(mercado.slug, atual.outcome, home, away, atual.line_value)}
            </span>
            {/* Jogo encerrado: o que o mapa apontava, liquidado contra o placar. */}
            {placar && (
              <SeloResultado market={mercado.slug} outcome={atual.outcome} line={atual.line_value} placar={placar} />
            )}
          </div>
          <p
            className="text-[17px] md:text-[18px] leading-[1.4] font-medium tracking-tight text-ink mt-2"
            style={{ textWrap: 'pretty' }}
          >
            {frase?.texto ?? 'Nenhuma premissa a favor desta saída.'}
          </p>
        </div>
        <MeterPorta n={nValem} total={totalQueValem} passa={passa} />
      </div>

      {/* KPI row: os números do confronto, uma vez só, em vez de repetidos linha a linha. */}
      {tiles.length > 0 && (
        <div
          className="grid border-y border-line bg-white"
          style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
        >
          {tiles.map((t, i) => (
            <Tile key={t.label} t={t} primeiro={i === 0} />
          ))}
        </div>
      )}

      <div className="px-5 py-3 flex items-start justify-between gap-3 border-b border-line bg-canvas-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">O que pesou</div>
        </div>
        {candidatos.length > 1 && (
          <button
            onClick={() => setVerOutras((v) => !v)}
            className="shrink-0 h-8 px-3 rounded-rebrand-sm border border-line bg-white text-[11.5px] font-semibold text-ink hover:bg-canvas-2 transition inline-flex items-center gap-1"
          >
            Outras saídas
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verOutras ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Trocar de saída fica ESCONDIDO por padrão: eram 8 chips de handicap
          competindo com o conteúdo. */}
      {verOutras && candidatos.length > 1 && (
        <div className="px-5 py-3 border-b border-line/60 flex gap-1.5 flex-wrap">
          {candidatos.map((r) => {
            const k = chave(r);
            const ativo = chave(atual) === k;
            const n = contaQueValem(mercado.slug, r.acesas);
            // Jogo encerrado: cada saída ganha o ponto do que aconteceu.
            const res = placar ? settleFutebol(mercado.slug, r.outcome, r.line_value, placar.home, placar.away) : null;
            return (
              <button
                key={k}
                onClick={() => {
                  setEscolhido(k);
                  setVerOutras(false);
                }}
                className={`px-2.5 h-7 rounded-rebrand-sm text-[11px] font-semibold border transition inline-flex items-center gap-1.5 ${
                  ativo ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink-2 border-line hover:bg-canvas-2'
                }`}
              >
                {res && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    title={resultBadge(res).label}
                    style={{
                      background: isHit(res) ? 'var(--forest)' : res === 'push' ? 'var(--ink-3)' : '#be123c',
                    }}
                  />
                )}
                {outcomeLabel(mercado.slug, r.outcome, home, away, r.line_value)}
                {n > 0 && <span className={ativo ? 'text-canvas/70' : 'text-forest'}> · {n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {mercado.aviso && (
        <div className="px-5 py-2.5 bg-canvas-2 border-b border-line/60 text-[11.5px] text-ink-2">
          {mercado.aviso}
        </div>
      )}

      <div className="px-5 py-1">
        {acesas.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-ink-2">
            Nenhuma premissa a favor desta saída.
          </div>
        ) : (
          acesas.map((p) => (
            <LinhaPremissa
              key={p.slug}
              p={p}
              acesa
              // A premissa que virou manchete não repete a frase logo abaixo dela.
              evidencia={p.slug === frase?.slug ? null : evidenciaDe(p.slug, numeros, lado)}
            />
          ))
        )}
      </div>

      {penAtivas.length > 0 && (
        <div className="px-5 pb-3">
          {penAtivas.map((p) => (
            <div key={p.slug} className="flex items-start gap-2.5 py-2.5 border-t border-line/60">
              <Minus className="w-4 h-4 text-status-danger shrink-0 mt-0.5" strokeWidth={3} />
              <span className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-ink leading-snug">{p.label}</span>
                {p.motivo && <span className="block text-[10.5px] text-ink-3 leading-snug mt-0.5">{p.motivo}</span>}
              </span>
              {p.peso != null && p.peso !== 0 && (
                <span className="shrink-0 text-[12px] tabular-nums font-bold text-status-danger">{p.peso}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Única sobra do antigo "Nosso modelo de gols": a distribuição de placares,
          que não repete nada dito acima. As leituras textuais do modelo ("Vitória do
          X · 57%") saíram — diziam o mesmo que o cabeçalho do mercado, com outra
          régua, e duas réguas para a mesma frase confundem. */}
      {mercado.slug === 'goals_over_under' && tendencies?.lambdas && (
        <div className="px-5 py-3 border-t border-line bg-canvas-2/50">
          <GoalDistChart lh={tendencies.lambdas.lh} la={tendencies.lambdas.la} />
        </div>
      )}

      {apagadas.length > 0 && (
        <div className="border-t border-line">
          <button
            onClick={() => setVerApagadas((v) => !v)}
            className="w-full px-5 py-3 flex items-center justify-between gap-2 text-left hover:bg-canvas-2 transition"
          >
            <span className="text-[12px] font-semibold text-ink-2">
              {apagadas.length} {apagadas.length === 1 ? 'premissa não bateu' : 'premissas não bateram'}
            </span>
            <ChevronDown className={`w-4 h-4 text-ink-3 transition-transform ${verApagadas ? 'rotate-180' : ''}`} />
          </button>
          {verApagadas && (
            <div className="px-5 pb-2 bg-canvas-2/40">
              {apagadas.map((p) => (
                <LinhaPremissa
                  key={p.slug}
                  p={p}
                  acesa={false}
                  // acesa=false: numa premissa apagada o número nunca é suprimido,
                  // porque é ele que explica o porquê de não ter batido.
                  evidencia={evidenciaDe(p.slug, numeros, lado, false)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MapaPremissas({
  fixtureId,
  home,
  away,
  tendencies,
  placar,
}: {
  fixtureId: number | undefined;
  home: string;
  away: string;
  /** Estimativa Poisson do confronto; renderiza como referência dentro de cada mercado. */
  tendencies?: MatchupTendencies | null;
  /** Placar final. Presente = jogo encerrado, e o mapa liquida cada mercado. */
  placar?: PlacarFinal | null;
}) {
  const { data: rows, isLoading, isError } = useFutebolFixturePremissas(fixtureId);
  const { data: numeros } = useFutebolFixtureNumeros(fixtureId);
  const [aba, setAba] = useState<string>(MERCADOS[0].slug);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    MERCADOS.forEach((mk) => {
      const melhor = rows ? melhorCandidato(rows, mk.slug) : null;
      m.set(mk.slug, melhor ? contaQueValem(mk.slug, melhor.acesas) : 0);
    });
    return m;
  }, [rows]);

  // Abre no mercado com mais contexto, que é onde a aposta tende a estar.
  useEffect(() => {
    if (!rows?.length) return;
    const melhorAba = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
    if (melhorAba) setAba(melhorAba[0]);
  }, [rows, contagem]);

  const passam = [...contagem.values()].filter((n) => n >= PORTA_PREMISSAS).length;

  // Jogo encerrado: dos mercados que o mapa apontava (passavam a porta), quantos
  // bateram de fato. É a resposta do usuário na tela: "mostrar se ocorreu ou não".
  const retro = useMemo(() => {
    if (!placar || !rows?.length) return null;
    const apontados = MERCADOS
      .map((m) => ({ slug: m.slug, c: melhorCandidato(rows, m.slug) }))
      .filter((x): x is { slug: string; c: FutebolFixturePremissas } =>
        x.c != null && contaQueValem(x.slug, x.c.acesas) >= PORTA_PREMISSAS,
      );
    const liquidados = apontados
      .map((x) => settleFutebol(x.slug, x.c.outcome, x.c.line_value, placar.home, placar.away))
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (!liquidados.length) return null;
    return { total: liquidados.length, hits: liquidados.filter(isHit).length };
  }, [placar, rows]);

  const ate = numeros?.[0]?.ate ?? null;
  // Copa do Brasil no mata-mata tem 2 jogos de amostra por time, e com 2 jogos as
  // premissas acendem para qualquer lado (caso real: "defesas frágeis" no Over e
  // "defesas firmes" no Under, no mesmo jogo, ambas com pontuação cheia). O aviso
  // não conserta o dado, mas avisa o usuário do tamanho do chão que ele pisa.
  const menorAmostra = Math.min(...(numeros ?? []).map((x) => x.jogos ?? Infinity));
  const amostraCurta = Number.isFinite(menorAmostra) && menorAmostra < 5;
  const mercado = MERCADOS.find((m) => m.slug === aba) ?? MERCADOS[0];

  if (isError) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink-3">Mapa de premissas</h2>
          <p className="text-[13px] text-ink-2 mt-1">
            {isLoading
              ? 'Verificando as premissas do jogo…'
              : retro
                ? `O mapa apontava ${retro.total} ${retro.total === 1 ? 'mercado' : 'mercados'} · ${retro.hits} ${retro.hits === 1 ? 'bateu' : 'bateram'}`
                : passam > 0
                  ? `${passam} de ${MERCADOS.length} mercados com contexto para aposta`
                  : 'Nenhum mercado com contexto suficiente neste jogo'}
          </p>
        </div>
        {/* A data do dado, declarada. O snapshot da temporada não é de hoje. */}
        {ate && <span className="text-[10.5px] text-ink-3">Números da temporada até {fmtDayShort(ate)}</span>}
      </div>

      {amostraCurta && !isLoading && (
        <div
          className="mb-3 rounded-rebrand-sm px-3 py-2 text-[11.5px] leading-snug"
          style={{ background: '#fef7df', border: '1px solid #fde68a', color: '#5a3c00' }}
        >
          <span className="font-semibold" style={{ color: '#9a6c00' }}>
            Amostra curta ·{' '}
          </span>
          Cada time tem só {menorAmostra} {menorAmostra === 1 ? 'jogo' : 'jogos'} nesta competição. Com tão pouco
          jogo, as premissas acendem fácil e dizem pouco.
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-10 w-full bg-canvas-2 rounded-rebrand-md" />
          <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
        </div>
      ) : !rows?.length ? (
        <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">
          Este jogo ainda não tem premissas calculadas.
        </div>
      ) : (
        <>
          {/* Um mercado por vez. Os 5 continuam visíveis, como abas. */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
            {MERCADOS.map((m) => {
              const n = contagem.get(m.slug) ?? 0;
              const ativo = m.slug === aba;
              return (
                <button
                  key={m.slug}
                  onClick={() => setAba(m.slug)}
                  className={`shrink-0 h-9 px-3.5 rounded-rebrand-sm text-[12px] font-semibold border transition inline-flex items-center gap-1.5 ${
                    ativo ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink border-line hover:bg-canvas-2'
                  }`}
                >
                  {m.label}
                  <span
                    className={`text-[10px] tabular-nums font-bold px-1.5 rounded ${
                      ativo
                        ? 'bg-white/15 text-canvas'
                        : n >= PORTA_PREMISSAS
                          ? 'bg-forest/10 text-forest'
                          : 'bg-canvas-2 text-ink-3'
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>

          <PainelMercado
            mercado={mercado}
            rows={rows}
            numeros={numeros}
            home={home}
            away={away}
            tendencies={tendencies}
            placar={placar}
          />
        </>
      )}

      <p className="text-[10.5px] text-ink-3 mt-3 leading-relaxed">
        A aposta entra no board quando o jogo tem {PORTA_PREMISSAS} premissas ou mais a favor. O preço entra depois,
        só para checar que não estamos pagando abaixo do justo.
      </p>
    </section>
  );
}
