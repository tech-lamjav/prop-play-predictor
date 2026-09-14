import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { resultBadge } from '@/utils/futebol-settlement';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import { margemEmPalavras, placarFinal } from './placar-margem';
import {
  lucroEfetivo,
  ordenarPor,
  type CelulaDaMatriz,
  type ColunaDoDrill,
} from './placar-matriz';
import { rotuloDoMercado } from './placar-vocabulario';
import { useIsMobile } from '@/hooks/use-mobile';
import { brtDayOf } from '@/utils/futebol-datas';

/** A saída, do jeito que o produto a escreve: mercado, lado e linha. */
function saida(market: string, outcome: string, line: number | null): string {
  const linha = line == null ? '' : ` ${line > 0 ? '+' : ''}${String(line).replace('.', ',')}`;
  return `${rotuloDoMercado(market)} · ${outcome}${linha}`;
}

/** O dia do jogo em dd/mm, que é como a lista o escreve. */
function diaCurto(kickoff: string): string {
  const dia = brtDayOf(kickoff);
  return dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : '—';
}

const emUnidades = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}u`;

/** As colunas pelas quais a lista se deixa ordenar, na ordem em que se pergunta. */
const ORDENACOES: { coluna: ColunaDoDrill; rotulo: string }[] = [
  { coluna: 'lucro', rotulo: 'Lucro' },
  { coluna: 'score', rotulo: 'Score' },
  { coluna: 'odd', rotulo: 'Odd' },
  { coluna: 'margem', rotulo: 'Distância' },
  { coluna: 'jogo', rotulo: 'Jogo' },
  { coluna: 'saida', rotulo: 'Saída' },
];

/**
 * O que estava dentro de uma célula.
 *
 * Existe porque a matriz mostra ONDE doeu e não diz por quê, e isso é meio
 * caminho: um −30% numa semana pode ser trinta apostas ruins ou duas apostas de
 * odd alta. A lista abre do PIOR para o melhor, porque quem clica numa célula
 * vermelha está procurando o que deu errado — a primeira linha tem de ser a
 * resposta.
 *
 * São duas formas para a mesma lista. No desktop, tabela: sete colunas, e o
 * olho corre a linha inteira. No celular, um bloco por aposta — sete colunas em
 * 390px quebram cada célula em três linhas, e aí a tabela deixa de ser tabela.
 * A ordenação, que na tabela mora nos cabeçalhos, vira uma fila de botões: ela
 * é a pergunta que se faz aqui dentro ("foi o Score?", "foi o preço?") e não
 * pode ficar só no desktop.
 */
export function DrillDaCelula({
  titulo,
  celula,
  aoFechar,
}: {
  titulo: string;
  celula: CelulaDaMatriz | null;
  aoFechar: () => void;
}) {
  const noCelular = useIsMobile();
  const aberto = celula !== null;
  /**
   * A ordem da lista.
   *
   * Nasce no lucro crescente — o pior primeiro —, porque quem abre uma célula
   * vermelha está procurando o que deu errado. Clicar num cabeçalho troca a
   * pergunta: por Score, para ver se a nota alta é que está afundando; por odd,
   * para ver se é preço; por distância, para ver o que ficou perto de bater.
   */
  const [ordem, setOrdem] = useState<{ coluna: ColunaDoDrill; desc: boolean }>({
    coluna: 'lucro',
    desc: false,
  });
  const linhas = celula ? ordenarPor(celula.linhas, ordem.coluna, ordem.desc) : [];

  const ordenar = (coluna: ColunaDoDrill) =>
    setOrdem((atual) =>
      atual.coluna === coluna ? { coluna, desc: !atual.desc } : { coluna, desc: false },
    );

  const Seta = ({ desc }: { desc: boolean }) =>
    desc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />;

  const Cabecalho = ({
    coluna,
    children,
    direita,
  }: {
    coluna: ColunaDoDrill;
    children: React.ReactNode;
    direita?: boolean;
  }) => (
    <th className={`px-3 py-2 font-bold ${direita ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => ordenar(coluna)}
        className={`inline-flex items-center gap-0.5 uppercase tracking-[0.14em] transition hover:text-ink ${
          ordem.coluna === coluna ? 'text-ink' : ''
        }`}
      >
        {children}
        {ordem.coluna === coluna && <Seta desc={ordem.desc} />}
      </button>
    </th>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      {/* Largo de propósito: são sete colunas, e no tamanho anterior quase toda
          célula quebrava em duas linhas — o nome do time, o do mercado e a
          distância até a linha. Ler o que puxou a célula para baixo exige correr
          o olho pela linha inteira, e linha quebrada não se corre.

          No celular ele ocupa a tela quase inteira: o conteúdo é uma lista
          longa, e margem em volta de lista longa é espaço que falta à lista. */}
      <DialogContent className="theme-bolao max-h-[92vh] w-[96vw] max-w-[1200px] overflow-y-auto border-line-2 bg-white p-0 text-ink">
        <DialogTitle className="sr-only">{titulo}</DialogTitle>

        {celula && (
          <>
            <header className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-2 bg-white px-4 py-3 sm:px-5 sm:py-4">
              <h2 className="font-display text-[16px] font-black text-ink sm:text-[17px]">
                {titulo}
              </h2>
              <span className={`text-[16px] font-black tabular-nums ${tomDoRoi(celula.celula.roi)}`}>
                {roiPct(celula.celula.roi)}
              </span>
              <span className="text-[12px] text-ink-dim">
                {taxaPct(celula.celula.taxa)} de acerto · {emN(celula.celula.n)} · ±{' '}
                {epPct(celula.celula.ep)}
              </span>
            </header>

            {/* A ordenação do celular. No desktop ela mora nos cabeçalhos da
                tabela, que ali estão sempre à vista.

                Uma forma OU a outra, decidida pelo hook: as duas no DOM fariam
                cada aposta aparecer duas vezes para quem lê por leitor de tela,
                e dariam dois botões "Score" para a mesma ordenação. */}
            {noCelular && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line-2 px-4 py-2 no-scrollbar">
                <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
                  Ordenar
                </span>
                {ORDENACOES.map((o) => (
                  <button
                    key={o.coluna}
                    type="button"
                    onClick={() => ordenar(o.coluna)}
                    className={`flex shrink-0 items-center gap-0.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                      ordem.coluna === o.coluna
                        ? 'border-forest bg-forest/10 text-forest'
                        : 'border-line-2 text-ink-dim'
                    }`}
                  >
                    {o.rotulo}
                    {ordem.coluna === o.coluna && <Seta desc={ordem.desc} />}
                  </button>
                ))}
              </div>
            )}

            {/* ── O celular: um bloco por aposta ── */}
            {noCelular && (
              <ul>
                {linhas.map((l) => {
                  const selo = resultBadge(l.veredito);
                  const lucro = lucroEfetivo(l);
                  return (
                    <li
                      key={l.linha.opportunity_key}
                      className="border-b border-line-2 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] font-bold text-ink">
                          {l.linha.home_team_name} x {l.linha.away_team_name}
                        </span>
                        <span
                          className={`shrink-0 text-[14px] font-bold tabular-nums ${tomDoRoi(l.lucro)}`}
                        >
                          {emUnidades(lucro)}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[11px] text-ink-dim">
                        {diaCurto(l.linha.kickoff_utc)} · {l.linha.competition ?? 'sem campeonato'}
                        {l.unidades !== 1 && ` · ${String(l.unidades).replace('.', ',')}u apostada`}
                      </p>

                      <p className="mt-1.5 text-[13px] text-ink-2">
                        {saida(l.linha.market, l.linha.outcome, l.linha.line_value)}
                        <span className="text-ink-dim"> · </span>
                        odd{' '}
                        <span className="tabular-nums text-ink">
                          {l.linha.best_odd?.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-ink-dim"> · </span>
                        Score <span className="tabular-nums text-ink">{l.linha.score}</span>
                      </p>

                      {/* O placar e a distância: sem eles, "Red" não diz se faltou
                          um gol ou quatro. */}
                      <p className="mt-1 text-[13px] text-ink">
                        <span className="font-bold tabular-nums">{placarFinal(l.linha) ?? '—'}</span>
                        {margemEmPalavras(l.linha) && (
                          <span className="ml-1 text-[11px] text-ink-dim">
                            {margemEmPalavras(l.linha)}
                          </span>
                        )}
                        <span className="ml-2 text-[12px] font-bold text-ink-2">
                          {selo?.label ?? '—'}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* ── O desktop: a tabela ── */}
            {!noCelular && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                      <Cabecalho coluna="jogo">Jogo</Cabecalho>
                      <Cabecalho coluna="saida">Saída</Cabecalho>
                      <Cabecalho coluna="odd" direita>
                        Odd
                      </Cabecalho>
                      <Cabecalho coluna="score" direita>
                        Score
                      </Cabecalho>
                      <Cabecalho coluna="margem">Placar</Cabecalho>
                      <th className="px-3 py-2 font-bold">Resultado</th>
                      <Cabecalho coluna="lucro" direita>
                        Lucro
                      </Cabecalho>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const selo = resultBadge(l.veredito);
                      return (
                        <tr
                          key={l.linha.opportunity_key}
                          className="border-b border-line-2 last:border-b-0"
                        >
                          <td className="px-5 py-2.5 text-[13px] text-ink">
                            <span className="whitespace-nowrap font-bold">
                              {l.linha.home_team_name} x {l.linha.away_team_name}
                            </span>
                            <span className="ml-2 text-[11px] text-ink-dim">
                              {diaCurto(l.linha.kickoff_utc)} ·{' '}
                              {l.linha.competition ?? 'sem campeonato'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-2">
                            {saida(l.linha.market, l.linha.outcome, l.linha.line_value)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-ink">
                            {l.linha.best_odd?.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-ink-2">
                            {l.linha.score}
                          </td>
                          {/* O placar e a distância até a linha: sem eles, "Red"
                              não diz se faltou um gol ou quatro — e essa é a
                              diferença entre azar e leitura errada do jogo. */}
                          <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink">
                            <span className="font-bold tabular-nums">
                              {placarFinal(l.linha) ?? '—'}
                            </span>
                            {margemEmPalavras(l.linha) && (
                              <span className="ml-1 text-[11px] text-ink-dim">
                                {margemEmPalavras(l.linha)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] font-bold text-ink-2">
                            {selo?.label ?? '—'}
                          </td>
                          {/* O lucro EFETIVO: o de uma unidade multiplicado pelo
                              tamanho que a simulação deu àquela faixa. Mostrar o
                              de uma unidade faria a coluna não fechar com o ROI da
                              célula quando a simulação está ligada. */}
                          <td
                            className={`whitespace-nowrap px-5 py-2.5 text-right text-[13px] font-bold tabular-nums ${tomDoRoi(
                              l.lucro,
                            )}`}
                          >
                            {emUnidades(lucroEfetivo(l))}
                            {l.unidades !== 1 && (
                              <span className="ml-1 text-[10px] font-normal text-ink-dim">
                                de {String(l.unidades).replace('.', ',')}u
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="border-t border-line-2 px-4 py-3 text-[12px] text-ink-dim sm:px-5">
              {!noCelular && 'Clique num cabeçalho para reordenar. '}O placar é do jogo, e a
              distância é até a linha da aposta — nos mercados que têm linha. O lucro é em unidades
              apostadas.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
