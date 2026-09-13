import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LinhaLiquidada } from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct } from './placar-formato';
import {
  granularidadeAbaixo,
  granularidadesDe,
  janelaDaGaveta,
  mercadosPresentes,
  ROTULO_DA_GRANULARIDADE,
  rotuloDaGaveta,
  serie,
  type Granularidade,
  type Ponto,
} from './placar-evolucao';
import { noPeriodo, type Eixo, type Periodo } from './placar-periodo';
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
 * A cor é o sinal do ROI, não a categoria: o que a barra precisa dizer de longe
 * é se aquela semana ganhou ou perdeu dinheiro.
 */
export function EvolucaoDoRoi({
  liquidadas,
  periodo,
  eixo,
  granularidade,
  aoMudarGranularidade,
}: {
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
}) {
  const noCelular = useIsMobile();
  const disponiveis = granularidadesDe(periodo);
  const setGranularidade = aoMudarGranularidade;
  /** A gaveta aberta por clique, com o caminho de volta. */
  const [zoom, setZoom] = useState<{ janela: Periodo; rotulo: string; volta: Granularidade } | null>(
    null,
  );
  const [mercados, setMercados] = useState<string[]>([]);

  const presentes = mercadosPresentes(liquidadas);
  const emFoco = zoom
    ? liquidadas.filter((l) => noPeriodo(l.linha, eixo, zoom.janela))
    : liquidadas;
  const pontos = serie(emFoco, granularidade, eixo, mercados);

  const abrir = (chave: string) => {
    const abaixo = granularidadeAbaixo(granularidade);
    if (!abaixo) return;
    setZoom({
      janela: janelaDaGaveta(chave, granularidade),
      rotulo: rotuloDaGaveta(chave, granularidade),
      volta: granularidade,
    });
    setGranularidade(abaixo);
  };

  const voltar = () => {
    if (!zoom) return;
    setGranularidade(zoom.volta);
    setZoom(null);
  };

  const alternarMercado = (slug: string) =>
    setMercados((atual) =>
      atual.includes(slug) ? atual.filter((m) => m !== slug) : [...atual, slug],
    );

  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-2 px-4 py-3 sm:px-5">
        <h2 className="font-display text-[17px] font-black text-ink">Evolução do ROI</h2>

        {zoom && (
          <button
            type="button"
            onClick={voltar}
            className="flex items-center gap-1 rounded-rebrand-sm border border-line-2 px-2 py-1 text-[12px] font-bold text-ink-2 transition hover:border-ink hover:text-ink"
          >
            <ChevronLeft className="h-3 w-3" />
            {zoom.rotulo}, por {ROTULO_DA_GRANULARIDADE[granularidade].toLowerCase()} — voltar
          </button>
        )}

        {!zoom && disponiveis.length > 1 && (
          <span className="flex overflow-hidden rounded-rebrand-sm border border-line-2">
            {disponiveis.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularidade(g)}
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e0" />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: noCelular ? 10 : 11, fill: '#6b6b6b' }}
                tickLine={false}
                axisLine={{ stroke: '#e7e5e0' }}
                // Sem isto, num mês por dia os rótulos se sobrepõem na largura
                // de um celular até virarem uma mancha.
                interval="preserveStartEnd"
                minTickGap={noCelular ? 12 : 5}
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                tick={{ fontSize: noCelular ? 10 : 11, fill: '#6b6b6b' }}
                tickLine={false}
                axisLine={false}
                width={noCelular ? 38 : 46}
              />
              <ReferenceLine y={0} stroke="#9a9a9a" />
              <Tooltip
                content={({ payload }) => <Balao ponto={payload?.[0]?.payload as Ponto} />}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Bar
                dataKey="total.roi"
                radius={[2, 2, 0, 0]}
                onClick={(d: { chave?: string }) => d?.chave && abrir(d.chave)}
                cursor={granularidadeAbaixo(granularidade) ? 'pointer' : 'default'}
              >
                {pontos.map((p) => (
                  <Cell key={p.chave} fill={p.total.roi >= 0 ? '#1f6f4a' : '#c0392b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <p className="px-3 pt-1 text-[11px] text-ink-dim">
            {granularidadeAbaixo(granularidade)
              ? `Clique numa barra para abrir por ${ROTULO_DA_GRANULARIDADE[
                  granularidadeAbaixo(granularidade)!
                ].toLowerCase()}.`
              : 'Este é o último degrau: cada barra é um dia.'}
          </p>
        </div>
      )}
    </section>
  );
}
