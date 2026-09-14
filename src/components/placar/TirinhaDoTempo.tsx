import { roiPct } from './placar-formato';
import { ROTULO_DA_GRANULARIDADE, type Granularidade } from './placar-evolucao';
import type { CelulaDaMatriz, Matriz } from './placar-matriz';

/** A altura de cada metade, em px: acima do zero o que ganhou, abaixo o que perdeu. */
const METADE = 14;

/**
 * O ROI de um grupo ao longo do tempo, numa tira que cabe na largura de um cartão.
 *
 * É o que sobra das colunas de data da matriz quando a tela não tem largura para
 * elas: uma barra por gaveta, na mesma ordem cronológica. Ela não serve para ler
 * o número — para isso existe a ficha — e sim o FORMATO: caiu sempre, caiu numa
 * semana, está subindo.
 *
 * ⚠️ O sinal vai pela DIREÇÃO da barra, e a cor só reforça. O verde e o vermelho
 * do produto ficam perto demais para quem tem daltonismo vermelho-verde (o
 * validador de paleta mede 5,9 de distância, abaixo do piso), então uma tira que
 * dependesse só da cor seria ilegível para uma parte dos sócios.
 *
 * Gaveta sem aposta fica vazia, e não com uma barra de zero: zero é resultado,
 * vazio é ausência.
 */
export function TirinhaDoTempo({
  gavetas,
  porGaveta,
  escala,
  granularidade,
}: {
  gavetas: Matriz['gavetas'];
  porGaveta: Record<string, CelulaDaMatriz>;
  /** A régua compartilhada da lista, de escalaDaTirinha. */
  escala: number;
  granularidade: Granularidade;
}) {
  const descricao = gavetas
    .filter((g) => porGaveta[g.chave])
    .map((g) => `${g.rotulo} ${roiPct(porGaveta[g.chave].celula.roi)}`)
    .join(', ');

  return (
    <span className="block w-full">
      <span
        role="img"
        aria-label={`ROI por ${ROTULO_DA_GRANULARIDADE[granularidade].toLowerCase()}: ${descricao}`}
        className="relative flex w-full gap-[2px]"
        style={{ height: METADE * 2 }}
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line-2" />
        {gavetas.map((g) => {
          const c = porGaveta[g.chave];
          if (!c) return <span key={g.chave} className="flex-1" />;

          const roi = c.celula.roi;
          const ganhou = roi >= 0;
          // Dois pixels de piso: uma semana de +0,4% ainda é uma semana que
          // ganhou, e sumir com ela confundiria com a semana sem aposta.
          const altura = Math.max(2, Math.min(1, Math.abs(roi) / escala) * METADE);

          return (
            <span key={g.chave} className="relative flex-1">
              <span
                className={`absolute left-1/2 w-full max-w-[24px] -translate-x-1/2 ${
                  ganhou ? 'rounded-t-[4px] bg-forest' : 'rounded-b-[4px] bg-red-600'
                }`}
                style={ganhou ? { bottom: METADE, height: altura } : { top: METADE, height: altura }}
              />
            </span>
          );
        })}
      </span>

      {/* Só as pontas rotuladas: uma data embaixo de cada barra não caberia, e
          as duas pontas bastam para dizer de quando a quando a tira vai. */}
      {gavetas.length > 1 && (
        <span className="mt-1 flex justify-between text-[10px] tabular-nums text-ink-dim">
          <span>{gavetas[0].rotulo}</span>
          <span>{gavetas[gavetas.length - 1].rotulo}</span>
        </span>
      )}
    </span>
  );
}
