import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { FutebolFixtureHistorico, FutebolFixtureNumeros } from '@/services/futebol-data.service';
import { pesoPalavra, pesoForte, rotuloPremissa, type Premissa } from '@/utils/futebol-premissas';
import { evidenciaDe, type Evidencia } from '@/utils/futebol-evidencias';
import { evidenciaDoHistorico, storyDaPremissa, type SerieHistorico, type Story } from '@/utils/futebol-historico';
import { Crest } from './Crest';

/**
 * As abas "A favor" e "Contra": cada premissa com os jogos que produziram a média.
 *
 * O gráfico é UM só para os dois times, com escala compartilhada. Duas caixas
 * separadas, como estava antes, deixavam cada time com a sua própria escala, e aí
 * barra alta de um valia menos que barra baixa do outro. Aqui a altura compara.
 *
 * O que cada elemento existe para responder:
 *   rótulo em cima da barra → quanto foi naquele jogo
 *   escudo embaixo         → contra quem foi
 *   linha tracejada âmbar  → a média, que é o número que a premissa usa
 *   rótulo na ponta da linha → qual é essa média, sem precisar medir no olho
 */

const d1 = (v: number) => v.toFixed(1).replace('.', ',');
/**
 * A linha sai como está cotada: 1,75 é 1,75, não 1,8. Arredondar para uma casa
 * dizia "linha 1,8" numa aposta que é de 1,75.
 */
const fmtLinhaExata = (v: number) => String(v).replace('.', ',');
const dia = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

/** Gol é inteiro, gol esperado é decimal. */
const rotuloValor = (v: number | null, metrica: SerieHistorico['metrica']) => {
  if (v == null) return '';
  return metrica === 'xg' ? d1(v) : String(Math.round(v));
};

/**
 * A cor da barra diz o que o jogo significa PARA A SAÍDA ESCOLHIDA, não só "acima ou
 * abaixo da média": num "mais de 2,5" o jogo de 4 gols joga a favor, num "menos de
 * 2,5" o mesmo jogo joga contra. Quem separa os times é a posição (bloco da esquerda
 * e da direita, com o nome em cima), então a cor fica livre para o significado.
 */
const COR_FAVOR = '#0a3d2e';
const COR_CONTRA = '#c9cec6';

const COR_RES: Record<'V' | 'E' | 'D', { bg: string; fg: string }> = {
  V: { bg: '#dcefe2', fg: '#0a3d2e' },
  E: { bg: '#eef0eb', fg: '#5a625a' },
  D: { bg: '#fbe3e8', fg: '#be123c' },
};

