import type {
  FutebolFixtureHistorico,
  FutebolFixtureNumeros,
  FutebolFixturePremissas,
  FutebolFixtureReasonContractRow,
  FutebolFixtureReasonItem,
} from '@/services/futebol-data.service';
import { PREMISSAS_OCULTAS, premissaDe, type Premissa } from '@/utils/futebol-premissas';
import { evidenciaDe, type Evidencia } from '@/utils/futebol-evidencias';
import { evidenciaDaPremissa } from '@/utils/futebol-evidencia-da-premissa';
import { mesmaLinha } from '@/utils/futebol-leitura';

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

export function estadoDosMotivos<T>(
  favor: readonly T[],
  contra: readonly T[],
  carregando: boolean,
): EstadoDosMotivos {
  if (favor.length > 0 || contra.length > 0) return 'motivos';
  return carregando ? 'carregando' : 'sem_motivos';
}

/** Uma premissa acesa com o número que a embasa, quando existe. */
export type PremissaComEvidencia = { premissa: Premissa; evidencia: Evidencia | null };

/** O que cada tela pede de diferente. */
export type OpcoesDasPremissasAcesas = {
  /**
   * Quantas exibir. Ausente = sem corte, e quem chama fatia.
   *
   * `explicacaoDaLeitura` pede sem corte porque precisa contar quantas existem
   * antes de fatiar — o rótulo do painel anuncia o total, não o que coube.
   */
  max?: number;
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
      evidencia: evidenciaDaPremissa({
        mercado,
        slug: premissa.slug,
        numeros,
        historico,
        lado,
        linha,
      }),
    }));
}


/**
 * O que a tela mostra para explicar uma leitura, e sob que rótulo.
 *
 * **Com preço**, os itens são **motivos**: quem agrupa em A favor e Contra é o
 * backend, e a tela só traduz o slug. É o mesmo contrato que a home e a bancada
 * leem, então as telas passam a dizer a mesma coisa.
 *
 * **Sem preço** não existe contrato — ele só é emitido para linha cotada. Os
 * itens são as premissas acesas e o rótulo muda para **"O que o jogo mostra"**,
 * porque sem preço não há aposta a favor de quê. Por isso o retorno chama-se
 * `itens`, e não `aFavor`: metade das vezes eles não são motivo, e o glossário é
 * explícito que motivo é o que o backend agrupou.
 *
 * ⚠️ **Degradação deliberada:** com preço, se o contrato chegou e não tem linha
 * para aquela saída, cai nas premissas acesas com o rótulo do sem-preço. Some do
 * bloco seria pior — antes desta mudança a tela sempre tinha o que dizer, e
 * sumir com a explicação inteira por falha de uma consulta é regressão. O rótulo
 * mais fraco é o que mantém a tela honesta.
 *
 * `contrato: undefined` (ainda em voo) devolve listas vazias e **não** cai na
 * degradação: cabe ao chamador não concluir nada enquanto isso, com
 * `estadoDosMotivos`.
 */
export type SaidaExplicavel = {
  market: string;
  outcome: string;
  line_value: number | null;
  /** As premissas acesas, quando a tela as tem. A home lê do board e não tem. */
  acesas?: readonly string[];
};

export function explicacaoDaLeitura(
  entrada: {
    mercado: string;
    /**
     * A saída escolhida, no mínimo que a explicação precisa dela.
     *
     * Estrutural de propósito: o resumo e o painel passam a linha de premissas,
     * e a home passa a linha do board — que não tem `acesas`, e nem precisa,
     * porque lá sempre há preço e a fonte é o contrato.
     */
    candidato: SaidaExplicavel | null | undefined;
    /** A leitura tem preço coletado? É o que decide a fonte e o rótulo. */
    temPreco: boolean;
    contrato: FutebolFixtureReasonContractRow[] | undefined;
    numeros: FutebolFixtureNumeros[] | undefined;
    historico: FutebolFixtureHistorico[] | undefined;
    lado: 'home' | 'away' | null;
  },
  opcoes: OpcoesDasPremissasAcesas & {
    /** Quantos itens de Contra exibir. Ausente = a tela não mostra contra. */
    maxContra?: number;
  },
): {
  rotulo: 'Por quê' | 'O que o jogo mostra';
  itens: PremissaComEvidencia[];
  contra: PremissaComEvidencia[];
  /**
   * Quantos itens existem ANTES do corte da tela.
   *
   * O rótulo do painel anuncia um número, e ele é quantos existem e não quantos
   * couberam — senão a tela diria sempre o mesmo número assim que houvesse itens
   * demais.
   */
  total: number;
} {
  const { mercado, candidato, temPreco, contrato, numeros, historico, lado } = entrada;
  const linha = candidato?.line_value ?? null;

  // Sem corte: quem corta é quem chama, e o total precisa ser contado antes.
  const monta = (slugs: readonly string[]) =>
    premissasAcesasDaLeitura(
      { mercado, acesas: slugs, numeros, historico, lado, linha },
      { incluirPesoZero: opcoes.incluirPesoZero },
    );

  const semPreco = () => {
    const todos = monta(candidato?.acesas ?? []);
    return {
      rotulo: 'O que o jogo mostra' as const,
      itens: todos.slice(0, opcoes.max),
      // Sem preço não há aposta, e sem aposta não há o que pesar contra.
      contra: [],
      total: todos.length,
    };
  };

  if (!temPreco) return semPreco();

  const doContrato = (contrato ?? []).find(
    (r) =>
      r.market === candidato?.market &&
      r.outcome === candidato?.outcome &&
      mesmaLinha(r.line_value, linha),
  );

  // Chegou e não tem linha para esta saída: melhor o rótulo mais fraco que o
  // bloco vazio. Ainda em voo (`contrato` indefinido) NÃO cai aqui.
  if (contrato != null && doContrato == null) return semPreco();

  const todos = monta(separarMotivosDoContrato(doContrato?.favor ?? []).slugsDePremissas);
  return {
    rotulo: 'Por quê',
    itens: todos.slice(0, opcoes.max),
    contra:
      opcoes.maxContra == null
        ? []
        : monta(separarMotivosDoContrato(doContrato?.contra ?? []).slugsDePremissas).slice(
            0,
            opcoes.maxContra,
          ),
    total: todos.length,
  };
}
