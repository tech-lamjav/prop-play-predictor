import { ROTA_DOS_SOCIOS } from '@/components/socios/crm-vocabulario';
import { MERCADOS } from '@/utils/futebol-premissas';

// ============================================================================
// placar-vocabulario.ts — os nomes e os limites do placar da metodologia
// ============================================================================
// O vocabulário aqui é o do FUTEBOL, e não o do CRM, embora as duas telas
// morem na mesma área. O glossário está no CONTEXT.md da raiz, e o mapa de
// contextos registra que a área hospeda os dois.
// ============================================================================

/**
 * O endereço do placar, o segundo andar da área de sócios.
 *
 * Mora ao lado do CRM e não dentro dele: uma barra única com "Leads" ao lado de
 * "Oportunidades" mistura dois vocabulários que o mapa de contextos manda não
 * misturar (ADR 0001).
 */
export const ROTA_DO_PLACAR = `${ROTA_DOS_SOCIOS}/metodologia`;

/**
 * O primeiro dia da SÉRIE COMPARÁVEL.
 *
 * Em 04/09/2026, por volta das 14h35 UTC, o denominador do Score trocou do p95
 * medido para o teto de pontos do catálogo. Linha nascida antes disso tem nota
 * em OUTRA escala, e somar as duas inventa uma série que nunca existiu.
 *
 * O histórico é append-only, então a linha antiga guarda a nota antiga para
 * sempre: não existe recálculo que conserte isso depois.
 */
export const INICIO_DA_SERIE_COMPARAVEL = '2026-09-04';

/**
 * O dia em que o histórico começou, capturando o board inteiro de uma vez.
 *
 * 03/09/2026 concentra centenas de linhas detectadas no mesmo instante, então
 * qualquer leitura por DIA DE DETECÇÃO que inclua esse dia lê uma pilha, não um
 * dia de operação. Por apito ele não incomoda, porque os jogos continuam
 * espalhados.
 */
export const DIA_EM_QUE_O_HISTORICO_COMECOU = '2026-09-03';

/** O nome do mercado como o produto o chama. */
export function rotuloDoMercado(slug: string): string {
  return MERCADOS.find((m) => m.slug === slug)?.label ?? slug;
}

/**
 * O INSTANTE em que o denominador do Score trocou.
 *
 * A data sozinha não basta, e é uma armadilha fina: a troca entrou em produção
 * às 14h35 UTC de 04/09, então as linhas nascidas na madrugada daquele mesmo dia
 * têm nota na escala antiga. Abrir a série comparável no dia 04/09 inteiro
 * misturaria as duas réguas justamente no período que se chama comparável.
 */
export const INSTANTE_DA_VIRADA = '2026-09-04T14:35:00Z';
