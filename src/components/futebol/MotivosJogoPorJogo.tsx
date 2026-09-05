import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { FutebolFixtureHistorico, FutebolFixtureNumeros } from '@/services/futebol-data.service';
import { pesoPalavra, pesoForte, rotuloPremissa, type Premissa } from '@/utils/futebol-premissas';
import { evidenciaDe, type Evidencia } from '@/utils/futebol-evidencias';
import { alinharAbaixoDoCabecalho } from '@/utils/rolagem';
import { EH_BINARIA, evidenciaDoHistorico, storyDaPremissa, type SerieHistorico, type Story } from '@/utils/futebol-historico';
import {
  corteEmPalavras,
  exato,
  faltouParaOCorte,
  fraseDaPrestacao,
  numeroDaPrestacao,
  prestacaoDaPremissa,
  type Prestacao,
} from '@/utils/futebol-criterio';
import { evidenciaDaPremissa } from '@/utils/futebol-evidencia-da-premissa';
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
 *
 * É o `exato` do módulo do critério, com o nome que esta tela usa: eram a mesma
 * função escrita duas vezes.
 */
const fmtLinhaExata = exato;
const dia = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

/** Gol é inteiro, gol esperado é decimal, e métrica binária é sim ou não. */
const rotuloValor = (v: number | null, metrica: SerieHistorico['metrica']) => {
  if (v == null) return '';
  if (EH_BINARIA(metrica)) return v ? 'sim' : 'não';
  return metrica === 'xg' ? d1(v) : String(Math.round(v));
};

/**
 * A média das barras, no rótulo do gráfico.
 *
 * Numa métrica binária a média é a FRAÇÃO de jogos, e escrevê-la como "média 0,4"
 * embaixo de uma premissa que compara 40% contra 40% seria o gráfico falando outra
 * língua que o card (#355).
 */
const rotuloMedia = (v: number, metrica: SerieHistorico['metrica']) =>
  EH_BINARIA(metrica) ? `${Math.round(v * 100)}% dos jogos` : `média ${d1(v)}`;

/**
 * A cor da barra diz o que o jogo significa PARA A SAÍDA ESCOLHIDA, não só "acima ou
 * abaixo da média": num "mais de 2,5" o jogo de 4 gols joga a favor, num "menos de
 * 2,5" o mesmo jogo joga contra. Quem separa os times é a posição (bloco da esquerda
 * e da direita, com o nome em cima), então a cor fica livre para o significado.
 */
/**
 * O sentido em palavra. Os valores do enum são as próprias palavras hoje, e o
 * ternário que os repetia era um no-op — mas renomear o enum mudaria a copy em
 * silêncio, e um mapa é o que separa o tipo do texto.
 */
const LADO_DO_CORTE: Record<Prestacao['sentido'], string> = { acima: 'acima', abaixo: 'abaixo' };

const COR_FAVOR = '#0a3d2e';
const COR_CONTRA = '#c9cec6';

