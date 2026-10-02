import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { LinhaLiquidada } from './placar-agregacao';
import { DrillDaCelula } from './DrillDaCelula';
import { epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { Granularidade } from './placar-evolucao';
import { matriz, type CelulaDaMatriz } from './placar-matriz';
import { linhasDa, type Quebra } from './placar-quebras';
import type { Eixo } from './placar-periodo';

/**
 * O rótulo CURTO de uma quebra, para a frase "abre a linha por …".
 *
 * Isto era `dentro.titulo.replace('Por ', '')` — texto de tela DERIVADO de
 * outro texto de tela por recorte de string, e o recorte é a tradução esperando
 * para quebrar: só o português começa esse título com "Por ". Em espanhol o
 * `replace` não acha nada e devolveria o título inteiro no meio da frase.
 *
 * O rótulo curto é texto de tela como qualquer outro, então ele é uma CHAVE do
 * catálogo. A tabela guarda chave e não texto, porque é avaliada na carga do
 * módulo: texto aqui congelaria o idioma da primeira renderização.
 *
 * ⚠️ Indexada pelo TÍTULO porque `Quebra` não tem identificador estável, e
 * `placar-quebras.ts` já usa o título como identidade (`porTitulo`). Aquele
 * arquivo está fora deste passo; no dia em que os títulos entrarem no catálogo,
 * `Quebra` precisa de um campo `id` e esta tabela passa a usá-lo.
 */
const CHAVE_DO_CURTO: Record<string, string> = {
  'Por mercado': 'quebras.curto.mercado',
  'Por faixa de Score': 'quebras.curto.faixaDeScore',
  'Por faixa de odd': 'quebras.curto.faixaDeOdd',
  'Por campeonato': 'quebras.curto.campeonato',
};

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
  const { t } = useTranslation('socios');
  const [aberta, setAberta] = useState<{ titulo: string; celula: CelulaDaMatriz } | null>(null);
  const [expandidas, setExpandidas] = useState<string[]>([]);

  const { gavetas, linhas } = matriz(liquidadas, quebra, granularidade, eixo);
  const fora = liquidadas.length - linhasDa(quebra, liquidadas).length;
  const dentro = quebra.desdobraEm;
  const chaveDoCurto = dentro ? CHAVE_DO_CURTO[dentro.titulo] : undefined;
  const dentroCurto = chaveDoCurto ? t(chaveDoCurto) : '';

  const abrirCelula = (titulo: string, celula: CelulaDaMatriz | undefined) => {
    if (!celula || celula.linhas.length === 0) return;
    setAberta({ titulo, celula });
  };

  const alternar = (chave: string) =>
    setExpandidas((atual) =>
      atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave],
    );

  return (
    <details open className="group/card rounded-rebrand-md border border-line-2 bg-white">
      <summary className="cursor-pointer list-none border-b border-line-2 px-5 py-3 marker:content-none">
        <div className="flex items-start gap-2">
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-dim transition group-open/card:rotate-90" />
          {/* `titulo` e `explicacao` vêm do catálogo de quebras, em
              `placar-quebras.ts`, e seguem em português: aquele arquivo está
              fora deste passo da migração. */}
          <div>
            <h2 className="font-display text-[17px] font-black text-ink">{quebra.titulo}</h2>
            <p className="mt-1 text-[13px] text-ink-2">{quebra.explicacao}</p>
          </div>
        </div>
      </summary>

      {linhas.length === 0 ? (
        <p className="px-5 py-8 text-[14px] text-ink-2">{t('quebras.vazio')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                <th className="sticky left-0 bg-white px-5 py-2 font-bold">
                  {t('quebras.colunaGrupo')}
                </th>
                {gavetas.map((g) => (
                  <th key={g.chave} className="px-3 py-2 text-right font-bold">
                    {g.rotulo}
                  </th>
                ))}
                <th className="px-5 py-2 text-right font-bold text-ink">
                  {t('quebras.matriz.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const aberto = expandidas.includes(l.chave);
                const sub = aberto && dentro ? matriz(l.total.linhas, dentro, granularidade, eixo) : null;

                return (
                  <Fragment key={l.chave}>
                    <tr className="border-b border-line-2">
                      <td className="px-5 py-2.5 text-[14px] font-bold text-ink">
                        <span className="flex items-center gap-1.5">
                          {dentro && (
                            <button
                              type="button"
                              onClick={() => alternar(l.chave)}
                              aria-label={t('quebras.matriz.abrirLinha', {
                                grupo: l.rotulo,
                                dentro: dentroCurto,
                              })}
                              aria-expanded={aberto}
                              className="text-ink-dim transition hover:text-ink"
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
                      </td>

                      {gavetas.map((g) => (
                        <td
                          key={g.chave}
                          onClick={() => abrirCelula(`${l.rotulo} · ${g.rotulo}`, l.porGaveta[g.chave])}
                          className={`px-3 py-2.5 text-right ${
                            l.porGaveta[g.chave] ? 'cursor-pointer hover:bg-forest/[0.06]' : ''
                          }`}
                        >
                          <Conteudo celula={l.porGaveta[g.chave]} />
                        </td>
                      ))}

                      <td
                        onClick={() =>
                          abrirCelula(`${l.rotulo} · ${t('quebras.periodoInteiro')}`, l.total)
                        }
                        className="cursor-pointer border-l border-line-2 px-5 py-2.5 text-right hover:bg-forest/[0.06]"
                      >
                        <Total celula={l.total} forte />
                      </td>
                    </tr>

                    {/* O degrau de dentro: mesmas colunas, outro corte. O recuo e
                        o fundo dizem que aquilo pertence à linha de cima. */}
                    {sub?.linhas.map((s) => (
                      <tr key={`${l.chave}-${s.chave}`} className="border-b border-line-2 bg-canvas/60">
                        <td className="py-2 pl-12 pr-5 text-[13px] text-ink-2">{s.rotulo}</td>
                        {gavetas.map((g) => (
                          <td
                            key={g.chave}
                            onClick={() =>
                              abrirCelula(`${l.rotulo} · ${s.rotulo} · ${g.rotulo}`, s.porGaveta[g.chave])
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
                          className="cursor-pointer border-l border-line-2 px-5 py-2 text-right hover:bg-forest/[0.06]"
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

      <p className="border-t border-line-2 px-5 py-2 text-[11px] text-ink-dim">
        {dentro
          ? t('quebras.matriz.comoAbrir', { dentro: dentroCurto })
          : t('quebras.matriz.cliqueNaCelula')}
        {fora > 0 && quebra.notaDosFora && (
          <>
            {' '}
            <strong className="font-bold text-ink-2">
              {t('quebras.matriz.foraDaTabela', { count: fora })}
            </strong>{' '}
            {/* `notaDosFora` vem de `placar-quebras.ts` e segue em português:
                aquele arquivo está fora deste passo da migração. */}
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
