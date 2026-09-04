import { useEffect, useMemo, useRef } from 'react';
import { usePostHog } from '@posthog/react';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { divergenciasDaSaida } from '@/utils/futebol-criterio';

// A metade EM EXECUÇÃO da guarda de divergência (issue #353, spec #349).
//
// A outra metade é o teste com casos capturados de produção, que reprova no CI
// quando a derivação para de reproduzir vereditos conhecidos. Ela cobre o que foi
// capturado; esta cobre o resto do board.
//
// Por que as duas: derivar o critério no front é uma segunda implementação, ao
// lado da do modelo. Ela envelhece sozinha — o modelo muda uma margem e a tela
// segue com a antiga — e o sintoma é silencioso: um número correto embaixo de um
// veredito que não é o dele. Sem evento, a divergência só aparece se alguém
// estiver com o console aberto no jogo certo.

/** Quantas divergências uma renderização pode emitir. Trava contra enxurrada. */
const TETO_POR_SAIDA = 6;

/**
 * Emite evento quando a nossa conta do critério discorda do booleano do mart.
 *
 * A deduplicação é por (mercado, slug, linha, os dois vereditos): arrastar a
 * régua e voltar não reemite, e um jogo com a mesma divergência em duas linhas
 * emite as duas — são casos diferentes.
 *
 * Não devolve nada de propósito. A divergência é um defeito NOSSO, não informação
 * para o assinante: mostrá-la na tela seria pedir a ele que arbitrasse entre a
 * conta da tela e a do modelo. Quem precisa dela é quem lê o evento.
 */
export function useGuardaDeDivergencia({
  mercado,
  acesas,
  historico,
  lado,
  linha,
  slugs,
}: {
  mercado: string;
  acesas: readonly string[] | undefined;
  historico: FutebolFixtureHistorico[] | undefined;
  lado: 'home' | 'away' | null;
  linha: number | null;
  /** As premissas a conferir: as do lado da saída. */
  slugs: readonly string[];
}): void {
  const posthog = usePostHog();
  const jaEmitidas = useRef(new Set<string>());

  const divergencias = useMemo(
    () =>
      historico?.length && acesas
        ? divergenciasDaSaida(mercado, acesas, historico, lado, linha, slugs)
        : [],
    [mercado, acesas, historico, lado, linha, slugs],
  );

  useEffect(() => {
    for (const d of divergencias.slice(0, TETO_POR_SAIDA)) {
      const chave = `${d.mercado}:${d.slug}:${d.linha}:${d.nossa}:${d.doMart}`;
      if (jaEmitidas.current.has(chave)) continue;
      jaEmitidas.current.add(chave);
      posthog?.capture('futebol_premissa_divergente', {
        mercado: d.mercado,
        premissa: d.slug,
        linha: d.linha,
        insumo: d.insumo,
        corte: d.corte,
        veredito_da_tela: d.nossa,
        veredito_do_mart: d.doMart,
      });
    }
  }, [divergencias, posthog]);
}
