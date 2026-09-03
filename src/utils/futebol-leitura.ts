import type { FutebolFixturePremissas, FutebolFixtureValueRow } from '@/services/futebol-data.service';
import { filtrarCatalogoDeMercados } from '@/utils/futebol-mercados-ocultos';
import { ehDestaque } from '@/utils/futebol-score';
import { mesmaLinha, type Saida } from '@/utils/futebol-saida';
import {
  MERCADOS,
  PORTA_PREMISSAS,
  contaQueValem,
  linhaNegociavel,
  melhorCandidato,
  premissasDaSaida,
  type MercadoInfo,
} from '@/utils/futebol-premissas';

// A leitura do jogo, calculada UMA vez e reusada em toda a tela (Protótipo 1b):
// resumo, bancada, ranking e hero derivam daqui, para não existirem duas verdades.
//
// Regra de honestidade da adaptação: o protótipo mostra Score/odd/chance sempre,
// mas no dado real esses números SÓ existem quando há odds coletadas
// (get_futebol_fixture_value). Sem odds, a leitura vive das premissas — o próprio
// protótipo tem esse padrão no "sem preço" do BTTS.

// `mesmaLinha` mudou para futebol-saida.ts (módulo folha), porque as premissas
// também precisam dela e a leitura já importa delas — importar de volta fecharia
// um ciclo. Reexportada aqui para os consumidores que a conhecem por este nome.
export { mesmaLinha };

/** Casa uma linha de valor (odds reais) com um candidato de premissas. */
export function valueDoCandidato(
  valueRows: FutebolFixtureValueRow[] | null | undefined,
  s: Saida,
): FutebolFixtureValueRow | null {
  if (!valueRows?.length) return null;
  return (
    valueRows.find((v) => v.market === s.market && v.outcome === s.outcome && mesmaLinha(v.line_value, s.line_value)) ??
    null
  );
}

/** O caminho inverso: a linha de premissas da saída que tem preço. */
export function candidatoDaValue(
  rows: FutebolFixturePremissas[] | null | undefined,
  v: FutebolFixtureValueRow,
): FutebolFixturePremissas | null {
  return (
    (rows ?? []).find((r) => r.market === v.market && r.outcome === v.outcome && mesmaLinha(r.line_value, v.line_value)) ??
    null
  );
}

/**
 * A saída que o usuário clicou em Oportunidades. Aquela tela lista uma linha por
 * SAÍDA, não por mercado, e 18 dos 104 pares (jogo, mercado) do board têm duas ou
 * mais saídas cotadas: sem carregar qual foi clicada, abrir o card da segunda caía
 * na primeira, que é o mesmo susto de ver um pick virar outro.
 *
 * É uma `Saida` como qualquer outra; o apelido existe só para o parâmetro dizer
 * de onde ela vem.
 */
export type SaidaPreferida = Saida;

/**
 * Quem representa o mercado quando HÁ preço coletado: a saída que o usuário clicou,
 * se ele veio de Oportunidades, senão a de maior Score. Sempre junto das premissas
 * DELA.
 *
 * Só entram saídas que existem dos dois lados (preço e premissas). Uma saída com
 * preço e sem premissa pegaria carona no rótulo de outra saída, que é justamente o
 * bug que isto fecha.
 */
function saidaComPreco(
  rows: FutebolFixturePremissas[],
  valueRows: FutebolFixtureValueRow[] | null | undefined,
  market: string,
  preferida: SaidaPreferida | null | undefined,
): { value: FutebolFixtureValueRow; candidato: FutebolFixturePremissas } | null {
  if (!valueRows?.length) return null;
  const pares = valueRows
    .filter((v) => v.market === market && linhaNegociavel(market, v.line_value))
    .flatMap((v) => {
      const c = candidatoDaValue(rows, v);
      return c ? [{ value: v, candidato: c }] : [];
    });
  if (!pares.length) return null;
  if (preferida?.market === market) {
    const clicada = pares.find(
      (x) => x.value.outcome === preferida.outcome && mesmaLinha(x.value.line_value, preferida.line_value),
    );
    if (clicada) return clicada;
  }
  // Desempate EXPLÍCITO. Ordenando só por Score, duas saídas empatadas ficavam na
  // ordem em que a RPC devolveu as linhas, e o hero podia nomear uma ou outra sem
  // regra nenhuma. Empatado no preço, ganha quem tem mais premissas atrás, que é o
  // mesmo critério que vale quando não há preço; persistindo o empate, a ordem de
  // saída do próprio mercado, que é estável.
  return [...pares].sort(
    (a, b) =>
      b.value.score - a.value.score ||
      contaQueValem(market, b.candidato.acesas) - contaQueValem(market, a.candidato.acesas) ||
      a.value.outcome_order - b.value.outcome_order,
  )[0];
}

