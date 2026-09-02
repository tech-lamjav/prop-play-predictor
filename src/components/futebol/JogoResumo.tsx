import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Blur } from '@/components/futebol/FutebolGate';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import { useFutebolFixturePremissas, useFutebolFixtureNumeros, useVitrine } from '@/hooks/use-futebol-data';
import type {
  FutebolFixtureValueRow,
  FutebolInjury,
} from '@/services/futebol-data.service';
import {
  contextoDoMercado,
  outcomeLabel,
  pesoForte,
  premissaDe,
} from '@/utils/futebol-premissas';
import { ladoDaSaida, manchete } from '@/utils/futebol-evidencias';
import { melhorLeitura, resumoDosMercados, type MercadoResumo } from '@/utils/futebol-leitura';
import { premissasAcesasDaLeitura } from '@/utils/futebol-motivos';
import { fmtDayShort, isFinished } from '@/utils/futebol-datas';
import { settleFutebol, resultBadge, isHit } from '@/utils/futebol-settlement';
import { ehDestaque, ehFaixaAlta, faixaWord } from '@/utils/futebol-score';

/**
 * Aba RESUMO da tela de jogo (Protótipo 1b do Claude Design):
 * esquerda = a leitura em manchete, os 5 mercados em linhas e o "como chegam";
 * direita = o hero da melhor leitura, desfalques e o disclaimer.
 *
 * Adaptação honesta do protótipo: Score/odd/chance só aparecem quando existem
 * odds coletadas (T−24h). Sem odds, as linhas mostram o contexto (premissas), que
 * é o que dá para afirmar — o mesmo padrão "sem preço" que o protótipo usa no BTTS.
 */

export interface JogoInfo {
  fixtureId: number;
  /** Ids dos times: escudo e filtro de desfalques por lado. */
  homeId?: number;
  awayId?: number;
  home: string;
  away: string;
  competition: string;
  season: number;
  kickoffUtc: string | null;
  statusShort: string | null;
  goalsHome: number | null;
  goalsAway: number | null;
}

function scoreBadge(r: MercadoResumo): { texto: string; cls: string; style?: React.CSSProperties } {
  if (r.value) {
    const s = r.value.score;
    // Cor pela FAIXA que o backend publicou, não por número comparado aqui.
    if (ehFaixaAlta(r.value.faixa)) return { texto: String(s), cls: 'bg-forest text-canvas border-forest' };
    if (ehDestaque(r.value.faixa))
      return { texto: String(s), cls: '', style: { background: 'rgba(212,160,23,.15)', color: '#b8870f', border: '1px solid rgba(212,160,23,.4)' } };
    return { texto: String(s), cls: 'bg-canvas-2 text-ink-3 border-line' };
  }
  return r.passa
    ? { texto: `${r.nValem}✓`, cls: 'bg-forest/10 text-forest border-forest/30' }
    : { texto: `${r.nValem}✓`, cls: 'bg-canvas-2 text-ink-3 border-line' };
}

