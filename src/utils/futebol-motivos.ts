import type { FutebolFixtureReasonItem } from '@/services/futebol-data.service';

/**
 * Separa apenas a forma de apresentar o contrato já decidido pelo backend.
 * Slugs seguem para o catálogo visual; itens com texto são componentes explícitos
 * do score e não têm drilldown jogo a jogo.
 */
export function separarMotivosDoContrato(itens: readonly FutebolFixtureReasonItem[]) {
  return {
    slugsDePremissas: itens.filter((item) => !item.texto).map((item) => item.id),
    motivosSemDrilldown: itens
      .filter((item) => item.texto)
      .map((item) => ({ t: item.texto as string })),
  };
}