const COR_RES: Record<'V' | 'E' | 'D', { bg: string; fg: string }> = {
  V: { bg: '#dcefe2', fg: '#0a3d2e' },
  E: { bg: '#eef0eb', fg: '#5a625a' },
  D: { bg: '#fbeeec', fg: '#b8341c' },
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
    if (s.metrica === 'sem_sofrer') return v ? 'não sofreu gol' : 'sofreu gol';
    if (s.metrica === 'sem_marcar') return v ? 'não marcou' : 'marcou';
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
        {s.media != null && s.mostraMedia && (
          <>
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed pointer-events-none"
              style={{ borderColor: '#d4a017', bottom: y(s.media) }}
            />
            <span
              className="absolute right-0 tabular-nums text-[9.5px] font-bold px-1 rounded bg-white/90 pointer-events-none"
              style={{ color: '#b8870f', bottom: y(s.media) + 2 }}
            >
              {rotuloMedia(s.media, s.metrica)}
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
      {/* À ESQUERDA, na mesma margem dos gráficos que ela explica — antes ela
          ficava encostada à direita e lia como se pertencesse a outra coisa.
          
          No celular empilha, e os itens alinham pela esquerda: é isso que põe
          as duas bolinhas na mesma coluna. Alinhar pela direita alinharia o fim
          do texto, que tem comprimentos diferentes, e as bolinhas ficariam
          tortas. */}
      <div className="flex flex-col items-start gap-1 mb-3 md:flex-row md:items-center md:gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_FAVOR }} />
          <span className="text-[10.5px] text-ink-2">{quer ? 'acima da média' : 'abaixo da média'}, o lado que a premissa quer</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_CONTRA }} />
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
            : `Fica ${c.direcao === 'maior' ? 'abaixo' : 'acima'} da linha de ${fmtLinhaExata(c.linha)}, e é por isso que esta premissa não atingiu o corte.`}
      </div>
    </div>
  );
}
/**
 * A base de jogos que produziu o número, por time.
 *
 * Sai da prestação e não do gráfico, e existe uma vez só porque as duas formas de
 * card a desenham igual. Duas cópias da mesma frase é como o "2,4 no card com 2,3
 * no subtítulo" nasceu.
 */
function baseDeJogos(p: Prestacao): string {
  return p.parcelas
    .map((b) =>
      b.jogos === b.daJanela
        ? `${b.teamName}, ${b.jogos} ${b.jogos === 1 ? 'jogo' : 'jogos'}`
        : `${b.teamName}, ${b.jogos} dos últimos ${b.daJanela}`,
    )
    .join(' · ');
}

/**
 * A família de PERCENTUAL POR TIME: cada time com o seu número e o seu veredito,
 * lado a lado, sem soma (#355).
 *
 * O card de soma não serve aqui, e a diferença não é estética: somar percentuais
 * de times diferentes não significa nada. Era esse card que produzia o defeito
 * mais visível da spec — "os dois passam muitos jogos sem sofrer gol" ilustrado
 * com "2,4 gols sofridos por jogo, somando os dois".
 *
 * O `E`/`OU` é dito em palavras porque sem ele o assinante vê um time abaixo do
 * corte e não entende por que a premissa acendeu.
 */
