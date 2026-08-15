import { useMemo, useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Blur } from '@/components/futebol/FutebolGate';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import {
  useFutebolFixturePremissas,
  useFutebolFixtureNumeros,
  useFutebolFixtureHistorico,
  useFutebolFixtureInjuries,
} from '@/hooks/use-futebol-data';
import type { FutebolFixturePremissas, FutebolFixtureValueRow } from '@/services/futebol-data.service';
import {
  MERCADOS,
  PORTA_PREMISSAS,
  PREMISSAS_OCULTAS,
  contaQueValem,
  contextoDoMercado,
  melhorCandidato,
  outcomeLabel,
  pesoForte,
  premissaDe,
  premissasDaSaida,
  type MercadoInfo,
  type Premissa,
} from '@/utils/futebol-premissas';
import { evidenciaDe, ladoDaSaida } from '@/utils/futebol-evidencias';
import { evidenciaDoHistorico } from '@/utils/futebol-historico';
import { MotivosJogoPorJogo } from './MotivosJogoPorJogo';
import { valueDoCandidato, resumoDosMercados, REGUA_SCORE } from '@/utils/futebol-leitura';
import { settleFutebol, resultBadge, isHit, type BetResult } from '@/utils/futebol-settlement';
import { isFinished } from '@/utils/futebol-datas';
import type { MatchupTendencies } from '@/utils/futebol-tendencias';
import type { JogoInfo } from './JogoResumo';

/**
 * Aba MERCADOS — a "bancada" do Protótipo 1b: um mercado por vez, com a régua de
 * linhas (gols e handicap) ou as saídas (1X2, ambos marcam, dupla chance), os dois
 * lados comparados, o veredito em uma frase, e as premissas com peso em PALAVRA.
 *
 * As apagadas vêm em três grupos que nunca se misturam (a distinção é do
 * protótipo, e é a mais honesta que já tivemos aqui):
 *   · não aconteceu neste jogo        (peso > 0, só não bateu)
 *   · não conta neste mercado         (peso 0 — o preço já cobra)
 *   · não avaliada                    (mercado sem calibragem: BTTS e dupla chance)
 *
 * Score/odd/chance/edge são REAIS (get_futebol_fixture_value) e só existem com
 * odds coletadas. Sem odds, a bancada vive das premissas e diz "sem preço ainda".
 */

const TIPO_LINHA = new Set(['goals_over_under', 'asian_handicap']);

/** Linha em pt-BR. Sinal só no handicap: "+2,5 gols" não existe. */
function fmtLinha(v: number, comSinal: boolean): string {
  return `${comSinal && v > 0 ? '+' : ''}${String(v).replace('.', ',')}`;
}

/**
 * A régua de linhas: arrastar a bolinha, clicar na trilha ou usar as setas.
 *
 * Era uma fileira de pills com as 5 linhas mais centrais, e o mart cota 21 no
 * mercado de gols e 19 no handicap: as outras 16 simplesmente não existiam na tela.
 * As paradas ficam em intervalos iguais (não proporcionais ao valor), porque o que
 * se escolhe aqui é uma cotação da lista, não uma posição numa reta contínua.
 */
function ReguaLinhas({
  paradas,
  valor,
  onEscolher,
  rotulo,
  destaque,
  forca,
}: {
  paradas: number[];
  valor: number | null;
  onEscolher: (v: number) => void;
  rotulo: (v: number) => string;
  /** A linha da melhor leitura, marcada em âmbar. */
  destaque: number | null;
  /**
   * Quantas premissas sustentam cada linha, no lado escolhido. A parada mostrava a
   * liquidação (verde/rosa) do jogo encerrado, e isso não tinha relação nenhuma com
   * a força da leitura naquela linha, que é o que a régua deveria dizer.
   */
  forca: Map<number, number>;
}) {
  const trilha = useRef<HTMLDivElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const i = valor != null ? paradas.findIndex((p) => Math.abs(p - valor) < 0.001) : -1;
  const idx = i < 0 ? 0 : i;
  const pos = paradas.length > 1 ? (idx / (paradas.length - 1)) * 100 : 0;

  const escolherPorX = (clientX: number) => {
    const el = trilha.current;
    if (!el || paradas.length < 2) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onEscolher(paradas[Math.round(t * (paradas.length - 1))]);
  };

  return (
    <div className="flex-1 min-w-[220px]">
      <div
        ref={trilha}
        role="slider"
        tabIndex={0}
        aria-label="Linha"
        aria-valuemin={paradas[0]}
        aria-valuemax={paradas[paradas.length - 1]}
        aria-valuenow={valor ?? undefined}
        aria-valuetext={valor != null ? rotulo(valor) : undefined}
        className="relative h-8 cursor-pointer select-none touch-none"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setArrastando(true);
          escolherPorX(e.clientX);
        }}
        onPointerMove={(e) => arrastando && escolherPorX(e.clientX)}
        onPointerUp={() => setArrastando(false)}
        onPointerCancel={() => setArrastando(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onEscolher(paradas[Math.max(0, idx - 1)]);
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onEscolher(paradas[Math.min(paradas.length - 1, idx + 1)]);
          }
        }}
      >
        <div className="absolute left-0 right-0 top-[13px] h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,.14)' }} />
        <div className="absolute left-0 top-[13px] h-1.5 rounded-full" style={{ width: `${pos}%`, background: '#fbbf24' }} />

        {paradas.map((p, k) => {
          const left = `${(k / (paradas.length - 1)) * 100}%`;
          const n = forca.get(p) ?? 0;
          const ehDestaque = destaque != null && Math.abs(p - destaque) < 0.001;
          // Ponto maior e mais claro onde a linha tem mais premissas a favor; âmbar
          // na linha da melhor leitura.
          const tam = n >= PORTA_PREMISSAS ? 6 : n > 0 ? 4 : 3;
          return (
            <span
              key={p}
              className="absolute rounded-full pointer-events-none"
              title={`${rotulo(p)} · ${n} ${n === 1 ? 'premissa' : 'premissas'} a favor`}
              style={{
                left,
                top: 16 - (tam - 3) / 2,
                width: tam,
                height: tam,
                transform: 'translateX(-50%)',
                background: ehDestaque ? '#fbbf24' : `rgba(255,255,255,${n >= PORTA_PREMISSAS ? 0.85 : n > 0 ? 0.5 : 0.28})`,
              }}
            />
          );
        })}

        <span
          className="absolute top-[7px] w-[18px] h-[18px] rounded-full pointer-events-none"
          style={{
            left: `${pos}%`,
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '3px solid #fbbf24',
            boxShadow: '0 2px 8px rgba(0,0,0,.35)',
          }}
        />
      </div>
      <div className="flex justify-between text-[9.5px] tabular-nums" style={{ color: 'rgba(255,255,255,.4)' }}>
        <span>{rotulo(paradas[0])}</span>
        <span>{rotulo(paradas[paradas.length - 1])}</span>
      </div>
    </div>
  );
}

