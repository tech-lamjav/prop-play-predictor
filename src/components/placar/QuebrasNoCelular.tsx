import { useState } from 'react';
import { Info } from 'lucide-react';
import type { Celula, LinhaLiquidada } from './placar-agregacao';
import { CartaoDoGrupo } from './CartaoDoGrupo';
import { DrillDaCelula } from './DrillDaCelula';
import { FichaDaLinha, type FichaAberta } from './FichaDaLinha';
import { comparar, type Comparacao } from './placar-comparacao';
import { emN, epPct, roiPct, tomDoRoi } from './placar-formato';
import type { Granularidade } from './placar-evolucao';
import { escalaDaTirinha, matriz, type CelulaDaMatriz } from './placar-matriz';
import type { Eixo } from './placar-periodo';
import { QUEBRAS, celulasDa, linhasDa } from './placar-quebras';
import { seloDeOculto, type MercadoOculto } from './placar-vitrine';

/** Um dos dois períodos dentro do cartão comparado. */
function LadoDoPeriodo({ rotulo, celula }: { rotulo: string; celula: Celula | null }) {
  return (
    <span className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="truncate text-ink-dim">{rotulo}</span>
      {celula ? (
        <span className="shrink-0 tabular-nums">
          <span className={`font-bold ${tomDoRoi(celula.roi)}`}>{roiPct(celula.roi)}</span>{' '}
          <span className="text-ink-dim">{emN(celula.n)}</span>
        </span>
      ) : (
        <span className="shrink-0 text-ink-dim">sem aposta</span>
      )}
    </span>
  );
}

