import type {
  FutebolFixtureHistorico,
  FutebolFixtureNumeros,
  FutebolFixturePremissas,
  FutebolFixtureReasonItem,
} from '@/services/futebol-data.service';
import { PREMISSAS_OCULTAS, premissaDe, type Premissa } from '@/utils/futebol-premissas';
import { evidenciaDe, type Evidencia } from '@/utils/futebol-evidencias';
import { evidenciaDoHistorico } from '@/utils/futebol-historico';

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

/** Uma premissa acesa com o número que a embasa, quando existe. */
export type PremissaComEvidencia = { premissa: Premissa; evidencia: Evidencia | null };

/** O que cada tela pede de diferente. */
export type OpcoesDasPremissasAcesas = {
  /** Quantas exibir. Resumo do jogo pede 3; painel da lista pede 4. */
  max: number;
  /**
   * Premissa de peso zero entra na lista?
   *
   * Peso zero não é premissa quebrada: é premissa que a recalibragem tirou da
   * conta e manteve visível, porque ela descreve o jogo mesmo sem pontuar.
   * O resumo mostra; o painel não.
   */
  incluirPesoZero: boolean;
};

/**
 * As premissas acesas de uma leitura, ordenadas por peso e prontas para a tela.
 *
 * ⚠️ O nome diz o que ela faz, e não o que a tela chama o resultado, de
 * propósito. Pelo glossário, **motivo** é o que o backend agrupou — "não existe
 * motivo que a tela conclua sozinha" —, e esta função monta a lista aqui, a
 * partir das premissas acesas. Chamá-la de motivo seria o código contradizer o
 * vocabulário.
 *
 * Depois do #334 ela fica só para **linha analisada sem preço**, onde o que a
 * tela mostra tem nome próprio: "o que o jogo mostra". Leitura com preço passa a
 * ler o contrato.
 *
 * O que ela faz existir agora é o lugar: enquanto a montagem viveu dentro de
 * duas telas, elas divergiram sem ninguém ver.
 *
 * A evidência do histórico do time é tentada sempre. Não é opção porque não é
 * observável: quem não a quer passa `historico` vazio, e aí ela é nula de
 * qualquer jeito.
 */
export function premissasAcesasDaLeitura(
  entrada: {
    /** Slug do mercado da leitura. */
    mercado: string;
    /** Slugs das premissas que acenderam para a saída escolhida. */
    acesas: readonly string[] | null | undefined;
    numeros: FutebolFixtureNumeros[] | undefined;
    historico: FutebolFixtureHistorico[] | undefined;
    lado: 'home' | 'away' | null;
    /**
     * A linha da saída, quando o texto da evidência depende dela.
     *
     * ⚠️ Vem separada de propósito, e não derivada do candidato. As duas telas
     * divergem aqui: o painel passa a linha e o resumo não, e o resumo tem
     * candidato com linha — derivar mudaria o texto dele. Enquanto o #332
     * promete comportamento idêntico, a divergência fica explícita. Ela some no
     * #334, junto com as outras.
     */
    linha: number | null;
  },
  opcoes: OpcoesDasPremissasAcesas,
): PremissaComEvidencia[] {
  const { mercado, acesas, numeros, historico, lado, linha } = entrada;

  return (acesas ?? [])
    .map((slug) => premissaDe(mercado, slug))
    .filter((p): p is Premissa => p != null)
    .filter((p) => opcoes.incluirPesoZero || p.peso == null || p.peso > 0)
    .sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0))
    .slice(0, opcoes.max)
    .map((premissa) => ({
      premissa,
      evidencia:
        evidenciaDe(premissa.slug, numeros, lado, true, linha) ??
        evidenciaDoHistorico(premissa.slug, historico, lado, linha),
    }));
}