/** Sequência de resultados: um quadro por jogo, com placar, escudo e adversário. */
function SerieResultados({ s }: { s: SerieHistorico }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {s.jogos.map((j) => {
        const c = COR_RES[j.resultado];
        return (
          <div
            key={`${j.ordem}-${j.data}`}
            className="rounded-lg px-2 py-1.5"
            style={{ background: c.bg }}
            title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario}`}
          >
            <div className="tabular-nums text-[12.5px] font-bold leading-none text-center" style={{ color: c.fg }}>
              {j.placar}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <Crest name={j.adversario} id={j.adversarioId} size={13} />
              <span className="text-[9.5px] truncate max-w-[58px]" style={{ color: c.fg, opacity: 0.8 }}>
                {j.adversario}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Amostra de 1 ou 2 jogos não vira gráfico: barra sozinha ocupando a largura toda
 * parecia bloco de cor e não informava nada. Vira o valor escrito.
 */
function SerieMiuda({ s }: { s: SerieHistorico }) {
  const rotulo = (v: number | null) => {
    if (v == null) return '—';
    if (s.metrica === 'xg') return `${d1(v)} de gol esperado`;
    const n = Math.round(v);
    if (s.metrica === 'ga') return `${n} ${n === 1 ? 'gol sofrido' : 'gols sofridos'}`;
    if (s.metrica === 'gf') return `${n} ${n === 1 ? 'gol marcado' : 'gols marcados'}`;
    return `${n} ${n === 1 ? 'gol no jogo' : 'gols no jogo'}`;
  };
  return (
    <div className="flex flex-wrap gap-2">
      {s.jogos.map((j) => (
        <div key={`${j.ordem}-${j.data}`} className="rounded-lg px-2.5 py-1.5 bg-canvas-2">
          <div className="tabular-nums text-[13px] font-bold text-ink leading-none">{rotulo(j.valor)}</div>
          <div className="flex items-center gap-1 mt-1.5">
            <Crest name={j.adversario} id={j.adversarioId} size={13} />
            <span className="text-[9.5px] text-ink-3">
              {j.placar} contra {j.adversario} · {dia(j.data)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const PLOT = 96;
const TOPO_ROTULO = 16;

/** Um bloco do gráfico unificado: as barras de um time, na escala comum. */
function BlocoSerie({
  s,
  teto,
  comRotulo,
  referencia,
}: {
  s: SerieHistorico;
  teto: number;
  comRotulo: boolean;
  referencia?: Story['referencia'];
}) {
  const y = (v: number) => (v / teto) * (PLOT - TOPO_ROTULO);
  return (
    <div className="min-w-0" style={{ flexGrow: s.jogos.length, flexBasis: 0 }}>
      {/* O escudo e o nome ficam em cima do PRÓPRIO gráfico: na legenda longe dele
          não dava para saber qual metade era de quem. */}
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <Crest name={s.teamName} id={s.teamId} size={16} />
        <span className="text-[11.5px] font-semibold text-ink truncate">{s.titulo}</span>
        <span className="text-[10.5px] text-ink-3 shrink-0">{s.sub}</span>
      </div>
      <div className="relative" style={{ height: PLOT }}>
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {s.jogos.map((j) => (
            <div
              key={`${j.ordem}-${j.data}`}
              className="flex-1 min-w-[6px] max-w-[44px] flex flex-col items-center justify-end"
              title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario} · ${j.placar}${
                j.valor != null ? ` · ${rotuloValor(j.valor, s.metrica)}` : ' · sem dado'
              }`}
            >
              {comRotulo && (
                <span className="tabular-nums text-[9.5px] font-semibold leading-none mb-1" style={{ color: 'var(--ink-2)' }}>
                  {j.valor == null ? '·' : rotuloValor(j.valor, s.metrica)}
                </span>
              )}
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: j.valor == null ? 3 : Math.max(3, y(j.valor)),
                  background: j.valor == null ? '#e3e6e0' : j.favorece ? COR_FAVOR : COR_CONTRA,
                }}
              />
            </div>
          ))}
        </div>
        {referencia && (
          <div
            className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
            style={{ borderColor: 'var(--ink-3)', bottom: y(referencia.valor) }}
          />
        )}
        {s.media != null && (
          <>
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed pointer-events-none"
              style={{ borderColor: '#d4a017', bottom: y(s.media) }}
            />
            <span
              className="absolute right-0 tabular-nums text-[9.5px] font-bold px-1 rounded bg-white/90 pointer-events-none"
              style={{ color: '#b8870f', bottom: y(s.media) + 2 }}
            >
              média {d1(s.media)}
            </span>
          </>
        )}
      </div>
      {/* Contra quem foi cada jogo. */}
      <div className="flex items-start gap-[3px] mt-1.5">
        {s.jogos.map((j) => (
          <div key={`c-${j.ordem}-${j.data}`} className="flex-1 min-w-[6px] max-w-[44px] flex justify-center">
            <Crest name={j.adversario} id={j.adversarioId} size={comRotulo ? 15 : 11} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** O gráfico dos dois times em uma caixa, escala compartilhada. */
function GraficoUnificado({ story }: { story: Story }) {
  const numericas = story.series.filter((s) => s.metrica !== 'resultado');
  const todosValores = numericas.flatMap((s) => s.jogos.map((j) => j.valor)).filter((v): v is number => v != null);
  const teto = Math.max(...todosValores, story.referencia?.valor ?? 0, 1);
  const total = numericas.reduce((n, s) => n + s.jogos.length, 0);
  // Rótulo de dados em cima de cada barra. Gol é 1 caractere e cabe quase sempre; o
  // gol esperado tem decimal e só cabe até a temporada inteira dos dois times.
  const comRotulo = total <= 24 || numericas.every((s) => s.metrica !== 'xg');

  // A barra por jogo compara com a MÉDIA (é o que a barra tem para comparar), e o
  // consolidado compara com a LINHA. Dizer "joga a favor" nas duas fazia as duas se
  // contradizerem quando a linha ficava longe da média, então aqui a legenda diz
  // exatamente o que a cor mede.
  const quer = story.series[0]?.direcao === 'maior';

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap justify-end">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR_FAVOR }} />
          <span className="text-[10.5px] text-ink-2">{quer ? 'acima da média' : 'abaixo da média'}, o lado que a premissa quer</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR_CONTRA }} />
          <span className="text-[10.5px] text-ink-3">{quer ? 'abaixo' : 'acima'}</span>
        </span>
      </div>
      {/* Lado a lado no desktop, empilhado no celular: em 343px os dois blocos
          deixavam barras de 10px. A escala segue compartilhada nos dois casos. */}
      <div className="flex flex-col md:flex-row items-stretch md:items-start gap-4 md:gap-3">
        {numericas.map((s, i) => (
          <div
            key={s.chave}
            className={`flex min-w-0 ${i > 0 ? 'pt-4 border-t md:pt-0 md:pl-3 md:border-t-0 md:border-l border-line' : ''}`}
            style={{ flexGrow: s.jogos.length, flexBasis: 0 }}
          >
            <BlocoSerie s={s} teto={teto} comRotulo={comRotulo} referencia={story.referencia} />
          </div>
        ))}
      </div>
      {story.referencia && (
        <div className="text-[10px] text-ink-3 mt-2">Linha tracejada cinza: {story.referencia.label}.</div>
      )}
    </div>
  );
}