/** A diferença, com a mesma regra da tabela comparada: fora do ruído é número, dentro é frase. */
function DiferencaNoCartao({ c }: { c: Comparacao }) {
  if (c.diferencaRoi === null) return <span className="text-[13px] text-ink-dim">—</span>;

  if (c.dentroDoRuido) {
    return (
      <span className="flex flex-col items-end">
        <span className="text-[12px] text-ink-2">dentro do ruído</span>
        <span className="text-[11px] tabular-nums text-ink-dim">
          {roiPct(c.diferencaRoi)} ± {epPct(c.erroDaDiferenca ?? 0)}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end">
      <span className={`font-display text-[20px] font-black leading-none ${tomDoRoi(c.diferencaRoi)}`}>
        {roiPct(c.diferencaRoi)}
      </span>
      <span className="mt-0.5 text-[11px] tabular-nums text-ink-dim">
        ± {epPct(c.erroDaDiferenca ?? 0)}
      </span>
    </span>
  );
}

/**
 * As quatro quebras do placar, do jeito que elas cabem num celular.
 *
 * Duas decisões, e as duas são sobre largura e comprimento:
 *
 *   · UMA quebra por vez, trocada por um seletor. As quatro têm a mesma forma, e
 *     empilhadas no celular elas eram a maior parte da rolagem da página;
 *   · cada grupo é um CARTÃO, e não uma linha de tabela. A tabela tinha uma
 *     coluna por data, e numa tela de 390px isso só se lia arrastando de lado —
 *     com o título e o cabeçalho ficando para trás. O cartão guarda o total e a
 *     tirinha do tempo; os números de cada semana moram na ficha.
 *
 * A explicação de cada quebra fica atrás do botão de informação: quem lê o
 * painel todo dia já leu, e no celular ela ocupava meia tela antes do primeiro
 * número.
 */
export function QuebrasNoCelular({
  liquidadas,
  granularidade,
  eixo,
  ocultos,
  comparacao,
}: {
  liquidadas: LinhaLiquidada[];
  granularidade: Granularidade;
  eixo: Eixo;
  ocultos: MercadoOculto[];
  comparacao?: { liquidadasB: LinhaLiquidada[]; rotuloDeA: string; rotuloDeB: string };
}) {
  const [ativa, setAtiva] = useState(0);
  const [sobre, setSobre] = useState(false);
  /** As fichas abertas, uma em cima da outra: o degrau empilha, e o voltar desempilha. */
  const [pilha, setPilha] = useState<FichaAberta[]>([]);
  const [apostas, setApostas] = useState<{ titulo: string; celula: CelulaDaMatriz } | null>(null);

  const quebra = QUEBRAS[ativa];
  const selo = (chave: string) => (quebra.marcaOculto ? seloDeOculto(chave, ocultos) : null);
  const rotulo = quebra.rotulo ?? ((chave: string) => chave);

  const { gavetas, linhas } = matriz(liquidadas, quebra, granularidade, eixo);
  const fora = liquidadas.length - linhasDa(quebra, liquidadas).length;

  // Comparando, o cartão mostra os dois períodos e a diferença, sem tirinha nem
  // ficha — como no desktop, onde a comparação também tira a matriz de cena.
  const comparadas = comparacao
    ? comparar(celulasDa(quebra, liquidadas), celulasDa(quebra, comparacao.liquidadasB), quebra.ordem)
    : null;
  const vazio = comparadas ? comparadas.length === 0 : linhas.length === 0;

  return (
    <section aria-label="Quebras do placar">
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Quebrar por"
          className="flex flex-1 overflow-hidden rounded-rebrand-sm border border-line-2 bg-white"
        >
          {QUEBRAS.map((q, i) => (
            <button
              key={q.titulo}
              type="button"
              aria-pressed={i === ativa}
              onClick={() => {
                setAtiva(i);
                setSobre(false);
              }}
              className={`flex-1 px-1 py-2 text-[12px] font-bold transition ${
                i === ativa ? 'bg-forest text-white' : 'text-ink-2'
              }`}
            >
              {q.curto}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Sobre esta quebra"
          aria-expanded={sobre}
          onClick={() => setSobre((v) => !v)}
          className={`shrink-0 rounded-full border p-2 transition ${
            sobre ? 'border-forest bg-forest/10 text-forest' : 'border-line-2 bg-white text-ink-dim'
          }`}
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      {sobre && (
        <p className="mt-2 rounded-rebrand-md border border-line-2 bg-white px-4 py-3 text-[13px] text-ink-2">
          {quebra.explicacao}
        </p>
      )}

      {vazio ? (
        <p className="mt-3 rounded-rebrand-md border border-line-2 bg-white px-4 py-8 text-[14px] text-ink-2">
          {comparacao
            ? 'Nenhuma oportunidade liquidada em nenhum dos dois períodos.'
            : 'Nenhuma oportunidade liquidada no período.'}
        </p>
      ) : comparadas && comparacao ? (
        <ul className="mt-3 flex flex-col gap-2">
          {comparadas.map((c) => (
            <li
              key={c.chave}
              className="rounded-rebrand-md border border-line-2 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold text-ink">
                  {rotulo(c.chave)}
                  {selo(c.chave) && (
                    <span className="rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
                      {selo(c.chave)}
                    </span>
                  )}
                </span>
                <DiferencaNoCartao c={c} />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <LadoDoPeriodo rotulo={comparacao.rotuloDeA} celula={c.a} />
                <LadoDoPeriodo rotulo={comparacao.rotuloDeB} celula={c.b} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {linhas.map((l) => (
            <li key={l.chave}>
              <CartaoDoGrupo
                linha={l}
                selo={selo(l.chave)}
                gavetas={gavetas}
                escala={escalaDaTirinha(linhas)}
                granularidade={granularidade}
                aoAbrir={() => setPilha([{ caminho: l.rotulo, linha: l, dentro: quebra.desdobraEm }])}
              />
            </li>
          ))}
        </ul>
      )}

      {fora > 0 && quebra.notaDosFora && (
        <p className="mt-2 px-1 text-[11px] text-ink-dim">
          <strong className="font-bold text-ink-2">
            {fora} aposta{fora > 1 ? 's' : ''} fora desta quebra:
          </strong>{' '}
          {quebra.notaDosFora}
        </p>
      )}

      <FichaDaLinha
        aberta={pilha[pilha.length - 1] ?? null}
        gavetas={gavetas}
        granularidade={granularidade}
        eixo={eixo}
        podeVoltar={pilha.length > 1}
        aoVoltar={() => setPilha((p) => p.slice(0, -1))}
        aoFechar={() => setPilha([])}
        aoAbrirApostas={(titulo, celula) => setApostas({ titulo, celula })}
        aoAbrirDegrau={(ficha) => setPilha((p) => [...p, ficha])}
      />

      <DrillDaCelula
        titulo={apostas?.titulo ?? ''}
        celula={apostas?.celula ?? null}
        aoFechar={() => setApostas(null)}
      />
    </section>
  );
}
