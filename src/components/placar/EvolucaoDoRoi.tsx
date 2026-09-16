import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LinhaLiquidada } from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import {
  granularidadeAbaixo,
  granularidadesDe,
  mercadosPresentes,
  ROTULO_DA_GRANULARIDADE,
  serie,
  type Granularidade,
  type Ponto,
} from './placar-evolucao';
import type { Eixo, Periodo } from './placar-periodo';
import { useIsMobile } from '@/hooks/use-mobile';
import { rotuloDoMercado } from './placar-vocabulario';

/** O que a barra diz quando o ponteiro para nela. */
function Balao({ ponto }: { ponto?: Ponto }) {
  if (!ponto) return null;

  return (
    <div className="rounded-rebrand-sm border border-line-2 bg-white px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
        {ponto.rotulo}
      </p>
      <p className="mt-0.5 text-[15px] font-black tabular-nums text-ink">
        {roiPct(ponto.total.roi)}{' '}
        <span className="text-[12px] font-normal text-ink-dim">± {epPct(ponto.total.ep)}</span>
      </p>
      <p className="text-[12px] text-ink-2">
        {taxaPct(ponto.total.taxa)} de acerto · {emN(ponto.total.n)}
      </p>
    </div>
  );
}

/**
 * O ROI ao longo do tempo, com um degrau por clique.
 *
 * A tabela diz como foi o período; esta série diz se está melhorando. Ela abre
 * na semana porque a série comparável tem poucos dias — o mês só aparece quando
 * há dois meses, e aí ele é o primeiro degrau.
 *
 * Clicar numa barra ABRE aquela gaveta no degrau de baixo: o mês vira as semanas
 * dele, a semana vira os dias dela. É a leitura do macro para o micro, e o
 * caminho de volta fica escrito à esquerda, porque sem ele quem desce fica
 * perdido.
 *
 * A gaveta NÃO mora aqui: ela é estado do placar inteiro. Enquanto foi estado
 * interno deste gráfico, abrir um dia mudava só as barras — os números do topo,
 * as quebras e as premissas continuavam somando o período inteiro, e a tela
 * mostrava duas janelas diferentes ao mesmo tempo sem dizer qual era qual.
 *
 * A cor é o sinal do ROI, não a categoria: o que a barra precisa dizer de longe
 * é se aquela semana ganhou ou perdeu dinheiro.
 */
