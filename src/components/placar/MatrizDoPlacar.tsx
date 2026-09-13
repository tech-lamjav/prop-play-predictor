import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { LinhaLiquidada } from './placar-agregacao';
import { DrillDaCelula } from './DrillDaCelula';
import { epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { Granularidade } from './placar-evolucao';
import { matriz, type CelulaDaMatriz } from './placar-matriz';
import { linhasDa, type Quebra } from './placar-quebras';
import type { Eixo } from './placar-periodo';
import { useIsMobile } from '@/hooks/use-mobile';

/** O conteúdo de uma célula: o ROI grande, a base pequena. */
function Conteudo({ celula }: { celula: CelulaDaMatriz | undefined }) {
  if (!celula) return <span className="text-[12px] text-ink-dim">—</span>;

  return (
    <span className="flex flex-col items-end">
      <span className={`text-[13px] font-bold tabular-nums ${tomDoRoi(celula.celula.roi)}`}>
        {roiPct(celula.celula.roi)}
      </span>
      <span className="text-[10px] tabular-nums text-ink-dim">
        {celula.celula.n} · {taxaPct(celula.celula.taxa, 0)}
      </span>
    </span>
  );
}

/** O total da linha, que é a régua dela. */
function Total({ celula, forte }: { celula: CelulaDaMatriz; forte?: boolean }) {
  return (
    <span className="flex flex-col items-end">
      <span
        className={`${forte ? 'text-[14px] font-black' : 'text-[13px] font-bold'} tabular-nums ${tomDoRoi(
          celula.celula.roi,
        )}`}
      >
        {roiPct(celula.celula.roi)}
      </span>
      <span className="text-[10px] tabular-nums text-ink-dim">
        {celula.celula.n} · {taxaPct(celula.celula.taxa, 0)}
        {forte && ` · ± ${epPct(celula.celula.ep)}`}
      </span>
    </span>
  );
}

/**
 * A coluna que não rola junto.
 *
 * No celular a tabela é mais larga que a tela — ela tem uma coluna por gaveta de
 * tempo —, e sem a coluna de identidade presa a pessoa arrasta para o lado e
 * perde de vista de quem é a linha que está lendo. Por isso ela é `sticky`, e
 * por isso ela precisa de fundo opaco: o resto da tabela passa por baixo.
 */
const COLUNA_PRESA = 'sticky left-0 z-10';

/**
 * Uma quebra com o tempo nas colunas, cada linha abrindo um degrau e cada célula
 * abrindo as apostas.
 *
 * São três níveis de leitura, e eles respondem perguntas diferentes:
 *
 *   · a LINHA diz como aquele grupo foi ao longo do tempo;
 *   · abrir a linha diz de onde veio o número dela — Gols abre em faixas de
 *     Score, a faixa Alta abre em mercados;
 *   · a CÉLULA abre as apostas que a formaram.
 *
 * O desdobramento vive na mesma tabela, e não numa quinta tabela, porque o que
 * ele responde é sempre sobre a linha em que se clicou: mostrar "mercado ×
 * faixa" como tabela própria obrigaria a procurar a linha de novo.
 *
 * O card inteiro recolhe, como os de premissa: com quatro tabelas na tela, a
 * economia de espaço vem de fechar o que já foi lido.
 *
 * No CELULAR a tabela não vira outra coisa — ela rola de lado com a coluna de
 * identidade presa, e o total da linha sobe para dentro dessa coluna. Assim a
 * leitura macro (quem está ganhando, quem está perdendo) cabe na tela sem
 * arrastar nada, e arrastar passa a responder só a pergunta seguinte: em qual
 * semana foi.
 */
export function MatrizDoPlacar({
  quebra,
  liquidadas,
  granularidade,
  eixo,
  selo,
}: {
  quebra: Quebra;
  liquidadas: LinhaLiquidada[];
  granularidade: Granularidade;
  eixo: Eixo;
  selo?: (chave: string) => string | null;
}) {
  const noCelular = useIsMobile();
  const [aberta, setAberta] = useState<{ titulo: string; celula: CelulaDaMatriz } | null>(null);
  const [expandidas, setExpandidas] = useState<string[]>([]);

  const { gavetas, linhas } = matriz(liquidadas, quebra, granularidade, eixo);
  const fora = liquidadas.length - linhasDa(quebra, liquidadas).length;
  const dentro = quebra.desdobraEm;

  const abrirCelula = (titulo: string, celula: CelulaDaMatriz | undefined) => {
    if (!celula || celula.linhas.length === 0) return;
    setAberta({ titulo, celula });
  };

  const alternar = (chave: string) =>
    setExpandidas((atual) =>
      atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave],
    );

  /**
   * O total da linha dentro da coluna presa, que é onde ele cabe no celular.
   *
   * Renderizado pelo hook e não escondido por CSS: com as duas versões no DOM, o
   * mesmo ROI apareceria duas vezes para quem lê por leitor de tela e para quem
   * procura um número com Ctrl+F.
   */
  const TotalNoCelular = ({ rotulo, celula }: { rotulo: string; celula: CelulaDaMatriz }) => {
    if (!noCelular) return null;

    return (
      <button
        type="button"
        onClick={() => abrirCelula(`${rotulo} · período inteiro`, celula)}
        className="mt-0.5 flex items-baseline gap-1.5 text-left"
      >
        <span className={`text-[13px] font-black tabular-nums ${tomDoRoi(celula.celula.roi)}`}>
          {roiPct(celula.celula.roi)}
        </span>
        <span className="text-[10px] font-normal tabular-nums text-ink-dim">
          {celula.celula.n} · {taxaPct(celula.celula.taxa, 0)}
        </span>
      </button>
    );
  };

  return (
    <details open className="group/card rounded-rebrand-md border border-line-2 bg-white">
      <summary className="cursor-pointer list-none border-b border-line-2 px-4 py-3 marker:content-none sm:px-5">
        <div className="flex items-start gap-2">
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-dim transition group-open/card:rotate-90" />
          <div>
            <h2 className="font-display text-[17px] font-black text-ink">{quebra.titulo}</h2>
            <p className="mt-1 text-[13px] text-ink-2">{quebra.explicacao}</p>
          </div>
        </div>
      </summary>

      {linhas.length === 0 ? (
        <p className="px-4 py-8 text-[14px] text-ink-2 sm:px-5">
          Nenhuma oportunidade liquidada no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                <th
                  className={`${COLUNA_PRESA} border-r border-line-2 bg-white px-4 py-2 font-bold sm:border-r-0 sm:px-5`}
                >
                  Grupo
                </th>
                {gavetas.map((g) => (
                  <th key={g.chave} className="whitespace-nowrap px-3 py-2 text-right font-bold">
                    {g.rotulo}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-bold text-ink sm:px-5">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const aberto = expandidas.includes(l.chave);
                const sub =
                  aberto && dentro ? matriz(l.total.linhas, dentro, granularidade, eixo) : null;

                return (
                  <Fragment key={l.chave}>
                    <tr className="border-b border-line-2">
                      <td
                        className={`${COLUNA_PRESA} w-[10.5rem] border-r border-line-2 bg-white px-4 py-2.5 align-top text-[14px] font-bold text-ink sm:w-auto sm:border-r-0 sm:px-5 sm:align-middle`}
                      >
                        <span className="flex items-center gap-1.5">
                          {dentro && (
                            <button
                              type="button"
                              onClick={() => alternar(l.chave)}
                              aria-label={`Abrir ${l.rotulo} por ${dentro.titulo.replace('Por ', '')}`}
                              aria-expanded={aberto}
                              className="-m-1 shrink-0 p-1 text-ink-dim transition hover:text-ink"
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition ${aberto ? 'rotate-90' : ''}`}
                              />
                            </button>
                          )}
                          {l.rotulo}
                          {selo?.(l.chave) && (
                            <span className="rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
                              {selo(l.chave)}
                            </span>
                          )}
                        </span>
                        {/* O total sobe para cá no celular: sem ele, a leitura
                            macro exigiria arrastar a tabela até o fim. */}
                        <TotalNoCelular rotulo={l.rotulo} celula={l.total} />
                      </td>

                      {gavetas.map((g) => (
                        <td
                          key={g.chave}
                          onClick={() =>
                            abrirCelula(`${l.rotulo} · ${g.rotulo}`, l.porGaveta[g.chave])
                          }
                          className={`px-3 py-2.5 text-right ${
                            l.porGaveta[g.chave] ? 'cursor-pointer hover:bg-forest/[0.06]' : ''
                          }`}
                        >
                          <Conteudo celula={l.porGaveta[g.chave]} />
                        </td>
                      ))}

                      <td
                        onClick={() => abrirCelula(`${l.rotulo} · período inteiro`, l.total)}
                        className="cursor-pointer border-l border-line-2 px-4 py-2.5 text-right hover:bg-forest/[0.06] sm:px-5"
                      >
                        <Total celula={l.total} forte />
                      </td>
                    </tr>

                    {/* O degrau de dentro: mesmas colunas, outro corte. O recuo e
                        o fundo dizem que aquilo pertence à linha de cima. */}
                    {sub?.linhas.map((s) => (
                      <tr key={`${l.chave}-${s.chave}`} className="border-b border-line-2 bg-canvas">
                        <td
                          className={`${COLUNA_PRESA} border-r border-line-2 bg-canvas py-2 pl-9 pr-4 align-top text-[13px] text-ink-2 sm:border-r-0 sm:pl-12 sm:pr-5 sm:align-middle`}
                        >
                          {s.rotulo}
                          <TotalNoCelular rotulo={`${l.rotulo} · ${s.rotulo}`} celula={s.total} />
                        </td>
                        {gavetas.map((g) => (
                          <td
                            key={g.chave}
                            onClick={() =>
                              abrirCelula(
                                `${l.rotulo} · ${s.rotulo} · ${g.rotulo}`,
                                s.porGaveta[g.chave],
                              )
                            }
                            className={`px-3 py-2 text-right ${
                              s.porGaveta[g.chave] ? 'cursor-pointer hover:bg-forest/[0.06]' : ''
                            }`}
                          >
                            <Conteudo celula={s.porGaveta[g.chave]} />
                          </td>
                        ))}
                        <td
                          onClick={() => abrirCelula(`${l.rotulo} · ${s.rotulo}`, s.total)}
                          className="cursor-pointer border-l border-line-2 px-4 py-2 text-right hover:bg-forest/[0.06] sm:px-5"
                        >
                          <Total celula={s.total} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-line-2 px-4 py-2 text-[11px] text-ink-dim sm:px-5">
        {noCelular && 'Arraste a tabela para o lado para ver as datas. '}
        {dentro
          ? `A seta abre a linha por ${dentro.titulo.replace('Por ', '')}. A célula abre as apostas dela.`
          : 'Clique numa célula para ver as apostas dela.'}
        {fora > 0 && quebra.notaDosFora && (
          <>
            {' '}
            <strong className="font-bold text-ink-2">
              {fora} aposta{fora > 1 ? 's' : ''} fora desta tabela:
            </strong>{' '}
            {quebra.notaDosFora}
          </>
        )}
      </p>

      <DrillDaCelula
        titulo={aberta?.titulo ?? ''}
        celula={aberta?.celula ?? null}
        aoFechar={() => setAberta(null)}
      />
    </details>
  );
}
