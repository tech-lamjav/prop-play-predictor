import { mercadoOcultoNaData, ocultosAgora, type MercadoOculto } from '@/utils/futebol-mercados-ocultos';
import {
  cortadaNaData,
  vantagemDePublicacao,
  type LimiarDeValor,
} from '@/utils/futebol-corte-de-valor';
import type { LinhaPublicada } from './placar-agregacao';

// ============================================================================
// placar-vitrine.ts — o mercado que saiu da tela do assinante
// ============================================================================
// Um mercado pode sair da VITRINE sem sair do BOARD: o backend continua
// publicando e medindo, e só o que o assinante vê muda. Hoje é o caso do
// handicap, fora da vitrine desde 01/09/2026.
//
// O placar conta o mercado oculto POR PADRÃO, ao contrário de
// `scripts/futebol-roi.mjs`, que o exclui por padrão. Não é divergência de
// conta, é divergência de pergunta: o script responde "como foi o produto que o
// assinante usou", e o placar responde "como está a metodologia" — e decidir se
// o handicap volta é exatamente uma das decisões que o placar sustenta.
//
// ⚠️ A REGRA não mora aqui. Ela mora em `futebol-mercados-ocultos.ts`, que é a
// casa dela desde a issue #324 e já trata o caso que este arquivo tinha errado:
// vitrine sem data, que acontece quando a leitura falha e o fallback entra. Este
// módulo só escolhe o EIXO — a detecção — e conta quantas linhas saíram.
// ============================================================================

export type { MercadoOculto };

/**
 * A linha esteve na vitrine?
 *
 * Vale pela DETECÇÃO, e não pelo apito: o que decide é quando ela foi publicada,
 * porque é aí que ela apareceu (ou não) na tela do assinante. É a diferença que
 * importa numa linha publicada em 31/08, para um jogo de 02/09, com o mercado
 * saindo da vitrine em 01/09 — ela esteve na tela.
 */
export function esteveNaVitrine(
  linha: LinhaPublicada,
  ocultos: readonly MercadoOculto[],
  agoraMs: number = Date.now(),
  // O corte de valor (migration 144) é a outra forma de uma linha não estar na
  // tela, e vale pelo mesmo eixo: a detecção.
  limiares: readonly LimiarDeValor[] = [],
): boolean {
  return (
    !mercadoOcultoNaData(linha.market, linha.detectada_em, ocultos, agoraMs) &&
    // ⚠️ Pela vantagem de PUBLICAÇÃO, e não pelo preço exibido. Desde a
    // migration 162 o `edge` desta linha pode ser o preço de RESERVA — o da
    // primeira versão do histórico — para uma linha que nunca esteve visível.
    // Cortar por ele mantinha na vitrine exatamente o que nunca esteve nela,
    // sempre que esse preço de reserva passasse no limiar.
    //
    // `vantagemDePublicacao` é quem distingue "nunca apareceu" (nulo) de "este
    // banco não sabe responder" (coluna ausente), e é a mesma função que o board
    // e o detalhe do jogo usam.
    !cortadaNaData(
      linha.market,
      vantagemDePublicacao(linha),
      linha.detectada_em,
      limiares,
      agoraMs,
    )
  );
}

/** Só o que o assinante viu. O resto é board, e continua medido em outra leitura. */
export function soAVitrine(
  linhas: readonly LinhaPublicada[],
  ocultos: readonly MercadoOculto[],
  agoraMs: number = Date.now(),
  limiares: readonly LimiarDeValor[] = [],
): LinhaPublicada[] {
  return linhas.filter((l) => esteveNaVitrine(l, ocultos, agoraMs, limiares));
}

/**
 * O selo do mercado na tabela, quando ele está fora da vitrine hoje.
 *
 * `null` quando o mercado está na tela: selo em toda linha não marca nada.
 */
export function seloDeOculto(market: string, ocultos: readonly MercadoOculto[]): string | null {
  // Só o período aberto: o mercado que já voltou está na tela (migration 145).
  return ocultosAgora(ocultos).includes(market) ? 'fora da vitrine' : null;
}