export function EvolucaoDoRoi({
  liquidadas,
  periodo,
  eixo,
  granularidade,
  aoMudarGranularidade,
  gaveta,
  aoAbrirGaveta,
  aoFecharGaveta,
  comparando,
}: {
  /** Já recortadas pela gaveta aberta, quando há uma: quem recorta é o placar. */
  liquidadas: LinhaLiquidada[];
  periodo: Periodo;
  eixo: Eixo;
  /**
   * O degrau do tempo, que vale para a tela toda.
   *
   * Controlado de fora de propósito: as matrizes usam as mesmas colunas, e dois
   * controles de granularidade na mesma tela — um aqui, outro nas tabelas — é
   * exatamente o tipo de ruído que o painel estava acumulando.
   */
  granularidade: Granularidade;
  aoMudarGranularidade: (g: Granularidade) => void;
  /** A gaveta que a tela está mostrando, quando há uma. */
  gaveta: { rotulo: string } | null;
  aoAbrirGaveta: (chave: string, de: Granularidade) => void;
  aoFecharGaveta: () => void;
  /**
   * Comparando dois períodos, a barra não abre.
   *
   * Vem dito por extenso, e não deduzido de um callback nulo: o rodapé imprime
   * o motivo como afirmação, e no dia em que existir um segundo motivo para não
   * abrir, a frase passaria a mentir.
   */
  comparando: boolean;
}) {
  const noCelular = useIsMobile();
  const disponiveis = granularidadesDe(periodo);
  const [mercados, setMercados] = useState<string[]>([]);
  /** No celular, a barra tocada: o toque mostra o número, e descer vira um botão. */
  const [tocada, setTocada] = useState<string | null>(null);

  const presentes = mercadosPresentes(liquidadas);
  const pontos = serie(liquidadas, granularidade, eixo, mercados);
  const pontoTocado = pontos.find((p) => p.chave === tocada) ?? null;
  const degrauAbaixo = comparando ? null : granularidadeAbaixo(granularidade);

  // Trocar de gaveta apaga a barra tocada. A chave da semana e a do primeiro
  // dia dela são a MESMA data, então a marca sobrevivia à descida e voltava
  // acesa na barra errada, com as outras apagadas em volta.
  useEffect(() => setTocada(null), [gaveta]);

  const abrir = (chave: string) => {
    if (!degrauAbaixo) return;
    setTocada(null);
    aoAbrirGaveta(chave, granularidade);
  };

  const voltar = () => {
    setTocada(null);
    aoFecharGaveta();
  };

  const alternarMercado = (slug: string) =>
    setMercados((atual) =>
      atual.includes(slug) ? atual.filter((m) => m !== slug) : [...atual, slug],
    );

  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-2 px-4 py-3 sm:px-5">
        <h2 className="font-display text-[17px] font-black text-ink">Evolução do ROI</h2>

        {gaveta && (
          <button
            type="button"
            onClick={voltar}
            className="flex items-center gap-1 rounded-rebrand-sm border border-line-2 px-2 py-1 text-[12px] font-bold text-ink-2 transition hover:border-ink hover:text-ink"
          >
            <ChevronLeft className="h-3 w-3" />
            {gaveta.rotulo}, por {ROTULO_DA_GRANULARIDADE[granularidade].toLowerCase()} — voltar
          </button>
        )}

        {!gaveta && disponiveis.length > 1 && (
          <span className="flex overflow-hidden rounded-rebrand-sm border border-line-2">
            {disponiveis.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setTocada(null);
                  aoMudarGranularidade(g);
                }}
                className={`px-2.5 py-1 text-[12px] font-bold transition ${
                  granularidade === g ? 'bg-forest text-white' : 'bg-white text-ink-2 hover:text-ink'
                }`}
              >
                {ROTULO_DA_GRANULARIDADE[g]}
              </button>
            ))}
          </span>
        )}

        {/* No celular os mercados ganham a linha inteira: espremidos à direita
            de um título que já ocupa a largura toda, eles viravam uma coluna de
            chips de um em um. */}
        <span className="flex w-full flex-wrap gap-1 sm:ml-auto sm:w-auto">
          {presentes.map((slug) => {
            const ativo = mercados.length === 0 || mercados.includes(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => alternarMercado(slug)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition ${
                  ativo
                    ? 'border-forest bg-forest/10 text-forest'
                    : 'border-line-2 text-ink-dim hover:text-ink'
                }`}
              >
                {rotuloDoMercado(slug)}
              </button>
            );
          })}
        </span>
      </header>

      {pontos.length === 0 ? (
        <p className="px-4 py-8 text-[14px] text-ink-2 sm:px-5">
          Nenhuma oportunidade liquidada no período com os mercados escolhidos.
        </p>
      ) : (
        <div className="px-2 py-4">
          <ResponsiveContainer width="100%" height={noCelular ? 200 : 240}>
            <BarChart data={pontos} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: noCelular ? 10 : 11, fill: 'var(--ink-2)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
                // Sem isto, num mês por dia os rótulos se sobrepõem na largura
                // de um celular até virarem uma mancha.
                interval="preserveStartEnd"
                minTickGap={noCelular ? 12 : 5}
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                tick={{ fontSize: noCelular ? 10 : 11, fill: 'var(--ink-2)' }}
                tickLine={false}
                axisLine={false}
                width={noCelular ? 38 : 46}
              />
              <ReferenceLine y={0} stroke="var(--line-2)" />
              {/* No celular não há ponteiro parado em cima da barra: o balão
                  piscava e sumia no mesmo toque. O número vai para o painel
                  embaixo do gráfico. */}
              {!noCelular && (
                <Tooltip
                  content={({ payload }) => <Balao ponto={payload?.[0]?.payload as Ponto} />}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
              )}
              <Bar
                dataKey="total.roi"
                radius={[2, 2, 0, 0]}
                onClick={(d: { chave?: string }) => {
                  if (!d?.chave) return;
                  // No celular o toque é leitura, não navegação: descer direto
                  // escondia o número da barra antes de ele ser lido.
                  if (noCelular) setTocada(d.chave);
                  else abrir(d.chave);
                }}
                cursor={degrauAbaixo ? 'pointer' : 'default'}
              >
                {pontos.map((p) => (
                  <Cell
                    key={p.chave}
                    fill={p.total.roi >= 0 ? 'var(--forest)' : 'var(--status-danger)'}
                    fillOpacity={noCelular && tocada && tocada !== p.chave ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {noCelular && pontoTocado && (
            <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-rebrand-sm border border-line-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
                  {pontoTocado.rotulo}
                </span>
                <span
                  className={`block text-[16px] font-black tabular-nums ${tomDoRoi(pontoTocado.total.roi)}`}
                >
                  {roiPct(pontoTocado.total.roi)}{' '}
                  <span className="text-[12px] font-normal text-ink-dim">
                    ± {epPct(pontoTocado.total.ep)}
                  </span>
                </span>
                <span className="block text-[12px] text-ink-2">
                  {taxaPct(pontoTocado.total.taxa)} de acerto · {emN(pontoTocado.total.n)}
                </span>
              </span>
              {degrauAbaixo && (
                <button
                  type="button"
                  onClick={() => abrir(pontoTocado.chave)}
                  className="flex shrink-0 items-center gap-1 rounded-rebrand-sm bg-forest px-3 py-2 text-[12px] font-bold text-white"
                >
                  Abrir por {ROTULO_DA_GRANULARIDADE[degrauAbaixo].toLowerCase()}
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <p className="px-3 pt-1 text-[11px] text-ink-dim">
            {comparando
              ? 'Comparando dois períodos, a barra não abre: a gaveta recorta a tela toda, e a tela está mostrando duas janelas.'
              : noCelular
              ? 'Toque numa barra para ver o número dela.'
              : degrauAbaixo
              ? `Clique numa barra para abrir por ${ROTULO_DA_GRANULARIDADE[degrauAbaixo].toLowerCase()}.`
              : 'Este é o último degrau: cada barra é um dia.'}
          </p>
        </div>
      )}
    </section>
  );
}
