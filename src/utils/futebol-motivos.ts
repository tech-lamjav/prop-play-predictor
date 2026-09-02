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

/**
 * O que o card do destaque deve mostrar no lugar dos motivos.
 *
 * São TRÊS estados, e o defeito que esta função existe para impedir é o card
 * colapsá-los em dois. Os motivos do destaque vêm de uma SEGUNDA consulta
 * (`get_futebol_fixture_reason_contract`), que só pode começar depois que o
 * board resolveu e a oportunidade em destaque foi escolhida — ela depende do
 * `fixture_id` dela. Então a lista vazia acontece sempre, por alguns instantes,
 * antes de os motivos chegarem.
 *
 * Enquanto "ainda carregando" e "carregou e não tem motivo" forem os dois
 * `favor.length === 0`, a tela mostra o texto do "Por quê" e o troca por
 * "A favor / Contra" na cara do usuário. Não é corrida nem dado errado: é
 * estado de carregamento que não existia.
 *
 * `motivos` vence `carregando` de propósito. Com o `isLoading` do react-query v5
 * que o card passa hoje isso é redundante — ele é `isPending && isFetching`, já
 * falso numa revalidação com dado em mão. A ordem fica assim mesmo porque a
 * invariante é do estado, não do hook: trocar para `isFetching`, ou passar um
 * `carregando` de outra origem, não pode apagar motivo que já está na tela.
 *
 * Erro de consulta cai em `sem_motivos`, e é degradação deliberada: o texto do
 * "Por quê" é derivado da própria oportunidade e continua verdadeiro sem o
 * contrato. Esqueleto eterno seria pior.
 */
export type EstadoDosMotivos = 'motivos' | 'carregando' | 'sem_motivos';

/** Um motivo já traduzido para exibição, com o slug preservado como chave. */
export type MotivoExibivel = { slug: string; texto: string };

export function estadoDosMotivos(
  favor: readonly MotivoExibivel[],
  contra: readonly MotivoExibivel[],
  carregando: boolean,
): EstadoDosMotivos {
  if (favor.length > 0 || contra.length > 0) return 'motivos';
  return carregando ? 'carregando' : 'sem_motivos';
}