/**
 * O fechamento: o número dos dois times somado, contra a linha escolhida. Responde
 * "por que essa premissa joga a favor DESTA saída", que o gráfico de cada time
 * separado não responde.
 */
function Consolidado({ c, saidaLabel, modo }: { c: NonNullable<Story['consolidado']>; saidaLabel: string; modo: 'favor' | 'contra' }) {
  const teto = Math.max(c.valor, c.linha) * 1.25;
  const pct = (v: number) => `${Math.min(100, (v / teto) * 100)}%`;
  const cor = c.favorece ? 'var(--forest)' : 'var(--ink-3)';
  return (
    <div className="rounded-xl bg-canvas-2 p-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3">Somando os dois times</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="tabular-nums text-[30px] font-semibold leading-none" style={{ color: cor }}>
              {d1(c.valor)}
            </span>
            <span className="text-[12px] text-ink-2">{c.unidade}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3">Linha escolhida</div>
          <div className="tabular-nums text-[20px] font-semibold leading-none mt-1.5 text-ink">{fmtLinhaExata(c.linha)}</div>
        </div>
      </div>
      {/* A marca da linha fica POR CIMA do preenchimento, com contorno branco: dentro
          da barra cheia, um tracinho âmbar sem contorno desaparecia. */}
      <div className="relative mt-5 pt-4">
        <span
          className="absolute top-0 -translate-x-1/2 text-[9.5px] font-bold tabular-nums whitespace-nowrap"
          style={{ left: pct(c.linha), color: '#b8870f' }}
        >
          linha {fmtLinhaExata(c.linha)}
        </span>
        <div className="relative h-3.5 rounded-full bg-white">
          <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: pct(c.valor), background: cor }} />
          <div
            className="absolute -top-1 -bottom-1 w-[3px] rounded-full"
            style={{ left: pct(c.linha), background: '#b8870f', boxShadow: '0 0 0 1.5px #fff' }}
          />
        </div>
      </div>
      {/* Na aba Contra a premissa NÃO acendeu, então o consolidado não pode dizer
          "joga a favor" só porque o número passa da linha: o critério do modelo é
          mais exigente que a linha, e é isso que a frase precisa contar. */}
      <div className="text-[11.5px] leading-relaxed text-ink-2 mt-2.5">
        {modo === 'favor'
          ? c.favorece
            ? `Fica ${c.direcao === 'maior' ? 'acima' : 'abaixo'} da linha de ${fmtLinhaExata(c.linha)}, e é por isso que esta premissa joga a favor de ${saidaLabel}.`
            : `Fica ${c.direcao === 'maior' ? 'abaixo' : 'acima'} da linha de ${fmtLinhaExata(c.linha)}: por este número, a premissa não sustenta ${saidaLabel}.`
          : c.favorece
            ? `Fica ${c.direcao === 'maior' ? 'acima' : 'abaixo'} da linha de ${fmtLinhaExata(c.linha)}, mas a premissa não acendeu: o critério do modelo é mais exigente do que a linha.`
            : `Fica ${c.direcao === 'maior' ? 'abaixo' : 'acima'} da linha de ${fmtLinhaExata(c.linha)}, e é por isso que esta premissa não aconteceu.`}
      </div>
    </div>
  );
}
/** O painel que abre dentro da linha: consolidado, gráficos e como ler. */
function PainelPremissa({ story, saidaLabel, modo }: { story: Story; saidaLabel: string; modo: 'favor' | 'contra' }) {
  const soMiudas = story.series.every((s) => s.metrica !== 'resultado' && s.jogos.length <= 2);
  return (
    <div className="px-4 pb-4 pt-3.5" style={{ borderTop: '1px solid #f1e9d6' }}>
      {story.consolidado && (
        <div className="mb-4">
          <Consolidado c={story.consolidado} saidaLabel={saidaLabel} modo={modo} />
        </div>
      )}

      {story.series[0].metrica === 'resultado' ? (
        <div className="flex flex-col gap-4">
          {story.series.map((s) => (
            <div key={s.chave}>
              <div className="flex items-center gap-1.5 mb-2">
                <Crest name={s.teamName} id={s.teamId} size={16} />
                <span className="text-[12px] font-semibold text-ink">{s.titulo}</span>
                <span className="text-[10.5px] ml-auto" style={{ color: '#8d8672' }}>{s.sub}</span>
              </div>
              <SerieResultados s={s} />
            </div>
          ))}
        </div>
      ) : soMiudas ? (
        <div className="flex flex-col gap-4">
          {story.series.map((s) => (
            <div key={s.chave}>
              <div className="flex items-center gap-1.5 mb-2">
                <Crest name={s.teamName} id={s.teamId} size={16} />
                <span className="text-[12px] font-semibold text-ink">{s.titulo}</span>
                <span className="text-[10.5px] ml-auto" style={{ color: '#8d8672' }}>{s.sub}</span>
              </div>
              <SerieMiuda s={s} />
            </div>
          ))}
        </div>
      ) : (
        <GraficoUnificado story={story} />
      )}

      <div className="text-[11px] leading-relaxed mt-3" style={{ color: '#8d8672' }}>
        {soMiudas ? 'Amostra curta na competição: em vez de gráfico, o valor de cada jogo.' : story.comoLer}
      </div>
    </div>
  );
}