/** Hero "Melhor leitura do jogo" — o gradiente de assinatura do DS. */
export function HeroLeitura({
  top,
  jogo,
  locked,
  compacto = false,
  retro,
}: {
  top: MercadoResumo | null;
  jogo: JogoInfo;
  locked: boolean;
  compacto?: boolean;
  retro?: string | null;
}) {
  const { data: numeros } = useFutebolFixtureNumeros(jogo.fixtureId);
  if (!top) return null;
  const lado = ladoDaSaida(top.mercado.slug, top.candidato.outcome);
  const pick = outcomeLabel(top.candidato, jogo.home, jogo.away);

  // Os porquês, montados pela mesma função que o painel da lista usa (#332).
  // Os parâmetros preservam exatamente o que esta tela fazia: corte em três,
  // premissa de peso zero incluída, e sem cair no histórico do time.
  const porques = premissasAcesasDaLeitura(
    {
      mercado: top.mercado.slug,
      acesas: top.candidato.acesas,
      numeros,
      historico: undefined,
      lado,
      linha: null,
    },
    { max: 3, incluirPesoZero: true },
  ).map(({ premissa, evidencia }) =>
    evidencia
      ? `${premissa.label}: ${evidencia.texto.charAt(0).toLowerCase()}${evidencia.texto.slice(1)}.`
      : `${premissa.label}.`,
  );

  const fim = isFinished(jogo.statusShort);
  const res = fim ? settleFutebol(top.candidato, jogo.goalsHome, jogo.goalsAway) : null;

  return (
    <div
      className={`rounded-rebrand-xl text-white relative overflow-hidden ${compacto ? 'p-5' : 'p-6'}`}
      style={{ background: 'linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)' }}
    >
      <div
        className="absolute rounded-full pointer-events-none"
        style={{ right: -50, top: -60, width: 220, height: 220, background: 'radial-gradient(circle,rgba(251,191,36,.26),transparent 68%)' }}
      />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">Melhor leitura do jogo</div>
        <div className={`font-semibold tracking-[-0.02em] mt-2 leading-[1.25] ${compacto ? 'text-[21px]' : 'text-[23px]'}`}>{pick}</div>
        <div className="text-[12px] text-white/50 mt-1">{top.mercado.label}</div>

        <div className="flex items-baseline gap-2 mt-4">
          {top.value ? (
            <>
              <span className="tabular-nums font-bold leading-none text-[44px]" style={{ color: '#fbbf24' }}>
                {top.value.score}
              </span>
              <span className="text-[12px] text-white/45">/100 · faixa {faixaWord(top.value.faixa)}</span>
            </>
          ) : (
            <>
              <span className="tabular-nums font-bold leading-none text-[44px]" style={{ color: '#fbbf24' }}>
                {top.nValem}
              </span>
              <span className="text-[12px] text-white/45">de {top.totalQueValem} premissas a favor · sem preço ainda</span>
            </>
          )}
        </div>

        {top.value && (
          <div className="grid grid-cols-2 gap-3.5 mt-4">
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">Chance</div>
              <div className="tabular-nums text-[18px] font-semibold mt-1">
                <Blur active={locked}>{Math.round(top.value.prob_justa_fechamento * 100)}%</Blur>
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">Odd</div>
              <div className="tabular-nums text-[18px] font-semibold mt-1">
                <Blur active={locked}>{top.value.best_odd.toFixed(2)}</Blur>
              </div>
            </div>
          </div>
        )}

        {(retro || res) && (
          <div className="mt-4 pt-3.5 border-t border-white/15 text-[12px] leading-relaxed text-white/75">
            {retro}
            {res && (
              <span
                className="ml-2 px-2 h-5 inline-flex items-center rounded-full text-[10px] font-bold uppercase tracking-[0.06em]"
                style={{
                  background: isHit(res) ? 'rgba(220,239,226,.2)' : res === 'push' ? 'rgba(255,255,255,.12)' : 'rgba(251,227,232,.18)',
                  color: isHit(res) ? '#8ee6b0' : res === 'push' ? 'rgba(255,255,255,.7)' : '#ffb3c0',
                }}
              >
                {resultBadge(res).label}
              </span>
            )}
          </div>
        )}

        {!compacto && porques.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/15 flex flex-col gap-2">
            {porques.map((t) => (
              <div key={t} className="flex gap-2 items-start text-[12.5px] leading-relaxed text-white/80">
                <span className="w-[5px] h-[5px] rounded-full mt-[7px] shrink-0" style={{ background: '#fbbf24' }} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function JogoResumo({
  jogo,
  valueRows,
  injuries,
  locked,
  onAbrirMercado,
}: {
  jogo: JogoInfo;
  valueRows: FutebolFixtureValueRow[] | null | undefined;
  injuries: FutebolInjury[] | null | undefined;
  locked: boolean;
  onAbrirMercado: (slug: string) => void;
}) {
  const { data: rows, isLoading } = useFutebolFixturePremissas(jogo.fixtureId);
  const { data: numeros } = useFutebolFixtureNumeros(jogo.fixtureId);

  // A vitrine (#324): a prateleira sai do CATÁLOGO, não do board, então filtrar
  // as linhas não basta — sem isto o mercado escondido volta como chip, com
  // barra de Score e sem odd.
  const { ocultos } = useVitrine();
  const resumos = useMemo(() => resumoDosMercados(rows, valueRows, null, ocultos), [rows, valueRows, ocultos]);
  const top = useMemo(() => melhorLeitura(resumos), [resumos]);
  const fim = isFinished(jogo.statusShort);
  const placar = useMemo(
    () => (fim ? { home: jogo.goalsHome, away: jogo.goalsAway } : null),
    [fim, jogo.goalsHome, jogo.goalsAway],
  );

  // A manchete: a evidência mais pesada do melhor mercado, em frase grande.
  const leitura = useMemo(() => {
    if (!top) return null;
    const lado = ladoDaSaida(top.mercado.slug, top.candidato.outcome);
    const acesasPorPeso = top.candidato.acesas
      .map((s) => premissaDe(top.mercado.slug, s))
      .filter((p): p is NonNullable<typeof p> => p != null)
      .sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0))
      .map((p) => p.slug);
    return manchete(top.candidato.acesas, acesasPorPeso, numeros, lado);
  }, [top, numeros]);

  const chips = useMemo(() => {
    const out: string[] = [];
    if (top) {
      const fortes = top.candidato.acesas
        .map((s) => premissaDe(top.mercado.slug, s))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .filter(pesoForte).length;
      const semCal = top.mercado.teto == null;
      const ctx = contextoDoMercado(fortes, semCal);
      out.push(`${top.nValem} ${top.nValem === 1 ? 'premissa' : 'premissas'} a favor · ${ctx.label.toLowerCase()}`);
    }
    const amostra = Math.min(...(numeros ?? []).map((x) => x.jogos ?? Infinity));
    if (Number.isFinite(amostra) && amostra < 5) out.push(`amostra curta: ${amostra} jogos na competição`);
    const fora = (injuries ?? []).length;
    if (fora > 0) out.push(`${fora} ${fora === 1 ? 'desfalque' : 'desfalques'} no radar`);
    return out;
  }, [top, numeros, injuries]);

  // Retro do encerrado: dos que passavam, quantos bateram.
  const retro = useMemo(() => {
    if (!placar || !resumos.length) return null;
    const apontados = resumos.filter((r) => r.passa);
    const liq = apontados
      .map((r) => settleFutebol(r.candidato, placar.home, placar.away))
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (!liq.length) return null;
    const hits = liq.filter(isHit).length;
    return `O mapa apontava ${liq.length} ${liq.length === 1 ? 'mercado' : 'mercados'} · ${hits} ${hits === 1 ? 'bateu' : 'bateram'}`;
  }, [placar, resumos]);

  // "Como chegam": as 4 barras espelhadas do protótipo, casa × fora.
  const barras = useMemo(() => {
    const casa = numeros?.find((x) => x.side === 'home');
    const fora = numeros?.find((x) => x.side === 'away');
    if (!casa || !fora) return [];
    const d1 = (v: number) => v.toFixed(1).replace('.', ',');
    const linhas: { l: string; a: string; b: string; va: number; vb: number }[] = [];
    if (casa.gf_total != null && fora.gf_total != null)
      linhas.push({ l: 'Gols marcados por jogo', a: d1(casa.gf_total), b: d1(fora.gf_total), va: casa.gf_total, vb: fora.gf_total });
    if (casa.ga_total != null && fora.ga_total != null)
      linhas.push({ l: 'Gols sofridos por jogo', a: d1(casa.ga_total), b: d1(fora.ga_total), va: casa.ga_total, vb: fora.ga_total });
    if (casa.posicao != null && fora.posicao != null)
      // Posição: menor é melhor, então a barra usa o valor do OUTRO lado.
      linhas.push({ l: 'Posição na tabela', a: `${casa.posicao}º`, b: `${fora.posicao}º`, va: fora.posicao, vb: casa.posicao });
    if (casa.clean_sheets != null && fora.clean_sheets != null)
      linhas.push({ l: 'Jogos sem sofrer gol', a: String(casa.clean_sheets), b: String(fora.clean_sheets), va: casa.clean_sheets, vb: fora.clean_sheets });
    return linhas.map((x) => {
      const tot = x.va + x.vb || 1;
      return { ...x, wa: `${Math.round((x.va / tot) * 100)}%`, wb: `${Math.round((x.vb / tot) * 100)}%` };
    });
  }, [numeros]);
  const ate = numeros?.[0]?.ate ?? null;
  const temValor = (valueRows?.length ?? 0) > 0;

  // Só os mercados COTADOS têm faixa. `passa` também é verdadeiro por premissas
  // num mercado sem odds, e juntar os dois faria a frase atribuir faixa a quem
  // não tem preço coletado.
  const cotados = resumos.filter((r) => r.value);
  const emFaixaBaixa = cotados.filter((r) => !r.passa).map((r) => r.mercado.label.toLowerCase());
  const juntar = (arr: string[]) => (arr.length <= 1 ? arr[0] ?? '' : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`);
  const nota = fim && retro
    ? retro
    : !temValor
      ? 'Sem preço coletado ainda: as odds entram perto do jogo, e com elas o Score fecha.'
      : emFaixaBaixa.length
        ? `${juntar(emFaixaBaixa)} ${emFaixaBaixa.length === 1 ? 'fica' : 'ficam'} em faixa baixa, ${emFaixaBaixa.length === 1 ? 'entra' : 'entram'} como consulta.`
        : `${cotados.length === 1 ? 'O mercado cotado aparece' : `Os ${cotados.length} mercados cotados aparecem`} em faixa Alta ou Média neste jogo.`;

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-40 w-full bg-canvas-2 rounded-rebrand-xl" />
        <Skeleton className="h-72 w-full bg-canvas-2 rounded-rebrand-xl" />
      </div>
    );
  }

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="min-w-0 flex flex-col gap-5">
        {/* A leitura do jogo, em manchete. */}
        <div className="bg-white border border-line rounded-rebrand-xl p-6 md:p-7">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-ink-3">A leitura do jogo</div>
          <p
            className="mt-3 text-[22px] md:text-[28px] leading-[1.28] font-semibold tracking-[-0.025em] text-ink max-w-[620px]"
            style={{ textWrap: 'pretty' }}
          >
            {leitura?.texto ?? 'Sem premissas suficientes para uma leitura neste jogo.'}
          </p>
          {chips.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {chips.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full bg-canvas-2 text-[11.5px] font-semibold text-ink-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-forest" />
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Os 5 mercados, uma linha cada. Clique abre a bancada. */}
        <div className="bg-white border border-line rounded-rebrand-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-baseline justify-between gap-3">
            <span className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-ink-2">Os 5 mercados</span>
            <span className="text-[11.5px] text-ink-3">clique para abrir a bancada</span>
          </div>
          {resumos.map((r) => {
            const pick = outcomeLabel(r.candidato, jogo.home, jogo.away);
            const badge = scoreBadge(r);
            const res = placar
              ? settleFutebol(r.candidato, placar.home, placar.away)
              : null;
            return (
              <button
                key={r.mercado.slug}
                onClick={() => onAbrirMercado(r.mercado.slug)}
                className={`w-full text-left border-b border-line/60 last:border-b-0 px-6 py-3.5 grid grid-cols-[96px_1fr_auto_auto] gap-4 items-center hover:bg-canvas transition ${r.passa ? '' : 'opacity-60'}`}
              >
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3">{r.mercado.label}</span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-ink truncate">
                    {pick}
                    {res && (
                      <span
                        className="ml-2 px-1.5 h-[18px] inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.06em] align-middle"
                        style={
                          isHit(res)
                            ? { background: '#dcefe2', color: '#0a3d2e' }
                            : res === 'push'
                              ? { background: '#eef0eb', color: '#5a625a' }
                              : { background: '#fbe3e8', color: '#be123c' }
                        }
                      >
                        {resultBadge(res).label}
                      </span>
                    )}
                  </span>
                  <span className="block text-[11.5px] text-ink-3 mt-0.5 truncate">
                    {r.value
                      ? `${Math.round(r.value.prob_justa_fechamento * 100)}% de chance · odd ${r.value.best_odd.toFixed(2)}`
                      : `${r.nValem} de ${r.totalQueValem} premissas a favor`}
                  </span>
                </span>
                {r.value ? (
                  <span
                    className="tabular-nums text-[13px] font-semibold hidden md:block"
                    style={{ color: r.value.edge > 0 ? 'var(--forest)' : 'var(--ink-3)' }}
                  >
                    <Blur active={locked}>{`${r.value.edge >= 0 ? '+' : '−'}${Math.abs(r.value.edge * 100).toFixed(1).replace('.', ',')}%`}</Blur>
                  </span>
                ) : (
                  <span className="hidden md:block" />
                )}
                <span
                  className={`tabular-nums w-[42px] h-[42px] rounded-xl grid place-items-center text-[15px] font-bold border ${badge.cls}`}
                  style={badge.style}
                >
                  {badge.texto}
                </span>
              </button>
            );
          })}
          <div className="px-6 py-3.5 bg-canvas-2 text-[11.5px] text-ink-2">{nota}</div>
        </div>

        {/* Como chegam: barras espelhadas casa × fora, como no protótipo. A barra
            da posição usa o valor do outro lado, porque na tabela menor é melhor. */}
        {barras.length > 0 && (
          <div className="bg-white border border-line rounded-rebrand-xl p-6">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-ink-2 mb-4">Como chegam</div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
              {barras.map((x) => (
                <div key={x.l}>
                  <div className="flex justify-between items-baseline mb-1.5 tabular-nums">
                    <span className="text-[15px] font-semibold text-forest">{x.a}</span>
                    <span className="text-[11px] font-medium text-ink-3">{x.l}</span>
                    <span className="text-[15px] font-semibold text-ink-2">{x.b}</span>
                  </div>
                  <div className="flex gap-1 h-[7px]">
                    <div className="flex-1 bg-canvas-2 rounded-l-full flex justify-end overflow-hidden">
                      <div className="bg-forest" style={{ width: x.wa }} />
                    </div>
                    <div className="flex-1 bg-canvas-2 rounded-r-full overflow-hidden">
                      <div className="bg-ink-3" style={{ width: x.wb }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 flex flex-col gap-4">
        <HeroLeitura top={top} jogo={jogo} locked={locked} retro={fim ? retro : null} />

        {top?.value && !fim && !locked && (
          <div className="bg-white border border-line rounded-rebrand-xl overflow-hidden">
            <RegistrarApostaCTA
              draft={{
                homeName: jogo.home,
                awayName: jogo.away,
                competition: jogo.competition,
                kickoffUtc: jogo.kickoffUtc,
                market: top.value.market,
                outcome: top.value.outcome,
                lineValue: top.value.line_value,
                bestOdd: top.value.best_odd,
                oddKind: 'melhor',
              }}
            />
          </div>
        )}

        {(injuries?.length ?? 0) > 0 && (
          <div className="bg-white border border-line rounded-rebrand-xl p-5">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-ink-2 mb-2">Desfalques</div>
            {(injuries ?? []).slice(0, 8).map((d, i) => {
              const duvida = /quest|doubt|dúvid/i.test(d.injury_type || '');
              return (
                <div key={i} className="flex items-center gap-2.5 py-2 border-t border-line/60 first:border-t-0">
                  <span className="text-[12.5px] font-semibold text-ink truncate">{d.player_name}</span>
                  <span className="text-[11px] text-ink-3 truncate">{d.injury_reason || d.injury_type}</span>
                  <span
                    className="ml-auto px-1.5 h-[18px] inline-flex items-center rounded text-[9px] font-bold shrink-0"
                    style={duvida ? { background: '#fef7df', color: '#9a6c00' } : { background: '#fde2e7', color: '#9a1f2e' }}
                  >
                    {duvida ? 'Dúvida' : 'Fora'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-ink-3">
          Leitura de risco, não recomendação de aposta.{ate ? ` Números da temporada até ${fmtDayShort(ate)}.` : ''}
        </p>
      </div>
    </div>
  );
}
