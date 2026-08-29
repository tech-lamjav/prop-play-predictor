import type { FutebolFixtureReasonItem } from '@/services/futebol-data.service';
import { PREMISSAS_OCULTAS } from '@/utils/futebol-premissas';

/**
 * Um item do contrato que não é razão de contexto e por isso não vai para a
 * tela. Existem por causa da janela da virada: o contrato antigo continua no ar
 * até a migration 112 ser aplicada, e ele ainda manda preço junto do cenário.
 *
 *   · `componente_score` era a decomposição da nota antiga ("A cotação oferece
 *     valor", "Corroboração confirma a leitura"). O Score de contexto não é
 *     soma de partes exibível.
 *   · `aviso_N` são os avisos de odd, que o contrato antigo despeja dentro de
 *     Contra. Eles continuam visíveis no rodapé do painel, como leitura de
 *     risco da cotação — o que acaba é entrarem como premissa do jogo.
 *   · os slugs de preço do catálogo (movimento de linha, movimento das casas,
 *     concordância do modelo) chegam como premissa aplicável no contrato antigo.
 */
function ehDePreco(item: FutebolFixtureReasonItem): boolean {
  return (
    item.tipo === 'componente_score' ||
    (item.tipo === 'penalidade' && item.id.startsWith('aviso_')) ||
    PREMISSAS_OCULTAS.has(item.id)
  );
}

/**
 * Separa apenas a forma de apresentar o contrato já decidido pelo backend, e
 * descarta o que é preço.
 *
 * Slugs seguem para o catálogo visual, com drilldown jogo a jogo; itens com
 * texto são frases prontas do backend e não têm de onde tirar drilldown.
 */
export function separarMotivosDoContrato(itens: readonly FutebolFixtureReasonItem[]) {
  const doContexto = itens.filter((item) => !ehDePreco(item));
  return {
    slugsDePremissas: doContexto.filter((item) => !item.texto).map((item) => item.id),
    motivosSemDrilldown: doContexto
      .filter((item) => item.texto)
      .map((item) => ({ t: item.texto as string, pontos: item.pontos })),
  };
}