/**
 * A premissa como LINHA: peso à esquerda, nome no meio, "ver os jogos" e a seta à
 * direita. A barra inteira é clicável e o gráfico abre embaixo, na mesma linha.
 */
function LinhaPremissa({
  p,
  modo,
  lado,
  ev,
  story,
  aberta,
  onAlternar,
  saidaLabel,
}: {
  p: Premissa;
  modo: 'favor' | 'contra';
  lado: 'home' | 'away' | null;
  ev: Evidencia | null;
  story: Story | null;
  aberta: boolean;
  onAlternar: () => void;
  saidaLabel: string;
}) {
  const forte = pesoForte(p);
  const podeAbrir = story != null;
  return (
    <div
      className="rounded-[14px] overflow-hidden bg-white"
      style={{ border: `1px solid ${aberta ? '#0a3d2e' : '#ded2b6'}` }}
    >
      <button
        type="button"
        onClick={podeAbrir ? onAlternar : undefined}
        className="w-full flex items-center gap-3 px-4 py-3 text-left border-0"
        style={{
          background: aberta ? '#0a3d2e' : '#f4eddc',
          borderBottom: `1px solid ${aberta ? '#0a3d2e' : '#ded2b6'}`,
          cursor: podeAbrir ? 'pointer' : 'default',
        }}
      >
        {modo === 'contra' && (
          <X className="w-3.5 h-3.5 shrink-0" style={{ color: aberta ? '#fbbf24' : '#c58b96' }} strokeWidth={3} />
        )}
        <span
          className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-[5px] text-[9.5px] font-bold uppercase tracking-[0.08em]"
          style={
            aberta
              ? { background: 'rgba(251,191,36,.18)', color: '#fbbf24' }
              : forte
                ? { background: '#dcefe2', color: '#0a3d2e' }
                : { background: '#eae2cf', color: '#8d8672' }
          }
        >
          {pesoPalavra(p)}
        </span>
        <span className="flex-1 min-w-0 text-[13.5px] font-semibold" style={{ color: aberta ? '#fff' : '#1a1d1a' }}>
          {rotuloPremissa(p, lado, modo === 'contra')}
        </span>
        {podeAbrir ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: aberta ? '#fbbf24' : '#0a3d2e' }}>
            {aberta ? 'fechar' : 'ver os jogos'}
            <ChevronRight className="w-3.5 h-3.5 transition-transform" style={{ transform: `rotate(${aberta ? 90 : 0}deg)` }} />
          </span>
        ) : (
          <span className="shrink-0 text-[11px]" style={{ color: aberta ? 'rgba(255,255,255,.5)' : '#8d8672' }}>
            sem jogo a jogo
          </span>
        )}
      </button>

      {ev && (
        <div className="px-4 py-3 text-[12.5px] leading-relaxed" style={{ color: '#5a625a' }}>
          {ev.texto}
        </div>
      )}

      {aberta && story && <PainelPremissa story={story} saidaLabel={saidaLabel} modo={modo} />}
    </div>
  );
}