export interface MercadoResumo {
  mercado: MercadoInfo;
  /**
   * A saída/linha que representa o mercado: a de melhor Score quando há preço, a de
   * mais premissas quando não há. É ela que dá o rótulo, as premissas e o `value`.
   */
  candidato: FutebolFixturePremissas;
  nValem: number;
  totalQueValem: number;
  /** Linha de valor real (odds), quando coletada. */
  value: FutebolFixtureValueRow | null;
  /**
   * Destaque na leitura. Com odds, quem decide é a FAIXA publicada pelo
   * backend: a régua local de 40 saiu na virada do Score de contexto (spec
   * #301), porque era calibrada para a fórmula antiga e classificaria errado a
   * escala nova. Sem odds, continua a porta de contexto (2+ premissas).
   */
  passa: boolean;
}

export function resumoDosMercados(
  rows: FutebolFixturePremissas[] | null | undefined,
  valueRows: FutebolFixtureValueRow[] | null | undefined,
  // Explicitamente sem `?`: parâmetro obrigatório não pode seguir opcional, e
  // os quatro chamadores já passam algum valor.
  preferida: SaidaPreferida | null,
  // Os mercados fora da vitrine (#324). A prateleira do detalhe sai do CATÁLOGO
  // e não do board, então filtrar as linhas do board não bastava: o mercado
  // escondido continuava como chip, com barra de Score e sem odd.
  ocultos: readonly string[],
): MercadoResumo[] {
  if (!rows?.length) return [];
  return filtrarCatalogoDeMercados(MERCADOS, ocultos).flatMap((m) => {
    // Com preço coletado quem representa o mercado é a saída do melhor Score; sem
    // preço, a saída com mais premissas. Rótulo e números na MESMA saída, sempre.
    //
    // Antes o candidato saía sempre das premissas e o número saía do melhor Score do
    // mercado, e os dois podiam ser saídas diferentes: a tela escrevia "Menos de 4,5
    // gols" exibindo a chance, a odd e o Score de "Mais de 1,5 gols", enquanto
    // Oportunidades mostrava o segundo. Pior: o botão de registrar gravava a aposta
    // do preço, não a do rótulo que o usuário leu.
    const comPreco = saidaComPreco(rows, valueRows, m.slug, preferida);
    // A preferência do link agora vale também sem preço (#346): antes ela era
    // consultada só entre as linhas cotadas, e sumia justamente no jogo sem
    // oportunidade — que é a maioria dos jogos.
    const c = comPreco?.candidato ?? melhorCandidato(rows, m.slug, preferida);
    if (!c) return [];
    const nValem = contaQueValem(m.slug, c.acesas);
    // Denominador só do lado da saída: para um Over, "defesas firmes" e as outras do
    // Under nunca poderiam acender, então contá-las fazia "2 de 8" onde o certo é
    // "2 de 3".
    const totalQueValem = premissasDaSaida(m, c, c.acesas).filter(
      (p) => p.peso == null || p.peso > 0,
    ).length;
    const value = comPreco?.value ?? null;
    const passa = value ? ehDestaque(value.faixa) : nValem >= PORTA_PREMISSAS;
    return [{ mercado: m, candidato: c, nValem, totalQueValem, value, passa }];
  });
}

/** A "melhor leitura do jogo": maior Score real; sem odds, mais contexto. */
export function melhorLeitura(resumos: MercadoResumo[]): MercadoResumo | null {
  if (!resumos.length) return null;
  const comValor = resumos.filter((r) => r.value != null);
  if (comValor.length) return [...comValor].sort((a, b) => (b.value!.score) - (a.value!.score))[0];
  return [...resumos].sort((a, b) => b.nValem - a.nValem)[0];
}

/**
 * O sufixo "· N com leitura" dos contadores da agenda e do campeonato.
 *
 * Vazio enquanto o board não respondeu. Contar leituras a partir de um mapa
 * ainda vazio faz a tela afirmar "0 com leitura" antes de existir resposta — a
 * mesma conclusão prematura que o esqueleto da linha evita, só que em número.
 * Some em vez de mostrar zero: um contador que aparece atrasado é menos errado
 * do que um que mente e depois se corrige.
 */
export function sufixoDeLeitura(carregando: boolean, comLeitura: number): string {
  return carregando ? '' : ` · ${comLeitura} com leitura`;
}

/**
 * A saída que abre a folha de detalhe de um mercado.
 *
 * É a MESMA que o card do mercado nomeia — e é só isso que ela faz. Existe como
 * função, e não como uma linha solta no componente, porque durante um tempo ela
 * NÃO era a mesma, e ninguém tinha onde escrever um teste que provasse a
 * igualdade.
 *
 * O que havia antes: sem oportunidade, a folha preferia qualquer candidata que
 * já tivesse cotação, desempatando pela MENOR linha. Em gols a menor linha é
 * sempre "Mais de 0,5" — a mais verdadeira e mais inútil do mercado, odd 1.03.
 * Então o card dizia "Menos de 3,25 gols · sem cotação" e a folha ao lado abria
 * em "Mais de 0,5 gols" (#346, Flamengo × Mirassol de 02/09/2026).
 *
 * A preferência por linha cotada não voltou em outro lugar: ela era a causa. O
 * aviso "sem cotação" já explica por que ainda não dá para apostar, e isso é
 * mais honesto que desviar a pessoa para uma linha que ela não quer.
 */
export function saidaQueAbreAFolha(
  resumo: MercadoResumo | null | undefined,
): FutebolFixturePremissas | null {
  return resumo?.candidato ?? null;
}
