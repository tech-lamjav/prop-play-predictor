import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtOdd, fmtDecimal, fmtExato, fmtLinhaAnalisada } from '@/utils/formato';
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

/**
 * A saída, do jeito que o produto a escreve: mercado, lado e linha.
 *
 * `outcome` é o valor CRU do banco (`Over`, `Home`, `Yes`) e `rotuloDoMercado`
 * vem de `placar-vocabulario.ts` — os dois seguem em português neste passo.
 */
function saida(market: string, outcome: string, line: number | null): string {
  const linha = line == null ? '' : ` ${line > 0 ? '+' : ''}${fmtLinhaAnalisada(line)}`;
  return `${rotuloDoMercado(market)} · ${outcome}${linha}`;
}

/** O dia do jogo em dd/mm, que é como a lista o escreve. */
function diaCurto(kickoff: string): string {
  const dia = brtDayOf(kickoff);
  return dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : '—';
}

const emUnidades = (n: number) => `${n > 0 ? '+' : ''}${fmtDecimal(n, 2)}u`;

/**
 * As colunas pelas quais a lista se deixa ordenar, na ordem em que se pergunta.
 *
 * Guarda CHAVE e não texto: a tabela é avaliada uma vez, na carga do módulo, e
 * texto aqui congelaria o idioma da primeira renderização. O `t()` acontece no
 * render, e a `key` do React é a `coluna`, que é identificador e não rótulo.
 */
const ORDENACOES: { coluna: ColunaDoDrill; chave: string }[] = [
  { coluna: 'lucro', chave: 'quebras.drill.coluna.lucro' },
  { coluna: 'score', chave: 'quebras.drill.coluna.score' },
  { coluna: 'odd', chave: 'quebras.drill.coluna.odd' },
  { coluna: 'margem', chave: 'quebras.drill.coluna.distancia' },
  { coluna: 'jogo', chave: 'quebras.drill.coluna.jogo' },
  { coluna: 'saida', chave: 'quebras.drill.coluna.saida' },
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
  const { t } = useTranslation('socios');
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
                {t('quebras.deAcerto', { taxa: taxaPct(celula.celula.taxa) })} ·{' '}
                {emN(celula.celula.n)} · ± {epPct(celula.celula.ep)}
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
                  {t('quebras.drill.ordenar')}
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
                    {t(o.chave)}
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
                        {diaCurto(l.linha.kickoff_utc)} ·{' '}
                        {l.linha.competition ?? t('quebras.drill.semCampeonato')}
                        {l.unidades !== 1 &&
                          ` · ${t('quebras.drill.unidadeApostada', {
                            unidades: fmtExato(l.unidades),
                          })}`}
                      </p>

                      <p className="mt-1.5 text-[13px] text-ink-2">
                        {saida(l.linha.market, l.linha.outcome, l.linha.line_value)}
                        <span className="text-ink-dim"> · </span>
                        {t('quebras.drill.oddEmLinha')}{' '}
                        <span className="tabular-nums text-ink">
                          {fmtOdd(l.linha.best_odd)}
                        </span>
                        <span className="text-ink-dim"> · </span>
                        {t('quebras.drill.coluna.score')}{' '}
                        <span className="tabular-nums text-ink">{l.linha.score}</span>
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
                      <Cabecalho coluna="jogo">{t('quebras.drill.coluna.jogo')}</Cabecalho>
                      <Cabecalho coluna="saida">{t('quebras.drill.coluna.saida')}</Cabecalho>
                      <Cabecalho coluna="odd" direita>
                        {t('quebras.drill.coluna.odd')}
                      </Cabecalho>
                      <Cabecalho coluna="score" direita>
                        {t('quebras.drill.coluna.score')}
                      </Cabecalho>
                      {/* A MESMA coluna se chama "Placar" na tabela e
                          "Distância" na fila de ordenação do celular: ali o
                          botão nomeia a pergunta, aqui o cabeçalho nomeia o
                          número embaixo dele. São duas chaves de propósito. */}
                      <Cabecalho coluna="margem">{t('quebras.drill.cabecalho.placar')}</Cabecalho>
                      <th className="px-3 py-2 font-bold">
                        {t('quebras.drill.cabecalho.resultado')}
                      </th>
                      <Cabecalho coluna="lucro" direita>
                        {t('quebras.drill.coluna.lucro')}
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
                              {l.linha.competition ?? t('quebras.drill.semCampeonato')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-2">
                            {saida(l.linha.market, l.linha.outcome, l.linha.line_value)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-ink">
                            {fmtOdd(l.linha.best_odd)}
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
                                {t('quebras.drill.deUnidades', { unidades: fmtExato(l.unidades) })}
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

            {/* ⚠️ O rodapé diz "linha da aposta", e esse é termo PROIBIDO pelo
                verbete "Linha de referência" do CONTEXT.md — os sancionados são
                linha analisada, cotada, de referência e bloqueada. A frase
                entrou no catálogo exatamente como estava: este passo move o
                texto, não o reescreve. Corrigir o vocabulário é outro ticket, e
                ele tem de corrigir português e espanhol juntos. */}
            <p className="border-t border-line-2 px-4 py-3 text-[12px] text-ink-dim sm:px-5">
              {!noCelular && `${t('quebras.drill.reordenar')} `}
              {t('quebras.drill.rodape')}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