export function MotivosJogoPorJogo({
  premissas,
  modo,
  extras,
  historico,
  numeros,
  lado,
  linha,
  saidaLabel,
}: {
  premissas: Premissa[];
  modo: 'favor' | 'contra';
  /** Componentes que o backend já descreveu e não têm drilldown jogo a jogo. */
  extras?: { t: string; sub?: string; pontos?: number }[];
  historico: FutebolFixtureHistorico[] | undefined;
  numeros: FutebolFixtureNumeros[] | undefined;
  lado: 'home' | 'away' | null;
  linha: number | null;
  /** A saída analisada, para o fechamento dizer a favor de quê. */
  saidaLabel: string;
}) {
  const acesa = modo === 'favor';
  const itens = useMemo(
    () =>
      premissas.map((p) => ({
        p,
        ev: evidenciaDe(p.slug, numeros, lado, acesa, linha) ?? evidenciaDoHistorico(p.slug, historico, lado, linha),
        story: storyDaPremissa(p.slug, historico, lado, linha),
      })),
    [premissas, numeros, historico, lado, linha, acesa],
  );

  // Abre a primeira que tem gráfico: chegar numa lista toda fechada esconde o que a
  // aba veio mostrar.
  const primeira = itens.find((x) => x.story != null)?.p.slug ?? null;
  const [aberta, setAberta] = useState<string | null>(primeira);
  const chave = itens.map((x) => x.p.slug).join('|');
  useEffect(() => setAberta(primeira), [chave, primeira]);

  const total = itens.length + (extras?.length ?? 0);
  const blocosOrdenados = useMemo(
    () => [
      ...itens.map((item) => ({ tipo: 'premissa' as const, peso: item.p.peso ?? 0, item })),
      ...(extras ?? []).map((extra) => ({ tipo: 'extra' as const, peso: extra.pontos ?? 0, extra })),
    ].sort((a, b) => b.peso - a.peso),
    [itens, extras],
  );

  if (!historico) {
    return <div className="p-6 md:p-8 text-[13px]" style={{ color: '#8d8672' }}>Carregando os jogos anteriores.</div>;
  }

  return (
    <div className="p-5 md:p-7">
      <div className="flex items-center justify-between gap-4 mb-3.5 flex-wrap">
        <div className="text-[12.5px]" style={{ color: '#8d8672' }}>
          {modo === 'favor'
            ? total > 0
              ? `${total} ${total === 1 ? 'motivo sustenta' : 'motivos sustentam'} ${saidaLabel.toLowerCase()}. Clique numa premissa para ver os jogos que produziram o número.`
              : 'Nenhum motivo a favor desta saída.'
            : total > 0
              ? 'O que o jogo e o preço colocam contra esta saída.'
              : 'Nada pesando contra esta saída: todas as premissas que valem aconteceram.'}
        </div>
        {itens.some((x) => x.story != null) && (
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR_FAVOR }} />
              <span className="text-[10.5px]" style={{ color: '#5a625a' }}>o lado que a premissa quer</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR_CONTRA }} />
              <span className="text-[10.5px]" style={{ color: '#8d8672' }}>o lado contrário</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {blocosOrdenados.map((bloco) => {
          if (bloco.tipo === 'extra') {
            const c = bloco.extra;
            return (
            <div
              key={`extra-${c.t}`}
              className="flex gap-3 items-start p-4 rounded-[14px]"
              style={{ border: '1px solid #ded2b6', background: '#fdfbf6' }}
            >
              <span
                className="shrink-0 w-[22px] h-[22px] rounded-md grid place-items-center text-[13px] font-bold"
                style={modo === 'favor'
                  ? { background: '#e7f1e9', color: '#0a6549' }
                  : { background: '#fdf3d9', color: '#b8870f' }}
              >
                {modo === 'favor' ? '+' : '−'}
              </span>
              <div>
                <div className="text-[13px] font-semibold leading-snug text-ink">{c.t}</div>
                {c.sub && <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: '#8d8672' }}>{c.sub}</div>}
              </div>
            </div>
            );
          }

          const { p, ev, story } = bloco.item;
          return (
            <LinhaPremissa
              key={p.slug}
              p={p}
              modo={modo}
              lado={lado}
              ev={ev}
              story={story}
              aberta={aberta === p.slug}
              onAlternar={() => setAberta(aberta === p.slug ? null : p.slug)}
              saidaLabel={saidaLabel}
            />
          );
        })}
      </div>

      {itens.some((x) => x.story == null) && (
        <div className="text-[11.5px] leading-relaxed mt-4 pt-4" style={{ borderTop: '1px solid #f1e9d6', color: '#8d8672' }}>
          Sem jogo a jogo:{' '}
          {itens
            .filter((x) => x.story == null)
            .map((x) => rotuloPremissa(x.p, lado, modo === 'contra').toLowerCase())
            .join('; ')}
          . Aqui o sinal não vem de gol marcado ou sofrido, vem da tabela, do histórico entre os dois ou da escalação.
        </div>
      )}
    </div>
  );
}