function PrestacaoPorTime({ p, saidaLabel }: { p: Prestacao; saidaLabel: string }) {
  const teto = Math.max(...p.parcelas.map((x) => x.valor), p.corte) * 1.2 || 1;
  const pct = (v: number) => `${Math.min(100, (v / teto) * 100)}%`;
  const exigencia =
    p.combinacao === 'e'
      ? `Os DOIS times precisam de ${corteEmPalavras(p)}.`
      : `Basta UM dos times ter ${corteEmPalavras(p)}.`;
  // A contagem é medida contra a LINHA escolhida, e muda quando o assinante
  // arrasta a régua. Sem dizer isso, ver o número mudar parece defeito.
  const contraALinha =
    p.escala === 'contagem' && p.linha != null
      ? ` A conta é contra a linha de ${fmtLinhaExata(p.linha)}, e muda com ela.`
      : '';
  return (
    <div className="rounded-xl bg-canvas-2 p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3">
        {p.escala === 'contagem' ? `Jogos ${p.unidade}` : `${p.unidade}, por time`}
      </div>

      <div className="flex flex-col gap-3 mt-3">
        {p.parcelas.map((x) => (
          <div key={x.teamId}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5 min-w-0">
                <Crest name={x.teamName} id={x.teamId} size={15} />
                <span className="text-[12px] font-semibold text-ink truncate">{x.teamName}</span>
              </span>
              <span
                className="tabular-nums text-[19px] font-semibold leading-none shrink-0"
                style={{ color: x.cruzou ? 'var(--forest)' : 'var(--ink-3)' }}
              >
                {numeroDaPrestacao(p, x.valor)}
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-white">
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full"
                style={{ width: pct(x.valor), background: x.cruzou ? 'var(--forest)' : 'var(--ink-3)' }}
              />
              <div
                className="absolute -top-1 -bottom-1 w-[3px] rounded-full"
                style={{ left: pct(p.corte), background: '#b8870f', boxShadow: '0 0 0 1.5px #fff' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11.5px] leading-relaxed text-ink-2 mt-3">
        {exigencia}{contraALinha}{' '}
        {p.cruzou
          ? p.combinacao === 'ou' && p.parcelas.some((x) => !x.cruzou)
            ? `${p.parcelas.filter((x) => x.cruzou).map((x) => x.teamName).join(' e ')} passou do corte sozinho, e é por isso que esta premissa sustenta ${saidaLabel}.`
            : `Os dois passaram do corte, e é por isso que esta premissa sustenta ${saidaLabel}.`
          : p.parcelas.every((x) => !x.cruzou)
            ? 'Nenhum dos dois atingiu o corte.'
            : `${p.parcelas.filter((x) => !x.cruzou).map((x) => x.teamName).join(' e ')} não atingiu o corte, e por isso a premissa não acendeu.`}
      </div>

      <div className="text-[10.5px] text-ink-3 mt-2 tabular-nums">Base: {baseDeJogos(p)}</div>
    </div>
  );
}

/**
 * A família de MÉDIA COMBINADA: os dois times somam uma média e o total vai
 * contra o corte (#353, #354).
 *
 * O que justifica este card, e não o consolidado antigo, é o CORTE. O antigo
 * comparava o número contra a LINHA, e o corte quase nunca é a linha: numa linha
 * de 3,25 o corte de "defesas firmes" é 2,95, e havia uma faixa inteira — 2,95 a
 * 3,25 — em que o card dizia "fica abaixo da linha, e é por isso que a premissa
 * joga a favor" enquanto o modelo não a acendia.
 *
 * A linha continua desenhada, em segundo plano, porque é ela que decide a aposta
 * e sumir com ela deixaria o corte sem referência.
 */
function PrestacaoDeContas({ p, saidaLabel }: { p: Prestacao; saidaLabel: string }) {
  if (p.insumo == null) return <PrestacaoPorTime p={p} saidaLabel={saidaLabel} />;
  const insumo = p.insumo;
  const linha = p.linha;
  const teto = Math.max(insumo, p.corte, linha ?? 0) * 1.2;
  const pct = (v: number) => `${Math.min(100, (v / teto) * 100)}%`;
  const cor = p.cruzou ? 'var(--forest)' : 'var(--ink-3)';
  const semMargem = p.margem === 0;
  // A frase da distância mora na tela, e o número vem do critério: uma função que
  // devolvesse ", por 0,05" só serviria colada nesta frase.
  const falta = faltouParaOCorte(p);
  const porQuanto = falta == null ? '' : `, por ${exato(falta)}`;
  return (
    <div className="rounded-xl bg-canvas-2 p-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3">
            {p.parcelas.map((x) => x.teamName).join(' + ')}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="tabular-nums text-[30px] font-semibold leading-none" style={{ color: cor }}>
              {d1(insumo)}
            </span>
            <span className="text-[12px] text-ink-2">{p.unidade}</span>
          </div>
          <div className="text-[11px] text-ink-3 mt-1 tabular-nums">
            {p.parcelas.map((x) => `${x.teamName} ${d1(x.valor)}`).join(' · ')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3">
            Corte da premissa
          </div>
          <div className="tabular-nums text-[20px] font-semibold leading-none mt-1.5 text-ink">
            {corteEmPalavras(p)}
          </div>
        </div>
      </div>

      {/* Os dois marcos, sem rótulo flutuante em cima deles.
          Antes o "corte 2,95" era um `span` posicionado sobre a barra, e a linha
          não tinha rótulo nenhum — o assinante via um tracinho cinza sem saber o
          que era. Pior: com margem de 0,3 os dois marcos ficam a 3% de distância
          na escala, e dois rótulos flutuantes ali se sobrepõem.
          A legenda saiu para baixo, em fluxo: não colide nunca, e nomeia os dois. */}
      <div className="relative mt-4">
        <div className="relative h-3.5 rounded-full bg-white">
          <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: pct(insumo), background: cor }} />
          {!semMargem && (
            <div
              className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded-full"
              style={{ left: pct(linha ?? 0), background: '#c0b79f' }}
            />
          )}
          <div
            className="absolute -top-1 -bottom-1 w-[3px] rounded-full"
            style={{ left: pct(p.corte), background: '#b8870f', boxShadow: '0 0 0 1.5px #fff' }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 flex-wrap text-[10px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[3px] h-3 rounded-full" style={{ background: '#b8870f' }} />
            <span className="tabular-nums" style={{ color: '#8d8672' }}>
              corte {fmtLinhaExata(p.corte)}
            </span>
          </span>
          {!semMargem && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-[2px] h-3 rounded-full" style={{ background: '#c0b79f' }} />
              <span className="tabular-nums" style={{ color: '#8d8672' }}>
                linha {fmtLinhaExata(linha ?? 0)}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="text-[11.5px] leading-relaxed text-ink-2 mt-2.5">
        {p.cruzou
          ? `${d1(insumo)} fica ${LADO_DO_CORTE[p.sentido]} do corte de ${fmtLinhaExata(p.corte)}, e é por isso que esta premissa sustenta ${saidaLabel}.`
          : `${d1(insumo)} não atingiu o corte de ${fmtLinhaExata(p.corte)}${porQuanto}.`}
        {!semMargem && (
          <>
            {' '}
            O corte é a linha de {fmtLinhaExata(linha ?? 0)} com uma margem de{' '}
            {fmtLinhaExata(Math.abs(p.margem ?? 0))}: o modelo é mais exigente do que a linha.
          </>
        )}
      </div>

      <div className="text-[10.5px] text-ink-3 mt-2 tabular-nums">Base: {baseDeJogos(p)}</div>
    </div>
  );
}

/** O painel que abre dentro da linha: consolidado, gráficos e como ler. */
function PainelPremissa({
  story,
  prestacao,
  saidaLabel,
  modo,
}: {
  story: Story;
  prestacao: Prestacao | null;
  saidaLabel: string;
  modo: 'favor' | 'contra';
}) {
  const soMiudas = story.series.every((s) => s.metrica !== 'resultado' && s.jogos.length <= 2);
  return (
    <div className="px-4 pb-4 pt-3.5" style={{ borderTop: '1px solid #f1e9d6' }}>
      {/* A prestação tem precedência: onde o critério foi transcrito, o número que
          fecha a premissa é o dela, contra o corte. O consolidado antigo compara
          contra a linha, e os dois juntos seriam duas réguas para a mesma frase. */}
      {prestacao ? (
        <div className="mb-4">
          <PrestacaoDeContas p={prestacao} saidaLabel={saidaLabel} />
        </div>
      ) : (
        story.consolidado && (
          <div className="mb-4">
            <Consolidado c={story.consolidado} saidaLabel={saidaLabel} modo={modo} />
          </div>
        )
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
  prestacao,
  aberta,
  onAlternar,
  saidaLabel,
}: {
  p: Premissa;
  modo: 'favor' | 'contra';
  lado: 'home' | 'away' | null;
  ev: Evidencia | null;
  story: Story | null;
  prestacao: Prestacao | null;
  aberta: boolean;
  onAlternar: () => void;
  saidaLabel: string;
}) {
  const forte = pesoForte(p);
  const podeAbrir = story != null;

  // Abrir uma premissa leva o topo dela para logo abaixo do cabeçalho.
  //
  // No celular o gráfico nascia embaixo do dedo e a pessoa ficava no MEIO do que
  // tinha acabado de abrir, tendo de rolar para cima para ler do começo.
  //
  // ⚠️ Só quando o TOQUE abriu. A lista abre a primeira premissa sozinha sempre
  // que o conjunto muda (ver o efeito de `aberta` na lista), e arrastar a régua
  // muda o conjunto a cada parada: uma premissa que sobrevive à troca e vira a
  // primeira faria a tela pular no meio do arrasto, sem ninguém ter clicado.
  // Rolar sem clique é pior que o problema que isto veio consertar.
  //
  // A rolagem fica no EFEITO e não no handler porque a conta só fecha depois da
  // pintura: fechar o card que estava aberto acima muda a altura da página, e
  // medir antes disso mira no lugar errado.
  const caixaRef = useRef<HTMLDivElement>(null);
  const abriuNoToque = useRef(false);
  const alternarPorToque = () => {
    abriuNoToque.current = !aberta;
    onAlternar();
  };
  useEffect(() => {
    if (aberta && abriuNoToque.current) alinharAbaixoDoCabecalho(caixaRef.current);
    abriuNoToque.current = false;
  }, [aberta]);

  return (
    <div
      ref={caixaRef}
      className="rounded-[14px] overflow-hidden bg-white"
      style={{ border: `1px solid ${aberta ? '#0a3d2e' : '#ded2b6'}` }}
    >
      <button
        type="button"
        onClick={podeAbrir ? alternarPorToque : undefined}
        className="w-full flex items-center gap-3 px-4 py-3 text-left border-0"
        style={{
          background: aberta ? '#0a3d2e' : '#f4eddc',
          borderBottom: `1px solid ${aberta ? '#0a3d2e' : '#ded2b6'}`,
          cursor: podeAbrir ? 'pointer' : 'default',
        }}
      >
        {/* Círculo vazio, e não o X que estava aqui (#351). O X lia como "errado"
            ou "contra"; o que a premissa é neste bloco é NÃO ACESA — avaliada, e
            aquém do corte. A ausência de marca é o que comunica ausência de sinal,
            e é a mesma marca que o mapa de premissas já usa para as apagadas. */}
        {modo === 'contra' && (
          <span
            className="block w-3 h-3 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: aberta ? '#fbbf24' : '#c0b79f' }}
          />
        )}
        {/* O selo do peso. O MOTIVO dele aparece logo abaixo, fora do botão: sem
            ele, "não ajuda" numa premissa que está na lista a favor levanta a
            pergunta "então por que está aqui?" — e a resposta existe. */}
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
            {/* `sr-only` e não `hidden`: no celular o texto some da TELA e
                continua no leitor de tela. Escondido de vez, o botão passaria a
                se anunciar só pelo nome da premissa, sem dizer que abre nada.
                A seta sozinha basta para quem enxerga — ela já gira ao abrir. */}
            <span className="sr-only md:not-sr-only">{aberta ? 'fechar' : 'ver os jogos'}</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform" style={{ transform: `rotate(${aberta ? 90 : 0}deg)` }} />
          </span>
        ) : (
          <span className="shrink-0 text-[11px]" style={{ color: aberta ? 'rgba(255,255,255,.5)' : '#8d8672' }}>
            sem jogo a jogo
          </span>
        )}
      </button>

      {(ev || (p.peso === 0 && p.motivo)) && (
        <div className="px-4 py-3 text-[12.5px] leading-relaxed" style={{ color: '#5a625a' }}>
          {ev?.texto}
          {/* O motivo do peso zero fica VISÍVEL, e não num `title`: no celular
              ninguém passa o mouse, e é ele que responde "por que uma premissa
              que não ajuda está na lista a favor". */}
          {p.peso === 0 && p.motivo && (
            <span className="block mt-1 text-[11.5px]" style={{ color: '#8d8672' }}>
              Não ajuda na previsão: {p.motivo}.
            </span>
          )}
        </div>
      )}

      {aberta && story && (
        <PainelPremissa story={story} prestacao={prestacao} saidaLabel={saidaLabel} modo={modo} />
      )}
    </div>
  );
}

export function MotivosJogoPorJogo({
  mercado,
  premissas,
  modo,
  extras,
  historico,
  numeros,
  lado,
  linha,
  saidaLabel,
}: {
  /**
   * O mercado da saída. Necessário porque o critério é de mercado+slug, não do
   * slug: `defesas_vazaveis` existe em gols (média contra a linha) e em ambos
   * marcam (percentual de clean sheet), com critérios de famílias diferentes.
   */
  mercado: string;
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
      premissas.map((p) => {
        // A prestação de contas do critério, quando ele já foi transcrito (#353).
        // Onde ela existe, é ela que fecha a premissa — o consolidado antigo
        // compara contra a LINHA, e o corte quase nunca é a linha.
        const prestacao = prestacaoDaPremissa(mercado, p.slug, historico, lado, linha);
        return {
          p,
          prestacao,
          // A frase e o card saem da MESMA prestação. Enquanto a frase lia o
          // histórico jogo a jogo e o card lia o perfil de temporada, a tela
          // mostrava 2,3 e 2,4 para a mesma afirmação, um embaixo do outro.
          ev: evidenciaDaPremissa({ mercado, slug: p.slug, numeros, historico, lado, linha, acesa }),
          story: storyDaPremissa(p.slug, historico, lado, linha),
        };
      }),
    [mercado, premissas, numeros, historico, lado, linha, acesa],
  );

  const total = itens.length + (extras?.length ?? 0);
  const blocosOrdenados = useMemo(
    () => [
      ...itens.map((item) => ({ tipo: 'premissa' as const, peso: item.p.peso ?? 0, item })),
      ...(extras ?? []).map((extra) => ({ tipo: 'extra' as const, peso: extra.pontos ?? 0, extra })),
    ].sort((a, b) => b.peso - a.peso),
    [itens, extras],
  );

  /**
   * A primeira com gráfico NA ORDEM EM QUE ELAS APARECEM — chegar numa lista
   * toda fechada esconde o que a aba veio mostrar.
   *
   * "Primeira" era calculada sobre `itens`, que é a ordem de origem, enquanto a
   * tela desenha `blocosOrdenados`, que ordena por peso. As duas quase nunca
   * coincidem: abrir o jogo mostrava a terceira premissa aberta e as duas de
   * cima fechadas, e a que abria era justamente a de menor peso.
   */
  const primeira = (() => {
    for (const bloco of blocosOrdenados) {
      if (bloco.tipo === 'premissa' && bloco.item.story != null) return bloco.item.p.slug;
    }
    return null;
  })();
  const [aberta, setAberta] = useState<string | null>(primeira);
  const chave = itens.map((x) => x.p.slug).join('|');
  useEffect(() => setAberta(primeira), [chave, primeira]);

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
              ? `Premissas de ${saidaLabel.toLowerCase()} que foram avaliadas e ficaram aquém do corte. Não são sinal para o outro lado: são a ausência deste.`
              : 'Nenhuma premissa desta saída ficou aquém do corte: todas as que valem acenderam.'}
          {/* A definição do corte, UMA vez na lista e não em cada card. Ela só
              aparece quando existe premissa prestando contas, senão a tela
              explicaria um conceito que não está em lugar nenhum dela. */}
          {itens.some((x) => x.prestacao != null) && (
            <span className="block mt-1">
              O <strong className="font-semibold">corte</strong> é o número que a premissa precisa
              bater para acender. Ele sai da linha em umas e é fixo em outras, e quase nunca é a
              própria linha.
            </span>
          )}
        </div>
        {/* Mesma regra da legenda do jogo a jogo: empilha no celular com as
            bolinhas numa coluna só. */}
        {itens.some((x) => x.story != null) && (
          <div className="flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_FAVOR }} />
              <span className="text-[10.5px]" style={{ color: '#5a625a' }}>o lado que a premissa quer</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_CONTRA }} />
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

          const { p, ev, story, prestacao } = bloco.item;
          return (
            <LinhaPremissa
              key={p.slug}
              p={p}
              modo={modo}
              lado={lado}
              ev={ev}
              story={story}
              prestacao={prestacao}
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
