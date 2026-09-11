import { ETAPAS, ETAPA_PADRAO, type Etapa } from './crm-vocabulario';
import type { Cadastro } from './crm-lista';

// ============================================================================
// O funil
// ============================================================================
// Onde cada lead está, e como filtrar a lista por isso. Funções puras: a
// leitura e a escrita no banco ficam nos hooks.
// ============================================================================

/** As etapas gravadas, indexadas pelo identificador da pessoa. */
export type EtapasGravadas = Record<string, string | undefined>;

const CONHECIDAS = new Set<string>(ETAPAS);

/**
 * Em que etapa alguém está.
 *
 * Sem linha, `novo`. Com valor que a tela não conhece, `novo` também: o banco
 * tem restrição, mas ela pode ser afrouxada por migration futura sem ninguém
 * lembrar daqui, e cair no padrão é melhor que desenhar um rótulo `undefined`.
 */
export function etapaDe(gravadas: EtapasGravadas, id: string): Etapa {
  const bruta = gravadas[id];
  return bruta && CONHECIDAS.has(bruta) ? (bruta as Etapa) : ETAPA_PADRAO;
}

/**
 * Filtra a lista por etapa. `null` não filtra.
 *
 * Passa por `etapaDe` em vez de comparar o que está gravado, e é isso que faz
 * o filtro de `novo` encontrar quem nunca foi tocado — que é justamente a
 * etapa onde está todo mundo que ainda falta abordar.
 */
export function filtrarPorEtapa(
  cadastros: Cadastro[],
  gravadas: EtapasGravadas,
  etapa: Etapa | null,
): Cadastro[] {
  if (!etapa) return cadastros;
  return cadastros.filter((c) => etapaDe(gravadas, c.id) === etapa);
}