function SeloRes({ r }: { r: BetResult }) {
  const b = resultBadge(r);
  const c =
    b.tone === 'won'
      ? { bg: '#dcefe2', fg: '#0a3d2e', dot: '#2f7d50' }
      : b.tone === 'push'
        ? { bg: '#eef0eb', fg: '#5a625a', dot: '#8a8f86' }
        : { bg: '#fbe3e8', fg: '#be123c', dot: '#be123c' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[10.5px] font-bold tracking-[0.06em]"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {b.label}
    </span>
  );
}

export function BancadaMercados({
  jogo,
  valueRows,
  tendencies,
  locked,
  mercadoAtivo,
  onMercado,
}: {
  jogo: JogoInfo;
  valueRows: FutebolFixtureValueRow[] | null | undefined;
  tendencies?: MatchupTendencies | null;
  locked: boolean;
  mercadoAtivo: string;
  onMercado: (slug: string) => void;
}) {
  const { data: rows, isLoading } = useFutebolFixturePremissas(jogo.fixtureId);
  const { data: numeros } = useFutebolFixtureNumeros(jogo.fixtureId);
  const { data: historico } = useFutebolFixtureHistorico(jogo.fixtureId);
  const { data: injuries } = useFutebolFixtureInjuries(jogo.fixtureId);

  const fim = isFinished(jogo.statusShort);
  const placar = fim ? { home: jogo.goalsHome, away: jogo.goalsAway } : null;
  const mercado: MercadoInfo = MERCADOS.find((m) => m.slug === mercadoAtivo) ?? MERCADOS[0];
  const ehLinha = TIPO_LINHA.has(mercado.slug);
  const ehAH = mercado.slug === 'asian_handicap';

  const resumos = useMemo(() => resumoDosMercados(rows, valueRows), [rows, valueRows]);

  const doMercado = useMemo(
    () => (rows ?? []).filter((r) => r.market === mercado.slug).filter((r) => !(mercado.slug === 'asian_handicap' && r.line_value === 0)),
    [rows, mercado.slug],
  );

  const melhor = useMemo(() => melhorCandidato(rows ?? [], mercado.slug), [rows, mercado.slug]);

  // TODAS as linhas cotadas do mercado, em ordem. Com pills a tela mostrava as 5
  // mais centrais e as outras 16 não existiam; na régua arrastável cabem todas.
  const paradas = useMemo(() => {
    if (!ehLinha) return [] as number[];
    return [...new Set(doMercado.map((r) => r.line_value).filter((v): v is number => v != null))].sort((a, b) => a - b);
  }, [doMercado, ehLinha]);

  const [linha, setLinha] = useState<number | null>(null);
  const [saida, setSaida] = useState<string | null>(null);
  useEffect(() => {
    setLinha(melhor?.line_value != null && paradas.includes(melhor.line_value) ? melhor.line_value : paradas[Math.floor(paradas.length / 2)] ?? null);
    setSaida(melhor?.outcome ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercado.slug, rows]);

  // Os lados da parada atual.
  const [ladoA, ladoB] = useMemo((): [FutebolFixturePremissas | null, FutebolFixturePremissas | null] => {
    if (ehLinha) {
      const [oa, ob] = mercado.slug === 'goals_over_under' ? ['Under', 'Over'] : ['Home', 'Away'];
      const at = (o: string) => doMercado.find((r) => r.outcome === o && r.line_value != null && Math.abs((r.line_value ?? 0) - (linha ?? NaN)) < 0.001) ?? null;
      return [at(oa), at(ob)];
    }
    const sel = doMercado.find((r) => r.outcome === saida) ?? melhor;
    return [sel ?? null, null];
  }, [ehLinha, doMercado, linha, saida, melhor, mercado.slug]);

  // Principal = o lado analisado. Começa no que tem mais contexto e o usuário troca
  // clicando no outro card: é assim que ele vê as premissas do outro lado, em vez de
  // uma lista de espelhos ("defesas frágeis" contra "defesas firmes") que se
  // contradiziam na mesma tela.
  const nA = ladoA ? contaQueValem(mercado.slug, ladoA.acesas) : 0;
  const nB = ladoB ? contaQueValem(mercado.slug, ladoB.acesas) : 0;
  const [ladoSel, setLadoSel] = useState<'a' | 'b' | null>(null);
  useEffect(() => setLadoSel(null), [mercado.slug, linha, saida]);
  // Sub-abas da folha: a favor e contra, as duas jogo a jogo (é onde mora a auditoria).
  const [abaMotivo, setAbaMotivo] = useState<'favor' | 'contra'>('favor');
  const principal = ladoSel === 'a' ? ladoA : ladoSel === 'b' ? ladoB : ladoB && nB > nA ? ladoB : ladoA;

  const valA = ladoA ? valueDoCandidato(valueRows, mercado.slug, ladoA.outcome, ladoA.line_value) : null;
  const valB = ladoB ? valueDoCandidato(valueRows, mercado.slug, ladoB.outcome, ladoB.line_value) : null;
  const valPrincipal = principal === ladoB ? valB : valA;


  const labelDe = (c: FutebolFixturePremissas | null) =>
    c ? outcomeLabel(mercado.slug, c.outcome, jogo.home, jogo.away, c.line_value) : '';

  // Favor / apagadas do lado principal. Só as premissas DAQUELE lado: as do outro
  // medem o mesmo número ao contrário ("defesas frágeis" × "defesas firmes"), então
  // listá-las aqui como "não aconteceu" fazia a tela se contradizer.
  const visiveis = principal
    ? premissasDaSaida(mercado, principal.outcome, principal.line_value, principal.acesas)
    : mercado.premissas.filter((p) => !PREMISSAS_OCULTAS.has(p.slug));
  const acesasSet = new Set(principal?.acesas ?? []);
  const favor = visiveis.filter((p) => acesasSet.has(p.slug)).sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0));
  const apagadas = visiveis.filter((p) => !acesasSet.has(p.slug)).sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0));
  const penAtivas = (principal?.penalidades ?? [])
    .filter((s) => !PREMISSAS_OCULTAS.has(s))
    .map((s) => premissaDe(mercado.slug, s))
    .filter((p): p is Premissa => p != null);

  const semCalibragem = mercado.teto == null;
  const ctx = contextoDoMercado(favor.filter(pesoForte).length, semCalibragem);

  const ladoPrincipal = principal ? ladoDaSaida(mercado.slug, principal.outcome) : null;
  const nPrincipal = principal ? contaQueValem(mercado.slug, principal.acesas) : 0;
  const ate = numeros?.[0]?.ate ?? null;

  // "Como chegam": as barras espelhadas casa × fora, agora dentro da coluna dos
  // mercados. A barra da posição usa o valor do OUTRO lado, porque na tabela menor
  // é melhor.
  const barras = useMemo(() => {
    const casa = numeros?.find((x) => x.side === 'home');
    const fora = numeros?.find((x) => x.side === 'away');
    if (!casa || !fora) return [];
    const d1 = (v: number) => v.toFixed(1).replace('.', ',');
    const linhas: { l: string; a: string; b: string; va: number; vb: number }[] = [];
    if (casa.gf_total != null && fora.gf_total != null)
      linhas.push({ l: 'Gols marcados', a: d1(casa.gf_total), b: d1(fora.gf_total), va: casa.gf_total, vb: fora.gf_total });
    if (casa.ga_total != null && fora.ga_total != null)
      linhas.push({ l: 'Gols sofridos', a: d1(casa.ga_total), b: d1(fora.ga_total), va: fora.ga_total, vb: casa.ga_total });
    if (casa.posicao != null && fora.posicao != null)
      linhas.push({ l: 'Posição', a: `${casa.posicao}º`, b: `${fora.posicao}º`, va: fora.posicao, vb: casa.posicao });
    if (casa.clean_sheets != null && fora.clean_sheets != null)
      linhas.push({ l: 'Sem sofrer gol', a: String(casa.clean_sheets), b: String(fora.clean_sheets), va: casa.clean_sheets, vb: fora.clean_sheets });
    return linhas.map((x) => {
      const tot = x.va + x.vb || 1;
      return { ...x, wa: `${Math.round((x.va / tot) * 100)}%`, wb: `${Math.round((x.vb / tot) * 100)}%` };
    });
  }, [numeros]);

  // O número da premissa: temporada (094) e, para o que ela não cobre, calculado dos
  // jogos do histórico (095) — é o que dá número às premissas de chance de gol.
  const evDe = (slug: string, acesa = true) =>
    evidenciaDe(slug, numeros, ladoPrincipal, acesa, linha) ??
    evidenciaDoHistorico(slug, historico, ladoPrincipal, linha);

  // Só o que não aconteceu E conta para o Score. Premissa apagada de peso 0 sai da
  // tela: ela não aconteceu e nem contaria, então nomeá-la só criava dúvida sobre
  // ser verdade ou não.
  const naoAconteceu = apagadas.filter((p) => p.peso == null || p.peso > 0);

  // Premissa acesa que não soma no Score E não tem número também sai: era a linha
  // "jogo de ritmo alto · não conta · sem número para conferir", que só levantava a
  // pergunta "de onde veio isso?" sem ter resposta na tela. O critério mora nos
  // modelos dbt, não aqui.
  const favorVisivel = favor.filter((p) => p.peso !== 0 || evDe(p.slug) != null);

  // Contras: os do backend (quando há preço) + penalidades ativas.
  //
  // A penalidade de desfalque aparecia como título solto, sem dizer QUEM está fora.
  // Aqui ela puxa a lista de desfalques do lado certo; quando a lista ainda não
  // saiu, a tela diz isso em vez de deixar a linha muda.
  const contras = useMemo(() => {
    const out: { t: string; sub?: string }[] = [];
    (valPrincipal?.contras ?? []).forEach((t) => out.push({ t }));
    (valPrincipal?.avisos ?? []).forEach((t) => out.push({ t }));

    const idDoLado = ladoPrincipal === 'away' ? jogo.awayId : jogo.homeId;
    const idDoAdv = ladoPrincipal === 'away' ? jogo.homeId : jogo.awayId;
    const nomes = (teamId: number | undefined) =>
      (injuries ?? [])
        .filter((i) => teamId != null && i.team_id === teamId)
        .slice(0, 4)
        .map((i) => i.player_name)
        .join(', ');

    penAtivas.forEach((p) => {
      let sub = p.motivo;
      if (p.slug === 'desfalque_proprio' || p.slug === 'desfalque_adversario') {
        const lista = nomes(p.slug === 'desfalque_proprio' ? idDoLado : idDoAdv);
        sub = lista
          ? `Fora: ${lista}.`
          // Não existe "escalação provável": a fonte não publica previsão de
          // escalação em momento nenhum. O que sai perto do jogo é a escalação
          // CONFIRMADA. Ver futebol-escalacao.ts.
          : 'A lista de desfalques deste jogo ainda não saiu: ela entra junto com a escalação confirmada, perto do jogo.';
      }
      out.push({ t: `Penalidade: ${p.label.toLowerCase()}`, sub });
    });
    return out;
  }, [valPrincipal, penAtivas, injuries, ladoPrincipal, jogo.homeId, jogo.awayId]);

  // O veredito em uma frase, sem inventar número.
  const veredito = useMemo(() => {
    const lbl = labelDe(principal);
    if (fim) {
      const r = placar && principal ? settleFutebol(mercado.slug, principal.outcome, principal.line_value, placar.home, placar.away) : null;
      return r ? `O mapa apontava ${lbl}: ${resultBadge(r).label.toLowerCase()}.` : `Jogo encerrado.`;
    }
    if (valPrincipal) {
      if (valPrincipal.score >= 60) return `O jogo e o preço concordam: ${lbl} é onde este jogo paga.`;
      if (valPrincipal.score >= REGUA_SCORE) return `${lbl} passa a régua, em faixa média: leitura razoável e algum valor.`;
      return `Abaixo da régua de ${REGUA_SCORE}: ${lbl} entra como consulta, não como aposta.`;
    }
    const n = principal ? contaQueValem(mercado.slug, principal.acesas) : 0;
    if (n >= PORTA_PREMISSAS) return `O jogo aponta para ${lbl}, mas falta o preço: as odds entram perto do jogo.`;
    return `O jogo não sustenta esta saída.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, valPrincipal, fim, mercado.slug, placar]);

  // Distribuição de gols: só no mercado de gols, cortada pela linha selecionada.
  const dist = useMemo(() => {
    if (mercado.slug !== 'goals_over_under' || !tendencies?.lambdas || linha == null) return null;
    const lambda = tendencies.lambdas.lh + tendencies.lambdas.la;
    const fact = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
    const pois = (k: number) => (Math.exp(-lambda) * Math.pow(lambda, k)) / fact(k);
    const bars = [0, 1, 2, 3].map((k) => ({ k: String(k), kn: k, p: pois(k) }));
    bars.push({ k: '4+', kn: 4, p: Math.max(0, 1 - bars.reduce((s, b) => s + b.p, 0)) });
    const max = Math.max(...bars.map((b) => b.p), 0.001);
    return {
      bars: bars.map((b) => ({ ...b, h: `${(b.p / max) * 100}%`, pct: `${Math.round(b.p * 100)}%`, menos: b.kn < linha })),
      divisor: `${((Math.floor(linha) + 1) / bars.length) * 100}%`,
      lambda: lambda.toFixed(1).replace('.', ','),
    };
  }, [mercado.slug, tendencies, linha]);

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16 w-full bg-canvas-2 rounded-rebrand-md" />
        <Skeleton className="h-96 w-full rounded-[24px]" style={{ background: 'var(--canvas-2)' }} />
      </div>
    );
  }

  const pickAtual = labelDe(principal);

  /**
   * Quantas premissas sustentam cada linha, no lado escolhido. É o que a régua
   * mostra nas paradas: onde a leitura se sustenta e onde ela some.
   */
  const forcaPorLinha = new Map<number, number>();
  if (ehLinha && principal) {
    paradas.forEach((p) => {
      const r = doMercado.find(
        (x) => x.outcome === principal.outcome && x.line_value != null && Math.abs(x.line_value - p) < 0.001,
      );
      forcaPorLinha.set(p, r ? contaQueValem(mercado.slug, r.acesas) : 0);
    });
  }

  /** As saídas fixas do 1X2, ambos marcam e dupla chance (mercado sem régua). */
  const paradasUI = ehLinha
    ? []
    : doMercado.map((o) => {
        const val = valueDoCandidato(valueRows, mercado.slug, o.outcome, o.line_value);
        const n = contaQueValem(mercado.slug, o.acesas);
        return {
          chave: o.outcome,
          rotulo: outcomeLabel(mercado.slug, o.outcome, jogo.home, jogo.away, o.line_value),
          ativa: o.outcome === (saida ?? melhor?.outcome),
          passa: val ? val.score >= REGUA_SCORE : n >= PORTA_PREMISSAS,
          res: placar ? settleFutebol(mercado.slug, o.outcome, o.line_value, placar.home, placar.away) : null,
          escolher: () => setSaida(o.outcome),
        };
      });

  const resPrincipal =
    placar && principal
      ? settleFutebol(mercado.slug, principal.outcome, principal.line_value, placar.home, placar.away)
      : null;

  return (
    <div
      className="grid xl:grid-cols-[300px_1fr] xl:grid-rows-[auto_1fr] bg-white rounded-[24px] overflow-hidden"
      style={{ border: '1px solid #ded2b6' }}
      data-tour="fut-jogo-mapa"
    >
      {/* A coluna dos 5 mercados fica FIXA: clicar em qualquer um troca a folha da
          direita sem sair da página. Antes eram abas no topo, e a comparação entre
          mercados sumia assim que você entrava em um.
          No desktop, mercados e contexto ocupam a coluna da esquerda (linhas 1 e 2)
          e a folha ocupa a direita inteira; no celular a ordem do DOM manda, e é
          por isso que o contexto vem DEPOIS da folha: "como chegam" antes da
          análise empurrava o mercado duas telas para baixo. */}
      <div data-tour="fut-jogo-mercados" className="min-w-0 xl:col-start-1 xl:row-start-1 xl:border-r" style={{ borderColor: '#ded2b6', background: '#fdfbf6' }}>
        <div className="px-5 pt-4 pb-3.5" style={{ borderBottom: '1px solid #f1e9d6' }}>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: '#8d8672' }}>
            Os 5 mercados
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed" style={{ color: '#6b6350' }}>
            {resumos.some((r) => r.value)
              ? `${resumos.filter((r) => r.passa).length} de ${resumos.length} passam a régua de ${REGUA_SCORE}. A barra é o Score; o tracinho é a régua.`
              : `Sem preço ainda: a barra conta as premissas e o tracinho é a porta de ${PORTA_PREMISSAS}.`}
          </div>
        </div>

        {/* No mobile os 5 mercados rolam na horizontal: empilhados, empurravam a
            folha do mercado cinco cards para baixo. */}
        <div className="p-3.5 flex gap-1.5 overflow-x-auto no-scrollbar xl:flex-col xl:overflow-visible">
          {resumos.map((r) => {
            const on = r.mercado.slug === mercado.slug;
            const temScore = r.value != null;
            const s = temScore ? r.value!.score : r.nValem;
            const larg = temScore ? `${s}%` : `${Math.min(100, (r.nValem / Math.max(r.totalQueValem, 1)) * 100)}%`;
            const regua = temScore ? `${REGUA_SCORE}%` : `${(PORTA_PREMISSAS / Math.max(r.totalQueValem, 1)) * 100}%`;
            const cor = on ? '#fbbf24' : r.passa ? (temScore && s >= 60 ? '#0a3d2e' : '#d4a017') : '#c4bda8';
            const pick = outcomeLabel(r.mercado.slug, r.candidato.outcome, jogo.home, jogo.away, r.candidato.line_value);
            return (
              <button
                key={r.mercado.slug}
                onClick={() => onMercado(r.mercado.slug)}
                className="text-left w-[210px] shrink-0 xl:w-full p-3.5 rounded-[14px] cursor-pointer transition"
                style={{
                  background: on ? '#0a3d2e' : r.passa ? '#fff' : '#fdfbf6',
                  border: `1px ${r.passa || on ? 'solid' : 'dashed'} ${on ? '#0a3d2e' : r.passa ? '#ded2b6' : '#e5d9bd'}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-[13px] truncate"
                    style={{ color: on ? '#fff' : r.passa ? '#1a1d1a' : '#6b6350', fontWeight: r.passa ? 600 : 500 }}
                  >
                    {r.mercado.label}
                  </span>
                  <span
                    className="tabular-nums text-[18px] font-bold shrink-0"
                    style={{ color: on ? '#fbbf24' : r.passa ? (temScore && s >= 60 ? '#0a3d2e' : '#b8870f') : '#8d8672' }}
                  >
                    <Blur active={locked && temScore}>{String(s)}</Blur>
                  </span>
                </div>
                <div className="mt-1 text-[11.5px] truncate" style={{ color: on ? 'rgba(255,255,255,.6)' : '#8d8672' }}>
                  {pick}
                  {temScore ? (
                    <>
                      {' · '}
                      <Blur active={locked}>{`${Math.round(r.value!.prob_justa_fechamento * 100)}%`}</Blur>
                      {' · '}
                      <Blur active={locked}>{r.value!.best_odd.toFixed(2)}</Blur>
                    </>
                  ) : (
                    ' · sem preço'
                  )}
                </div>
                <div
                  className="relative mt-2.5 h-1.5 rounded-full"
                  style={{ background: on ? 'rgba(255,255,255,.16)' : '#f1e9d6' }}
                >
                  <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: larg, background: cor }} />
                  <div
                    className="absolute -top-[3px] -bottom-[3px] w-0"
                    style={{ left: regua, borderLeft: `1px dashed ${on ? 'rgba(255,255,255,.6)' : '#8d8672'}` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* A folha do mercado aberto. */}
      <div data-tour="fut-jogo-folha" className="min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-2">
        <div className="relative overflow-hidden px-6 md:px-8 py-6" style={{ background: 'linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)' }}>
          <div
            className="absolute pointer-events-none"
            style={{ right: -40, top: -90, width: 300, height: 300, borderRadius: 999, background: 'radial-gradient(circle,rgba(251,191,36,.24),transparent 68%)' }}
          />
          {/* Arrastar a régua troca pick, selo e veredito ao mesmo tempo. Sem altura
              reservada, o bloco inteiro saltava a cada parada: o selo Green/Red
              empurrava o título, e o veredito ia de uma para duas linhas. O selo
              subiu para a linha do rótulo, que tem altura fixa, e o pick e o
              veredito ganharam altura mínima. */}
          <div className="relative flex items-end justify-between gap-7 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 h-6">
                <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,.45)' }}>
                  Mercado aberto · {mercado.label}
                </span>
                {resPrincipal && <SeloRes r={resPrincipal} />}
              </div>
              <div className="mt-1.5 text-[28px] md:text-[34px] font-semibold leading-tight tracking-[-0.035em] text-white min-h-[42px] md:min-h-[46px]">
                {pickAtual || '—'}
              </div>
              <div
                className="mt-2 text-[13.5px] leading-relaxed max-w-[560px] min-h-[42px]"
                style={{ color: 'rgba(255,255,255,.78)' }}
              >
                {veredito}
              </div>
            </div>

            {/* Sem `shrink-0`: com quatro colunas fixas, a linha estourava a largura
                no celular e a página inteira ganhava rolagem lateral. */}
            <div className="flex items-end gap-4 md:gap-6 flex-wrap">
              <div className="min-w-[58px]">
                <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Chance</div>
                <div className="tabular-nums text-[22px] font-semibold leading-none mt-1 text-white">
                  {valPrincipal ? <Blur active={locked}>{`${Math.round(valPrincipal.prob_justa_fechamento * 100)}%`}</Blur> : '—'}
                </div>
              </div>
              <div className="min-w-[52px]">
                <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Odd</div>
                <div className="tabular-nums text-[22px] font-semibold leading-none mt-1 text-white">
                  {valPrincipal ? <Blur active={locked}>{valPrincipal.best_odd.toFixed(2)}</Blur> : '—'}
                </div>
              </div>
              <div className="min-w-[76px]">
                <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Vantagem</div>
                <div
                  className="tabular-nums text-[22px] font-semibold leading-none mt-1"
                  style={{ color: valPrincipal && valPrincipal.edge > 0 ? '#8ee6b0' : 'rgba(255,255,255,.55)' }}
                >
                  {valPrincipal ? (
                    <Blur active={locked}>{`${valPrincipal.edge >= 0 ? '+' : '−'}${Math.abs(valPrincipal.edge * 100).toFixed(1).replace('.', ',')}%`}</Blur>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div className="text-center pl-6 min-w-[128px]" style={{ borderLeft: '1px solid rgba(255,255,255,.15)' }}>
                <div className="tabular-nums text-[44px] font-bold leading-none tracking-[-0.04em]" style={{ color: '#fbbf24' }}>
                  {valPrincipal ? <Blur active={locked}>{String(valPrincipal.score)}</Blur> : nPrincipal}
                </div>
                <div className="mt-1.5 text-[9.5px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,.5)' }}>
                  {valPrincipal
                    ? `Score · ${valPrincipal.score >= 60 ? 'faixa alta' : valPrincipal.score >= REGUA_SCORE ? 'faixa média' : 'abaixo da régua'}`
                    : 'premissas a favor'}
                </div>
              </div>
            </div>
          </div>

          {/* A régua de paradas mora no hero: trocar a parada troca o que precisa ser
              verdade, e o Score muda junto. */}
          <div data-tour="fut-jogo-regua" className="relative mt-5 pt-4 flex items-center gap-3.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,.15)' }}>
            <span className="text-[9.5px] uppercase tracking-[0.14em] shrink-0" style={{ color: 'rgba(255,255,255,.45)' }}>
              {ehLinha ? 'Linha' : 'Saída'}
            </span>

            {/* O lado da linha é um toggle, não um link: na régua você escolhe QUAL
                linha, aqui de que lado dela está a aposta. Só existe onde o mercado
                tem dois lados na mesma linha (gols e handicap). */}
            {ehLinha && ladoA && ladoB && (
              <div className="flex p-[3px] rounded-full shrink-0" style={{ background: 'rgba(255,255,255,.08)' }}>
                {([['a', ladoA], ['b', ladoB]] as const).map(([k, l]) => {
                  const on = principal === l;
                  return (
                    <button
                      key={k}
                      onClick={() => setLadoSel(k)}
                      className="h-6 px-3 rounded-full border-0 cursor-pointer truncate max-w-[110px]"
                      style={{
                        background: on ? '#fff' : 'transparent',
                        color: on ? '#0a3d2e' : 'rgba(255,255,255,.72)',
                        font: `${on ? 700 : 500} 11.5px Inter,sans-serif`,
                      }}
                    >
                      {mercado.slug === 'goals_over_under'
                        ? l.outcome === 'Under'
                          ? 'Menos'
                          : 'Mais'
                        : l.outcome === 'Home'
                          ? jogo.home
                          : jogo.away}
                    </button>
                  );
                })}
              </div>
            )}

            {ehLinha && paradas.length > 1 ? (
              <>
                {/* O número antes da trilha: com ele depois, no celular a régua
                    quebrava a linha e o valor ficava sozinho, solto embaixo. */}
                <span className="tabular-nums text-[22px] font-bold leading-none shrink-0 min-w-[58px]" style={{ color: '#fbbf24' }}>
                  {linha != null ? fmtLinha(linha, ehAH) : '—'}
                </span>
                <ReguaLinhas
                  paradas={paradas}
                  valor={linha}
                  onEscolher={setLinha}
                  rotulo={(v) => fmtLinha(v, ehAH)}
                  destaque={melhor?.line_value ?? null}
                  forca={forcaPorLinha}
                />
              </>
            ) : (
              <div className="flex-1 min-w-0 flex gap-1.5 flex-wrap">
                {paradasUI.map((p) => (
                  <button
                    key={p.chave}
                    onClick={p.escolher}
                    className="h-7 px-3 rounded-full inline-flex items-center gap-1.5 cursor-pointer border-0 whitespace-nowrap tabular-nums"
                    style={{
                      background: p.ativa ? '#fbbf24' : 'rgba(255,255,255,.08)',
                      color: p.ativa ? '#1a1d1a' : 'rgba(255,255,255,.72)',
                      font: `${p.ativa ? 700 : 500} 12px Inter,sans-serif`,
                      opacity: p.passa || p.ativa ? 1 : 0.5,
                    }}
                  >
                    {p.rotulo}
                    {p.res && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isHit(p.res) ? '#2f7d50' : p.res === 'push' ? '#8a8f86' : '#be123c' }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            {valPrincipal && !fim && !locked && (
              <RegistrarApostaCTA
                draft={{
                  homeName: jogo.home,
                  awayName: jogo.away,
                  competition: jogo.competition,
                  kickoffUtc: jogo.kickoffUtc,
                  market: valPrincipal.market,
                  outcome: valPrincipal.outcome,
                  lineValue: valPrincipal.line_value,
                  bestOdd: valPrincipal.best_odd,
                }}
                variant="ambar"
                rotulo={`Registrar ${pickAtual}`}
              />
            )}
          </div>
        </div>

        {mercado.aviso && (
          <div className="px-6 md:px-8 py-3 text-[12px] leading-relaxed" style={{ background: '#fef7df', borderBottom: '1px solid #fde68a', color: '#5a3c00' }}>
            {mercado.aviso}
          </div>
        )}

        {/* Sub-abas em forma de pasta: A favor · Contra. */}
        <div data-tour="fut-jogo-premissas" className="px-6 md:px-8 pt-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1e9d6' }}>
          {(
            [
              ['favor', 'A favor', favorVisivel.length],
              ['contra', 'Contra', naoAconteceu.length + contras.length],
            ] as const
          ).map(([k, rot, n]) => {
            const on = abaMotivo === k;
            return (
              <button
                key={k}
                onClick={() => setAbaMotivo(k)}
                className="h-[34px] px-3.5 -mb-px inline-flex items-center gap-1.5 cursor-pointer text-[12.5px] font-semibold"
                style={{
                  borderRadius: '9px 9px 0 0',
                  color: on ? '#0a3d2e' : '#5a625a',
                  background: on ? '#fff' : 'transparent',
                  // Lados separados de propósito: misturar `border` com
                  // `borderBottom` faz o React avisar de conflito de shorthand.
                  borderStyle: 'solid',
                  borderColor: on ? '#ded2b6' : 'transparent',
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderBottomWidth: 0,
                }}
              >
                {rot}
                <span className="tabular-nums text-[11px] font-bold" style={{ color: on ? '#0a3d2e' : '#8d8672' }}>
                  {n}
                </span>
              </button>
            );
          })}
          <span className="ml-auto pb-2 text-[11.5px] hidden md:block" style={{ color: '#8d8672' }}>
            {ctx.label}
          </span>
        </div>

        {abaMotivo === 'favor' ? (
          <MotivosJogoPorJogo
            premissas={favorVisivel}
            modo="favor"
            historico={historico}
            numeros={numeros}
            lado={ladoPrincipal}
            linha={linha}
            saidaLabel={pickAtual}
          />
        ) : (
          <MotivosJogoPorJogo
            premissas={naoAconteceu}
            modo="contra"
            contras={contras}
            historico={historico}
            numeros={numeros}
            lado={ladoPrincipal}
            linha={linha}
            saidaLabel={pickAtual}
          />
        )}

        <div className="px-6 md:px-8 py-3.5 text-[11px] leading-relaxed" style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6', color: '#8d8672' }}>
          {ehLinha
            ? 'Cada parada da régua tem o seu conjunto de premissas: trocar a linha muda o que precisa ser verdade.'
            : 'Cada saída do mercado tem o seu conjunto de premissas.'}{' '}
          {ate ? `Números da temporada até ${ate}.` : ''}
        </div>
      </div>

      {/* Contexto do confronto: no desktop desce na coluna da esquerda, embaixo
          dos mercados; no celular vem DEPOIS da folha, senão "como chegam"
          empurrava a análise duas telas para baixo. */}
      <div className="min-w-0 xl:col-start-1 xl:row-start-2 xl:border-r" style={{ borderColor: '#ded2b6', background: '#fdfbf6' }}>
          {barras.length > 0 && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid #f1e9d6' }}>
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-3" style={{ color: '#8d8672' }}>
                Como chegam
              </div>
              <div className="flex flex-col gap-3.5">
                {barras.map((x) => (
                  <div key={x.l}>
                    <div className="flex justify-between items-baseline mb-1.5 tabular-nums">
                      <span className="text-[13px] font-semibold" style={{ color: '#0a3d2e' }}>{x.a}</span>
                      <span className="text-[10.5px] font-medium" style={{ color: '#8d8672' }}>{x.l}</span>
                      <span className="text-[13px] font-semibold" style={{ color: '#6b6350' }}>{x.b}</span>
                    </div>
                    <div className="flex gap-[3px] h-1.5">
                      <div className="flex-1 flex justify-end overflow-hidden" style={{ background: '#f1e9d6', borderRadius: '999px 0 0 999px' }}>
                        <div style={{ width: x.wa, background: '#0a3d2e' }} />
                      </div>
                      <div className="flex-1 overflow-hidden" style={{ background: '#f1e9d6', borderRadius: '0 999px 999px 0' }}>
                        <div style={{ width: x.wb, height: '100%', background: '#c4bda8' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dist && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid #f1e9d6' }}>
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: '#8d8672' }}>
                Onde a linha corta
              </div>
              <p className="text-[11px] leading-relaxed mt-1 mb-3" style={{ color: '#6b6350' }}>
                Quantos gols o modelo espera, e de que lado da linha cada cenário cai.
              </p>
              <div className="relative pb-1">
                <div className="flex items-end gap-1.5 h-[84px]">
                  {dist.bars.map((b) => (
                    <div key={b.k} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="tabular-nums text-[9.5px] font-semibold mb-1" style={{ color: b.menos ? '#0a3d2e' : '#8d8672' }}>
                        {b.pct}
                      </span>
                      <div className="w-full flex items-end flex-1 min-h-0">
                        <div className="w-full rounded-t" style={{ height: b.h, background: b.menos ? '#0a3d2e' : '#c9cec6' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {dist.bars.map((b) => (
                    <span key={b.k} className="flex-1 text-center tabular-nums text-[10px] font-semibold" style={{ color: b.menos ? '#0a3d2e' : '#8d8672' }}>
                      {b.k}
                    </span>
                  ))}
                </div>
                <div className="absolute -top-1 bottom-4 w-0 opacity-35" style={{ left: dist.divisor, borderLeft: '2px dashed #1a1d1a' }} />
              </div>
              <p className="text-[10.5px] leading-relaxed mt-2" style={{ color: '#8d8672' }}>
                Média esperada de {dist.lambda} gols.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
